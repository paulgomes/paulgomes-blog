-- Estende posts_meta pra suportar edição completa via painel
ALTER TABLE posts_meta ADD COLUMN description TEXT;
ALTER TABLE posts_meta ADD COLUMN content_md TEXT;
ALTER TABLE posts_meta ADD COLUMN hero_image_url TEXT;
ALTER TABLE posts_meta ADD COLUMN tags TEXT;  -- JSON array
ALTER TABLE posts_meta ADD COLUMN updated_at INTEGER;
ALTER TABLE posts_meta ADD COLUMN focus_keyword TEXT;
ALTER TABLE posts_meta ADD COLUMN meta_title TEXT;
ALTER TABLE posts_meta ADD COLUMN meta_description TEXT;

CREATE INDEX IF NOT EXISTS idx_posts_meta_published_at
  ON posts_meta(published_at DESC);
