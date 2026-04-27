// src/modules/facebook-bot/facebookBot.worker.ts
import os from "os";
import {
  FacebookBotQueueRepository,
  FacebookBotQueueRow,
} from "./facebookBotRepositorio";
import { FacebookBotCooldownRepository } from "./facebook-bot-cooldown.repository";
import {
  MAX_RETRIES,
  computeCooldownMsByStrikes,
  generateAiReply,
  getErrorBackoffMs,
  getRandomHumanDelayMs,
  getRetryBackoffMs,
  isBlockedByKeyword,
  isOwnPageComment,
  randomBetween,
  replyToComment,
  sanitizeReplyForFacebook,
  sleep,
} from "./facebookBot.service";

const queueRepo = new FacebookBotQueueRepository();
const cooldownRepo = new FacebookBotCooldownRepository();

const WORKER_ID =
  process.env.FB_BOT_WORKER_ID ||
  `${os.hostname()}-pid${process.pid}-${Math.random().toString(36).slice(2, 8)}`;

const POLL_IDLE_MS = Number(process.env.FB_BOT_WORKER_POLL_MS || 3000);
const LOCK_MINUTES = Number(process.env.FB_BOT_WORKER_LOCK_MINUTES || 5);

let started = false;
let stopping = false;

export function startFacebookBotWorker() {
  if (started) {
    console.log(`🟡 FacebookBotWorker ya estaba iniciado (${WORKER_ID})`);
    return;
  }

  started = true;
  stopping = false;

  console.log(`🚀 FacebookBotWorker iniciado: ${WORKER_ID}`);
  void workerLoop();
}

export function stopFacebookBotWorker() {
  stopping = true;
  console.log(`🛑 FacebookBotWorker detenido solicitado: ${WORKER_ID}`);
}

async function workerLoop() {
  while (!stopping) {
    try {
      // 1) Recuperar jobs colgados (reinicios/crashes)
      const recovered = await queueRepo.requeueExpiredLocks();
      if (recovered > 0) {
        console.log(`♻️ Jobs recuperados por lock expirado: ${recovered}`);
      }

      // 2) Limpiar cooldowns vencidos
      const clearedCooldowns = await cooldownRepo.clearExpired();
      if (clearedCooldowns > 0) {
        console.log(`🧹 Cooldowns vencidos limpiados: ${clearedCooldowns}`);
      }

      // 3) Tomar siguiente job
      const job = await queueRepo.takeNextJob(WORKER_ID, LOCK_MINUTES);

      if (!job) {
        await sleep(POLL_IDLE_MS);
        continue;
      }

      await processJob(job);
    } catch (err) {
      console.error("❌ Error en loop del FacebookBotWorker:", err);
      await sleep(5000);
    }
  }

  console.log(`✅ FacebookBotWorker finalizado: ${WORKER_ID}`);
}

async function processJob(job: FacebookBotQueueRow) {
  const logBase = {
    queueId: job.id,
    commentId: job.comment_id,
    pageId: job.page_id,
    postId: job.post_id,
    attempts: job.attempts,
  };

  try {
    // 0) Ignorar comentarios de la propia página
    if (isOwnPageComment(job.from_id || undefined, job.page_id)) {
      console.log(
        "🙅 Comentario de la propia página, se marca skipped",
        logBase,
      );
      await queueRepo.markSkipped(job.id, "own_page_comment");
      return;
    }

    // 1) Comentario vacío
    if (!job.comment_message || !job.comment_message.trim()) {
      console.log("⚪ Comentario vacío, se marca skipped", logBase);
      await queueRepo.markSkipped(job.id, "empty_comment");
      return;
    }

    // 2) Blocklist
    if (isBlockedByKeyword(job.comment_message)) {
      console.log("🚫 Comentario filtrado por blocklist", logBase);
      await queueRepo.markSkipped(job.id, "blocked_keyword");
      return;
    }

    // 3) Delay humano (serializado por cola)
    const humanDelayMs = getRandomHumanDelayMs();
    console.log(
      `⏱️ Delay humano ${Math.round(humanDelayMs / 1000)}s antes de responder`,
      logBase,
    );
    await sleep(humanDelayMs);

    // 4) IA
    const aiReply = await generateAiReply(
      job.comment_message,
      job.post_message || undefined,
    );

    if (!aiReply) {
      console.log("⚪ IA no devolvió respuesta, se marca skipped", logBase);
      await queueRepo.markSkipped(job.id, "ai_empty_response");
      return;
    }

    const safeReply = sanitizeReplyForFacebook(aiReply);

    if (!safeReply) {
      console.log(
        "⚪ Respuesta vacía tras sanitizar, se marca skipped",
        logBase,
      );
      await queueRepo.markSkipped(job.id, "sanitized_empty_response");
      return;
    }

    // 5) Publicar en Facebook
    const result = await replyToComment(job.comment_id, safeReply);

    if (result.ok) {
      // Baja strikes si venía de bloqueos previos
      await cooldownRepo.reduceStrike(job.page_id).catch(() => null);

      await queueRepo.markDone(job.id);

      console.log("✅ Comentario respondido y marcado done", {
        ...logBase,
        replyPreview: safeReply.slice(0, 120),
      });
      return;
    }

    // 6) Bloqueo de spam/frecuencia (368/1390008)
    if (result.isSpamFrequencyBlock) {
      const activeCooldown = await cooldownRepo.getActiveCooldown(job.page_id);
      const currentStrikes = Number(activeCooldown?.strikes || 0);
      const nextStrikes = currentStrikes + 1;

      const cooldownMs = computeCooldownMsByStrikes(nextStrikes);

      await cooldownRepo.upsertCooldown({
        pageId: job.page_id,
        cooldownMs,
        reason: `FB spam/frequency block code=${result.fbCode} subcode=${result.fbSubcode}`,
      });

      const nextAttempts = (job.attempts || 0) + 1;

      if (nextAttempts <= MAX_RETRIES) {
        const retryAfterMs = cooldownMs + randomBetween(10_000, 45_000);

        await queueRepo.markRetry({
          id: job.id,
          attempts: nextAttempts,
          retryAfterMs,
          errorMessage: "facebook_spam_frequency_block",
          fbCode: result.fbCode,
          fbSubcode: result.fbSubcode,
        });

        console.warn("⛔ Bloqueo temporal de Facebook, job reprogramado", {
          ...logBase,
          nextAttempts,
          cooldownSec: Math.round(retryAfterMs / 1000),
        });
        return;
      }

      await queueRepo.markFailed({
        id: job.id,
        attempts: nextAttempts,
        errorMessage: "facebook_spam_frequency_block_max_retries",
        fbCode: result.fbCode,
        fbSubcode: result.fbSubcode,
      });

      console.warn("❌ Max reintentos alcanzados por bloqueo de Facebook", {
        ...logBase,
        nextAttempts,
      });
      return;
    }

    // 7) Otros errores retryables
    if (result.isRetryable) {
      const nextAttempts = (job.attempts || 0) + 1;

      if (nextAttempts <= MAX_RETRIES) {
        const retryAfterMs =
          getRetryBackoffMs(nextAttempts) + randomBetween(2_000, 12_000);

        await queueRepo.markRetry({
          id: job.id,
          attempts: nextAttempts,
          retryAfterMs,
          errorMessage: result.statusText || "retryable_error",
          fbCode: result.fbCode,
          fbSubcode: result.fbSubcode,
        });

        console.warn("🔁 Error temporal, job reprogramado", {
          ...logBase,
          nextAttempts,
          retryAfterSec: Math.round(retryAfterMs / 1000),
        });
        return;
      }

      await queueRepo.markFailed({
        id: job.id,
        attempts: nextAttempts,
        errorMessage: result.statusText || "retryable_error_max_retries",
        fbCode: result.fbCode,
        fbSubcode: result.fbSubcode,
      });

      console.warn("❌ Job falló por agotar reintentos temporales", {
        ...logBase,
        nextAttempts,
      });
      return;
    }

    // 8) Error no retryable
    await queueRepo.markFailed({
      id: job.id,
      attempts: job.attempts || 0,
      errorMessage: result.statusText || "non_retryable_error",
      fbCode: result.fbCode,
      fbSubcode: result.fbSubcode,
    });

    console.warn("❌ Error no reintetable, job marcado failed", logBase);
  } catch (err: any) {
    console.error("❌ Error procesando job del worker:", { ...logBase, err });

    const nextAttempts = (job.attempts || 0) + 1;

    if (nextAttempts <= MAX_RETRIES) {
      const retryAfterMs = getErrorBackoffMs(nextAttempts);

      await queueRepo.markRetry({
        id: job.id,
        attempts: nextAttempts,
        retryAfterMs,
        errorMessage: String(err?.message || err || "worker_exception"),
      });

      console.warn("🔁 Excepción en worker, job reprogramado", {
        ...logBase,
        nextAttempts,
        retryAfterSec: Math.round(retryAfterMs / 1000),
      });
      return;
    }

    await queueRepo.markFailed({
      id: job.id,
      attempts: nextAttempts,
      errorMessage: String(
        err?.message || err || "worker_exception_max_retries",
      ),
    });

    console.warn("❌ Excepción en worker y max reintentos alcanzados", {
      ...logBase,
      nextAttempts,
    });
  }
}
