CREATE INDEX IF NOT EXISTS blog_youtube_urls_gin_idx
      ON blog USING GIN (youtube_urls);