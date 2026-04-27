
  -- Mapa Pregunta → Post del blog por idioma (para redirigir al contenido del blog)
  CREATE TABLE IF NOT EXISTS diagnostic_question_post (
    id           VARCHAR(36) PRIMARY KEY,
    question_id  VARCHAR(36) NOT NULL REFERENCES diagnostic_question(id) ON DELETE CASCADE,
    locale       VARCHAR(5)  NOT NULL,              -- 'es','en','pt','fr','de','ar'
    blog_slug    VARCHAR(200) NOT NULL,             -- slug público del post del blog
    published    BOOLEAN NOT NULL DEFAULT false,    -- true si ya debe redirigir / indexar
    created_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (question_id, locale)
  );

  CREATE INDEX IF NOT EXISTS idx_dqp_question ON diagnostic_question_post(question_id);
  CREATE INDEX IF NOT EXISTS idx_dqp_locale   ON diagnostic_question_post(locale);
  