
      CREATE TABLE IF NOT EXISTS quiz_question(
        id VARCHAR(60) PRIMARY KEY,

        context VARCHAR(20) NOT NULL DEFAULT 'daily',
        category_key VARCHAR(50) NOT NULL,

        answer_index SMALLINT NOT NULL,
        difficulty SMALLINT DEFAULT 1,
        is_active BOOLEAN DEFAULT TRUE,

        "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

        FOREIGN KEY (category_key, context)
          REFERENCES quiz_category(key, context)
          ON DELETE RESTRICT,

        CONSTRAINT quiz_question_context_chk CHECK (context IN ('daily', 'school')),
        CONSTRAINT quiz_question_answer_chk CHECK (answer_index BETWEEN 0 AND 3),
        CONSTRAINT quiz_question_diff_chk CHECK (difficulty BETWEEN 1 AND 5)
      );
    