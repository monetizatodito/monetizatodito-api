
    ALTER TABLE libros
      ADD COLUMN IF NOT EXISTS downloads_count INTEGER NOT NULL DEFAULT 0;

    CREATE TABLE IF NOT EXISTS libro_downloads (
      id           VARCHAR(36) PRIMARY KEY,
      libro_id     VARCHAR(36) NOT NULL REFERENCES libros(id) ON DELETE CASCADE,
      ip           VARCHAR(64),
      user_id      VARCHAR(36),                -- null si es público
      user_agent   TEXT,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_libro_downloads_libro ON libro_downloads(libro_id);
    CREATE INDEX IF NOT EXISTS idx_libro_downloads_created ON libro_downloads(created_at);
  