
    CREATE TABLE IF NOT EXISTS libros (
      id            VARCHAR(36) PRIMARY KEY,
      slug          VARCHAR(255) UNIQUE NOT NULL,
      title         VARCHAR(255) NOT NULL,
      description   TEXT NOT NULL,
      price_usd     NUMERIC(10,2) NOT NULL DEFAULT 0,
      pages         INTEGER NOT NULL,
      language      VARCHAR(10) NOT NULL DEFAULT 'es',   -- 'es' | 'en' | 'pt' | 'fr'
      preview_pages VARCHAR(100) DEFAULT '',             -- "1,2,3"
      tipo          VARCHAR(10) NOT NULL DEFAULT 'pagado', -- 'gratis' | 'pagado'
      is_free       BOOLEAN NOT NULL DEFAULT false,
      pdf_url       TEXT NOT NULL,
      portada_url   TEXT NOT NULL,
      "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_libros_slug ON libros(slug);
    CREATE INDEX IF NOT EXISTS idx_libros_tipo ON libros(tipo);
    CREATE INDEX IF NOT EXISTS idx_libros_language ON libros(language);
  