-- Marcas exibidas no marquee da home + tabela generica de site_config

CREATE TABLE IF NOT EXISTS brands (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_brands_position ON brands(position);

-- Tabela generica de configs do site (key/value).
-- Inicialmente usada pra: 'brands_marquee_title'
CREATE TABLE IF NOT EXISTS site_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Seed inicial: titulo + 10 marcas existentes (sem URL)
INSERT OR IGNORE INTO site_config (key, value, updated_at) VALUES
  ('brands_marquee_title', 'Marcas que passaram por aqui', unixepoch() * 1000);

INSERT OR IGNORE INTO brands (id, name, url, position, created_at, updated_at) VALUES
  ('brand-disney',          'Disney',          NULL, 0, unixepoch() * 1000, unixepoch() * 1000),
  ('brand-hummel',          'Hummel',          NULL, 1, unixepoch() * 1000, unixepoch() * 1000),
  ('brand-celmar',          'Celmar',          NULL, 2, unixepoch() * 1000, unixepoch() * 1000),
  ('brand-cidade-sorocaba', 'Cidade Sorocaba', NULL, 3, unixepoch() * 1000, unixepoch() * 1000),
  ('brand-peptpure',        'Peptpure',        NULL, 4, unixepoch() * 1000, unixepoch() * 1000),
  ('brand-panini-brasil',   'panini brasil',   NULL, 5, unixepoch() * 1000, unixepoch() * 1000),
  ('brand-pesca-facil',     'Pesca Facil',     NULL, 6, unixepoch() * 1000, unixepoch() * 1000),
  ('brand-15k',             '15K',             NULL, 7, unixepoch() * 1000, unixepoch() * 1000),
  ('brand-spotbook',        'Spotbook',        NULL, 8, unixepoch() * 1000, unixepoch() * 1000),
  ('brand-scrumboards',     'ScrumBoards',     NULL, 9, unixepoch() * 1000, unixepoch() * 1000);
