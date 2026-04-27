CREATE INDEX IF NOT EXISTS quiz_question_id_ctx_idx
        ON quiz_question(id, context);