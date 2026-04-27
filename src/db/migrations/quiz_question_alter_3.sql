CREATE INDEX IF NOT EXISTS quiz_question_ctx_active_idx
        ON quiz_question(context, is_active);