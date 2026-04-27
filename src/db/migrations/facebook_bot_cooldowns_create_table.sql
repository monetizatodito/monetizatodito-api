
    CREATE TABLE IF NOT EXISTS facebook_bot_cooldowns (
      page_id         VARCHAR(80) PRIMARY KEY,
      cooldown_until  TIMESTAMPTZ NOT NULL,
      strikes         INT NOT NULL DEFAULT 1,
      reason          VARCHAR(120),
      "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_fbc_cooldown_until
      ON facebook_bot_cooldowns (cooldown_until);
  