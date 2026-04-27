ALTER TABLE quiz_category_translation
        ADD COLUMN IF NOT EXISTS "desc" TEXT,
        ADD COLUMN IF NOT EXISTS badge VARCHAR(40);