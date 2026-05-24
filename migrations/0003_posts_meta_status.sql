-- Adiciona status pra suportar soft-delete e unpublish
ALTER TABLE posts_meta ADD COLUMN status TEXT NOT NULL DEFAULT 'published';
-- Valores possíveis: 'published' | 'deleted' | 'unpublished'

CREATE INDEX IF NOT EXISTS idx_posts_meta_status ON posts_meta(status);
