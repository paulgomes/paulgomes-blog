-- Coluna pra marcar "última sincronização com Git"
-- Substitui o hack `updated_at <= published_at` por sinal explícito
ALTER TABLE posts_meta ADD COLUMN synced_at INTEGER;

-- Default p/ os posts já importados: estão sincronizados (acabamos de importar do Git)
UPDATE posts_meta SET synced_at = published_at WHERE synced_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_posts_meta_synced_at ON posts_meta(synced_at);
