
    CREATE TABLE IF NOT EXISTS facebook_bot_queue (
      id              VARCHAR(36) PRIMARY KEY,
      page_id         VARCHAR(80) NOT NULL,
      post_id         VARCHAR(120) NOT NULL,
      comment_id      VARCHAR(120) NOT NULL UNIQUE,
      from_id         VARCHAR(120),
      comment_message TEXT NOT NULL,
      post_message    TEXT,
      status          VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending | processing | retry | done | failed | skipped
      attempts        INT NOT NULL DEFAULT 0,
      next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      locked_until    TIMESTAMPTZ,
      worker_id       VARCHAR(80),
      last_error      TEXT,
      fb_code         INT,
      fb_subcode      INT,
      "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "processedAt"   TIMESTAMPTZ
    );

    CREATE INDEX IF NOT EXISTS idx_fbq_status_next_attempt
      ON facebook_bot_queue (status, next_attempt_at);

    CREATE INDEX IF NOT EXISTS idx_fbq_page_id
      ON facebook_bot_queue (page_id);

    CREATE INDEX IF NOT EXISTS idx_fbq_locked_until
      ON facebook_bot_queue (locked_until);
  