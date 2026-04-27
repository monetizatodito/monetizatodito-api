
    CREATE TABLE IF NOT EXISTS diagnostic_question_translation (
      id            VARCHAR(36) PRIMARY KEY,
      question_id   VARCHAR(36) NOT NULL REFERENCES diagnostic_question(id) ON DELETE CASCADE,
      locale        TEXT NOT NULL,             -- 'en','pt','fr','de','ar'
      title         TEXT NOT NULL,
      slug          TEXT NOT NULL,
      created_at    TIMESTAMP DEFAULT NOW(),
      updated_at    TIMESTAMP DEFAULT NOW(),
      UNIQUE(question_id, locale),
      UNIQUE(locale, slug)                      -- evita duplicar slugs por idioma
    );
    -- (Opcional) índices recomendados
      CREATE INDEX IF NOT EXISTS idx_dqt_locale ON diagnostic_question_translation(locale);
      CREATE INDEX IF NOT EXISTS idx_dqt_slug_locale ON diagnostic_question_translation(locale, slug);
    