
      CREATE TABLE IF NOT EXISTS quiz_question_translation(
        id SERIAL PRIMARY KEY,

        question_id VARCHAR(60) NOT NULL REFERENCES quiz_question(id) ON DELETE CASCADE,
        locale VARCHAR(5) NOT NULL,

        question TEXT NOT NULL,
        choices TEXT[] NOT NULL,
        explanation TEXT,

        "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

        UNIQUE (question_id, locale),
        CONSTRAINT quiz_qtrans_choices_len_chk CHECK (array_length(choices, 1) = 4)
      );
    