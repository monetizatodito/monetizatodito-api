
    CREATE TABLE IF NOT EXISTS payments (
      id              VARCHAR(36) PRIMARY KEY,
      provider        VARCHAR(20) NOT NULL,                   -- 'paypal'
      provider_id     VARCHAR(64) NOT NULL,                   -- orderID/captureID
      status          VARCHAR(30) NOT NULL,                   -- 'COMPLETED', etc.
      type            VARCHAR(20) NOT NULL,                   -- 'purchase'|'donation'
      libro_id        VARCHAR(36) REFERENCES libros(id) ON DELETE SET NULL,
      amount          NUMERIC(10,2) NOT NULL DEFAULT 0,
      currency        VARCHAR(10) NOT NULL DEFAULT 'USD',
      payer_email     VARCHAR(200),
      payer_name      VARCHAR(200),
      raw             JSONB NOT NULL,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_payments_type    ON payments(type);
    CREATE INDEX IF NOT EXISTS idx_payments_libro   ON payments(libro_id);
    CREATE INDEX IF NOT EXISTS idx_payments_created ON payments(created_at);
  