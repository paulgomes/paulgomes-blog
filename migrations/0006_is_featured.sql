-- Campo de destaque do post (apenas 1 post pode ser featured por vez —
-- regra de exclusividade aplicada via endpoint, nao via constraint SQL)
ALTER TABLE posts_meta ADD COLUMN is_featured INTEGER NOT NULL DEFAULT 0;

-- Indice parcial pra busca rapida do post featured atual (1 row max em uso)
CREATE INDEX IF NOT EXISTS idx_posts_meta_featured
  ON posts_meta(is_featured)
  WHERE is_featured = 1;
