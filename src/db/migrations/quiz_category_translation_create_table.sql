
      CREATE TABLE IF NOT EXISTS quiz_category_translation(
        id SERIAL PRIMARY KEY,

        category_key VARCHAR(50) NOT NULL,
        context VARCHAR(20) NOT NULL DEFAULT 'daily',
        locale VARCHAR(5) NOT NULL,

        title VARCHAR(120) NOT NULL,
        "desc" TEXT,
        badge VARCHAR(40),

        "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

        FOREIGN KEY (category_key, context)
          REFERENCES quiz_category(key, context)
          ON DELETE CASCADE,

        UNIQUE (category_key, context, locale)
      );
    