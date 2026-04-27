CREATE INDEX IF NOT EXISTS quiz_category_ctx_active_idx
        ON quiz_category(context, is_active);