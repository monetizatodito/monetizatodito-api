
    CREATE TABLE IF NOT EXISTS seo_pagespeed (
      id            VARCHAR(36) PRIMARY KEY,
      url         TEXT NOT NULL,
      strategy    TEXT NOT NULL CHECK (strategy IN ('mobile', 'desktop')),
      score       NUMERIC NOT NULL,      -- 0–100
      raw_score   NUMERIC NOT NULL,      -- 0–1 de Lighthouse
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    -- (Opcional) índices recomendados
      CREATE INDEX IF NOT EXISTS idx_seo_pagespeed_url_created_at
      ON seo_pagespeed (url, created_at DESC);
    