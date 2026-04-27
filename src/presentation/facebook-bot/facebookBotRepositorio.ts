import { pool } from "../../db/db-config";
import { generarIdUnico } from "../../config/generar-id";
import { CustomError } from "../../error/custom.error";

export type FacebookBotQueueRow = {
  id: string;
  page_id: string;
  post_id: string;
  comment_id: string;
  from_id?: string | null;
  comment_message: string;
  post_message?: string | null;
  status: "pending" | "processing" | "retry" | "done" | "failed" | "skipped";
  attempts: number;
  next_attempt_at: Date;
  locked_until?: Date | null;
  worker_id?: string | null;
  last_error?: string | null;
  fb_code?: number | null;
  fb_subcode?: number | null;
  createdAt: Date;
  updatedAt: Date;
  processedAt?: Date | null;
};

export class FacebookBotQueueRepository {
  enqueue(input: {
    pageId: string;
    postId: string;
    commentId: string;
    commentMessage: string;
    fromId?: string;
    postMessage?: string;
  }) {
    const id = generarIdUnico();

    const q = `
      INSERT INTO facebook_bot_queue (
        id, page_id, post_id, comment_id, from_id, comment_message, post_message
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      ON CONFLICT (comment_id) DO NOTHING
      RETURNING *;
    `;

    return pool
      .query(q, [
        id,
        input.pageId,
        input.postId,
        input.commentId,
        input.fromId ?? null,
        input.commentMessage,
        input.postMessage ?? null,
      ])
      .then((r) => r.rows[0] as FacebookBotQueueRow | undefined)
      .catch((err) => {
        throw CustomError.internalServerError(
          `No se pudo encolar comentario: ${err}`,
        );
      });
  }

  /**
   * Toma 1 trabajo listo para procesar, bloqueándolo para un worker.
   * Seguro para múltiples instancias (SKIP LOCKED).
   */
  takeNextJob(workerId: string, lockMinutes = 5) {
    const q = `
      WITH picked AS (
        SELECT q.id
        FROM facebook_bot_queue q
        WHERE q.status IN ('pending', 'retry')
          AND q.next_attempt_at <= NOW()
          AND (q.locked_until IS NULL OR q.locked_until < NOW())
          AND NOT EXISTS (
            SELECT 1
            FROM facebook_bot_cooldowns c
            WHERE c.page_id = q.page_id
              AND c.cooldown_until > NOW()
          )
        ORDER BY q.next_attempt_at ASC, q."createdAt" ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      UPDATE facebook_bot_queue q
      SET
        status = 'processing',
        worker_id = $1,
        locked_until = NOW() + ($2 || ' minutes')::interval,
        "updatedAt" = NOW()
      FROM picked
      WHERE q.id = picked.id
      RETURNING q.*;
    `;

    return pool
      .query(q, [workerId, String(lockMinutes)])
      .then((r) => r.rows[0] as FacebookBotQueueRow | undefined)
      .catch((err) => {
        throw CustomError.internalServerError(
          `No se pudo tomar job de cola: ${err}`,
        );
      });
  }

  markDone(id: string) {
    const q = `
      UPDATE facebook_bot_queue
      SET
        status = 'done',
        locked_until = NULL,
        last_error = NULL,
        "processedAt" = NOW(),
        "updatedAt" = NOW()
      WHERE id = $1
      RETURNING *;
    `;
    return pool
      .query(q, [id])
      .then((r) => r.rows[0] as FacebookBotQueueRow | undefined);
  }

  markSkipped(id: string, reason: string) {
    const q = `
      UPDATE facebook_bot_queue
      SET
        status = 'skipped',
        locked_until = NULL,
        last_error = $2,
        "processedAt" = NOW(),
        "updatedAt" = NOW()
      WHERE id = $1
      RETURNING *;
    `;
    return pool
      .query(q, [id, reason])
      .then((r) => r.rows[0] as FacebookBotQueueRow | undefined);
  }

  markRetry(input: {
    id: string;
    attempts: number;
    retryAfterMs: number;
    errorMessage?: string;
    fbCode?: number;
    fbSubcode?: number;
  }) {
    const retrySeconds = Math.max(1, Math.floor(input.retryAfterMs / 1000));

    const q = `
      UPDATE facebook_bot_queue
      SET
        status = 'retry',
        attempts = $2,
        next_attempt_at = NOW() + ($3 || ' seconds')::interval,
        locked_until = NULL,
        last_error = $4,
        fb_code = $5,
        fb_subcode = $6,
        "updatedAt" = NOW()
      WHERE id = $1
      RETURNING *;
    `;

    return pool
      .query(q, [
        input.id,
        input.attempts,
        String(retrySeconds),
        input.errorMessage ?? null,
        input.fbCode ?? null,
        input.fbSubcode ?? null,
      ])
      .then((r) => r.rows[0] as FacebookBotQueueRow | undefined);
  }

  markFailed(input: {
    id: string;
    attempts: number;
    errorMessage?: string;
    fbCode?: number;
    fbSubcode?: number;
  }) {
    const q = `
      UPDATE facebook_bot_queue
      SET
        status = 'failed',
        attempts = $2,
        locked_until = NULL,
        last_error = $3,
        fb_code = $4,
        fb_subcode = $5,
        "processedAt" = NOW(),
        "updatedAt" = NOW()
      WHERE id = $1
      RETURNING *;
    `;

    return pool
      .query(q, [
        input.id,
        input.attempts,
        input.errorMessage ?? null,
        input.fbCode ?? null,
        input.fbSubcode ?? null,
      ])
      .then((r) => r.rows[0] as FacebookBotQueueRow | undefined);
  }

  // Limpia jobs "processing" que quedaron colgados por reinicio
  requeueExpiredLocks() {
    const q = `
      UPDATE facebook_bot_queue
      SET
        status = 'retry',
        locked_until = NULL,
        next_attempt_at = NOW() + interval '30 seconds',
        "updatedAt" = NOW()
      WHERE status = 'processing'
        AND locked_until IS NOT NULL
        AND locked_until < NOW()
      RETURNING id;
    `;
    return pool.query(q).then((r) => r.rowCount || 0);
  }
}
