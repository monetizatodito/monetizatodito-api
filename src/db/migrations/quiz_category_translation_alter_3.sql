CREATE INDEX IF NOT EXISTS quiz_cat_trans_key_ctx_idx
        ON quiz_category_translation(category_key, context);