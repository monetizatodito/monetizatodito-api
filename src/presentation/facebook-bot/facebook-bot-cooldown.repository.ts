import { pool } from "../../db/db-config";

export class FacebookBotCooldownRepository {
  getActiveCooldown(pageId: string) {
    const q = `
      SELECT *
      FROM facebook_bot_cooldowns
      WHERE page_id = $1
        AND cooldown_until > NOW()
      LIMIT 1;
    `;

    return pool.query(q, [pageId]).then((r) => r.rows[0] || null);
  }

  upsertCooldown(input: {
    pageId: string;
    cooldownMs: number;
    reason?: string;
  }) {
    const seconds = Math.max(1, Math.floor(input.cooldownMs / 1000));

    const q = `
      INSERT INTO facebook_bot_cooldowns (
        page_id, cooldown_until, strikes, reason
      )
      VALUES (
        $1,
        NOW() + ($2 || ' seconds')::interval,
        1,
        $3
      )
      ON CONFLICT (page_id)
      DO UPDATE SET
        cooldown_until = GREATEST(
          facebook_bot_cooldowns.cooldown_until,
          NOW() + ($2 || ' seconds')::interval
        ),
        strikes = facebook_bot_cooldowns.strikes + 1,
        reason = EXCLUDED.reason,
        "updatedAt" = NOW()
      RETURNING *;
    `;

    return pool
      .query(q, [input.pageId, String(seconds), input.reason ?? null])
      .then((r) => r.rows[0]);
  }

  clearExpired() {
    const q = `
      DELETE FROM facebook_bot_cooldowns
      WHERE cooldown_until <= NOW();
    `;
    return pool.query(q).then((r) => r.rowCount || 0);
  }

  reduceStrike(pageId: string) {
    const q = `
      UPDATE facebook_bot_cooldowns
      SET
        strikes = GREATEST(strikes - 1, 0),
        "updatedAt" = NOW()
      WHERE page_id = $1
      RETURNING *;
    `;
    return pool.query(q, [pageId]).then((r) => r.rows[0] || null);
  }
}
