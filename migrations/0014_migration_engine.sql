-- Migration Engine — schema de suporte (Fase 0).
-- Aditiva: nao altera nada existente, so adiciona tabelas/colunas.
-- Aplicar com: wrangler d1 execute paulgomes-painel --remote --file=migrations/0014_migration_engine.sql
-- (NAO auto-aplicada por push; requer acesso ao Cloudflare/D1 do dono.)

-- =====================================================================
-- Autores (decisao #4: tabela desacoplada de `users`, evita password_hash NOT NULL)
-- =====================================================================
CREATE TABLE IF NOT EXISTS authors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  email TEXT,
  bio TEXT,
  avatar_url TEXT,
  source_connector TEXT,   -- de onde veio (ex: 'wordpress-xml'); NULL = nativo
  source_id TEXT,          -- id do autor na origem
  user_id TEXT,            -- vinculo opcional com users(id) se virar editor real
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_authors_slug ON authors(slug);
CREATE INDEX IF NOT EXISTS idx_authors_source ON authors(source_connector, source_id);

-- =====================================================================
-- Jobs de migracao (import | sync | export). Estado compartilhado CLI <-> Worker.
-- =====================================================================
CREATE TABLE IF NOT EXISTS import_jobs (
  id TEXT PRIMARY KEY,
  connector_id TEXT NOT NULL,          -- 'wordpress-xml' | 'ghost' | ...
  mode TEXT NOT NULL DEFAULT 'import', -- 'import' | 'sync' | 'export'
  status TEXT NOT NULL DEFAULT 'pending', -- pending|running|paused|failed|completed
  totals TEXT,                          -- JSON: { posts, media, done, errors, warnings }
  cursor TEXT,                          -- JSON: SyncCursor (sync incremental)
  config TEXT,                          -- JSON: ConnectorConfig (sem segredos)
  created_by TEXT,                      -- users(id)
  error TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_import_jobs_status ON import_jobs(status);

-- =====================================================================
-- Checkpoints (retomada por estagio/chunk). Idempotencia do pipeline.
-- =====================================================================
CREATE TABLE IF NOT EXISTS import_checkpoints (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  stage TEXT NOT NULL,                  -- nome do estagio (connect..import)
  chunk_index INTEGER NOT NULL DEFAULT 0,
  last_source_id TEXT,
  state TEXT,                           -- JSON opaco do estagio
  created_at INTEGER NOT NULL,
  FOREIGN KEY (job_id) REFERENCES import_jobs(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_checkpoints_job ON import_checkpoints(job_id, stage);

-- =====================================================================
-- Mapeamento origem->destino (idempotencia, sync por hash, dedup, checkpoint de midia)
-- =====================================================================
CREATE TABLE IF NOT EXISTS source_map (
  id TEXT PRIMARY KEY,
  connector_id TEXT NOT NULL,
  source_id TEXT NOT NULL,              -- id do item na origem
  kind TEXT NOT NULL DEFAULT 'post',    -- 'post' | 'page' | 'media' | 'author' | 'category'
  dest_slug TEXT,                       -- slug/arquivo de destino (posts) ou chave R2 (media)
  content_hash TEXT,                    -- hash do corpo canonico (sync de texto)
  media_hash TEXT,                      -- hash dos bytes (sync/dedup de midia)
  media_status TEXT,                    -- 'downloaded' | 'stored' | 'failed' (checkpoint por imagem)
  original_url TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_source_map ON source_map(connector_id, source_id, kind);
CREATE INDEX IF NOT EXISTS idx_source_map_hash ON source_map(content_hash);

-- =====================================================================
-- Redirects 301 (servidos via _redirects em baixo volume; via D1 dinamico em escala)
-- =====================================================================
CREATE TABLE IF NOT EXISTS redirects (
  id TEXT PRIMARY KEY,
  old_url TEXT NOT NULL,
  new_url TEXT NOT NULL,
  status INTEGER NOT NULL DEFAULT 301,
  job_id TEXT,
  created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_redirects_old ON redirects(old_url);

-- =====================================================================
-- Auditoria (toda mutacao destrutiva do engine). Retencao/anonimizacao: ver doc secao 6.8.
-- =====================================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  action TEXT NOT NULL,
  entity TEXT,
  entity_id TEXT,
  before_json TEXT,
  after_json TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);

-- =====================================================================
-- Relatorios de import (agregados por chunk)
-- =====================================================================
CREATE TABLE IF NOT EXISTS import_reports (
  job_id TEXT PRIMARY KEY,
  metrics TEXT,                         -- JSON: MigrationReport
  generated_at INTEGER NOT NULL,
  FOREIGN KEY (job_id) REFERENCES import_jobs(id) ON DELETE CASCADE
);

-- =====================================================================
-- Enriquecimento por IA (opcional, aprovavel; nunca altera original sem aprovacao)
-- =====================================================================
CREATE TABLE IF NOT EXISTS ai_enrichments (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL,
  kind TEXT NOT NULL,                   -- metaTitle|metaDescription|faq|tldr|altText|...
  suggestion TEXT,                      -- JSON
  status TEXT NOT NULL DEFAULT 'pending', -- pending|approved|rejected
  approved_by TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_ai_enrich_slug ON ai_enrichments(slug, status);

-- =====================================================================
-- posts_meta: estado de compensacao Git<->D1 (doc secao 2.5). Git-primeiro com write-ahead.
-- =====================================================================
ALTER TABLE posts_meta ADD COLUMN git_sync_status TEXT DEFAULT 'committed'; -- pending|committed|failed
ALTER TABLE posts_meta ADD COLUMN sync_retry_count INTEGER DEFAULT 0;
