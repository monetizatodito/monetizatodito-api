
      CREATE TABLE IF NOT EXISTS quiz_daily_set(
        id SERIAL PRIMARY KEY,

        date_key VARCHAR(10) NOT NULL, -- YYYY-MM-DD
        locale VARCHAR(5) NOT NULL,

        context VARCHAR(20) NOT NULL DEFAULT 'daily',
        category_key VARCHAR(50) NOT NULL,
        mode VARCHAR(20) NOT NULL, -- classic|fast|relaxed

        limit_count SMALLINT NOT NULL DEFAULT 10,
        seed INT,
        question_ids TEXT[] NOT NULL,

        "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

        FOREIGN KEY (category_key, context)
          REFERENCES quiz_category(key, context)
          ON DELETE RESTRICT,

        CONSTRAINT quiz_daily_mode_chk CHECK (mode IN ('classic', 'fast', 'relaxed')),
        CONSTRAINT quiz_daily_ctx_chk CHECK (context IN ('daily', 'school')),
        CONSTRAINT quiz_daily_limit_chk CHECK (limit_count BETWEEN 1 AND 50),

        UNIQUE (date_key, locale, context, category_key, mode)
      );
    