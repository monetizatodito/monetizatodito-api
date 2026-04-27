CREATE INDEX IF NOT EXISTS quiz_question_cat_ctx_active_idx
        ON quiz_question(category_key, context, is_active);