CREATE INDEX IF NOT EXISTS quiz_daily_lookup_idx
        ON quiz_daily_set(date_key, locale, context, category_key, mode);