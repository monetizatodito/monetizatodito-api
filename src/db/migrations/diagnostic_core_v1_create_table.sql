
  -- Extensión útil para búsqueda difusa (fuzzy)
  CREATE EXTENSION IF NOT EXISTS pg_trgm;

  -- Catálogo de tipos de nevera
  CREATE TABLE IF NOT EXISTS fridge_type (
    id    VARCHAR(36) PRIMARY KEY,
    code  VARCHAR(20) UNIQUE NOT NULL, -- 'digital' | 'analogica'
    name  VARCHAR(50) NOT NULL
  );

  -- ✅ Semilla con ID explícito (NO nulo)
  INSERT INTO fridge_type(id, code, name) VALUES
    ('FT_DIGITAL','digital','Digital'),
    ('FT_ANALOGICA','analogica','Analógica')
  ON CONFLICT (code) DO NOTHING;

  -- Preguntas (intenciones)
  CREATE TABLE IF NOT EXISTS diagnostic_question (
    id                   VARCHAR(36) PRIMARY KEY,
    slug                 VARCHAR(160) UNIQUE NOT NULL,
    title                TEXT NOT NULL,
    problem_keywords     TEXT[],
    default_fridge_type  VARCHAR(20) NOT NULL DEFAULT 'analogica',
    status               VARCHAR(20) NOT NULL DEFAULT 'draft', -- draft | published | archived
    created_at           TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMP NOT NULL DEFAULT NOW()
  );

  -- Índices (búsqueda fuzzy y filtros)
  CREATE INDEX IF NOT EXISTS idx_dq_title_trgm   ON diagnostic_question USING GIN (title gin_trgm_ops);
  CREATE INDEX IF NOT EXISTS idx_dq_status       ON diagnostic_question (status);
  CREATE INDEX IF NOT EXISTS idx_dq_default_type ON diagnostic_question (default_fridge_type);

  -- Artículos/guías
  CREATE TABLE IF NOT EXISTS diagnostic_article (
    id              VARCHAR(36) PRIMARY KEY,
    question_id     VARCHAR(36) NOT NULL REFERENCES diagnostic_question(id) ON DELETE CASCADE,
    fridge_type     VARCHAR(20) NOT NULL, -- digital | analogica
    seo_title       TEXT NOT NULL,
    seo_description TEXT NOT NULL,
    content_md      TEXT NOT NULL,
    published       BOOLEAN NOT NULL DEFAULT false,
    published_at    TIMESTAMP,
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(question_id, fridge_type)
  );

  -- Índices artículos
  CREATE INDEX IF NOT EXISTS idx_da_published       ON diagnostic_article (published);
  CREATE INDEX IF NOT EXISTS idx_da_fridge_type     ON diagnostic_article (fridge_type);
  CREATE INDEX IF NOT EXISTS idx_da_seo_title_trgm  ON diagnostic_article USING GIN (seo_title gin_trgm_ops);

  -- Pasos (HowTo)
  CREATE TABLE IF NOT EXISTS article_step (
    id                VARCHAR(36) PRIMARY KEY,
    article_id        VARCHAR(36) NOT NULL REFERENCES diagnostic_article(id) ON DELETE CASCADE,
    idx               INT NOT NULL,
    title             TEXT NOT NULL,
    body_md           TEXT NOT NULL,
    tools             TEXT[], -- herramientas sugeridas
    duration_minutes  INT,
    risk_level        VARCHAR(20) DEFAULT 'bajo', -- bajo | medio | alto
    media_urls        TEXT[]
  );
  CREATE INDEX IF NOT EXISTS idx_step_article_idx ON article_step (article_id, idx);

  -- Marcas y modelos (opcional)
  CREATE TABLE IF NOT EXISTS brand (
    id   VARCHAR(36) PRIMARY KEY,
    name VARCHAR(80) UNIQUE NOT NULL
  );

  CREATE TABLE IF NOT EXISTS model (
    id        VARCHAR(36) PRIMARY KEY,
    brand_id  VARCHAR(36) NOT NULL REFERENCES brand(id) ON DELETE CASCADE,
    name      VARCHAR(120) NOT NULL,
    UNIQUE(brand_id, name)
  );
  CREATE INDEX IF NOT EXISTS idx_model_brand ON model (brand_id);

  -- Especificaciones
  CREATE TABLE IF NOT EXISTS component_spec (
    id        VARCHAR(36) PRIMARY KEY,
    name      VARCHAR(80) NOT NULL,
    metric    VARCHAR(80) NOT NULL,
    good_min  NUMERIC,
    good_max  NUMERIC,
    note      TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_comp_spec_name ON component_spec (name);

  -- Etiquetas
  CREATE TABLE IF NOT EXISTS tag (
    id   VARCHAR(36) PRIMARY KEY,
    name VARCHAR(40) UNIQUE NOT NULL
  );

  CREATE TABLE IF NOT EXISTS diagnostic_question_tag (
    question_id VARCHAR(36) REFERENCES diagnostic_question(id) ON DELETE CASCADE,
    tag_id      VARCHAR(36) REFERENCES tag(id) ON DELETE CASCADE,
    PRIMARY KEY (question_id, tag_id)
  );
  CREATE INDEX IF NOT EXISTS idx_dqt_q ON diagnostic_question_tag (question_id);
  CREATE INDEX IF NOT EXISTS idx_dqt_t ON diagnostic_question_tag (tag_id);

  -- Árbol de decisión (opcional)
  CREATE TABLE IF NOT EXISTS decision_tree (
    id           VARCHAR(36) PRIMARY KEY,
    question_id  VARCHAR(36) NOT NULL REFERENCES diagnostic_question(id) ON DELETE CASCADE,
    fridge_type  VARCHAR(20) NOT NULL,
    version      INT NOT NULL DEFAULT 1,
    active       BOOLEAN NOT NULL DEFAULT true,
    tree_json    JSONB NOT NULL,
    created_at   TIMESTAMP NOT NULL DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_dt_active ON decision_tree (question_id, fridge_type, active);

  -- Telemetría y feedback (opcional)
  CREATE TABLE IF NOT EXISTS telemetry_event (
    id          VARCHAR(36) PRIMARY KEY,
    ts          TIMESTAMP NOT NULL DEFAULT NOW(),
    event_type  VARCHAR(40) NOT NULL,
    search_term TEXT,
    slug        VARCHAR(160),
    fridge_type VARCHAR(20),
    meta        JSONB
  );
  CREATE INDEX IF NOT EXISTS idx_te_ts         ON telemetry_event (ts);
  CREATE INDEX IF NOT EXISTS idx_te_event_type ON telemetry_event (event_type);

  CREATE TABLE IF NOT EXISTS article_feedback (
    id         VARCHAR(36) PRIMARY KEY,
    article_id VARCHAR(36) REFERENCES diagnostic_article(id) ON DELETE CASCADE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    success    BOOLEAN,
    comment    TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_af_article ON article_feedback (article_id);
  CREATE INDEX IF NOT EXISTS idx_af_created ON article_feedback (created_at);
  