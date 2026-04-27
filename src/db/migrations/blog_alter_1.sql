ALTER TABLE blog
       ADD COLUMN IF NOT EXISTS type VARCHAR(20),
        ADD COLUMN IF NOT EXISTS youtube_urls TEXT[],
        ADD COLUMN IF NOT EXISTS images_alt TEXT;
       