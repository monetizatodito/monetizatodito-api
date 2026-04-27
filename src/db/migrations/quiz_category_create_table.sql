
      CREATE TABLE IF NOT EXISTS quiz_category(
        key VARCHAR(50) NOT NULL,
        context VARCHAR(20) NOT NULL DEFAULT 'daily',
        "order" INT DEFAULT 0,
        is_active BOOLEAN DEFAULT TRUE,

        "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

        PRIMARY KEY (key, context),
        CONSTRAINT quiz_category_context_chk CHECK (context IN ('daily', 'school'))
      );
    