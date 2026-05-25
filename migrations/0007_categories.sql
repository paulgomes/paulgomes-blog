-- Categorias editaveis via painel (substituem o enum hardcoded em src/lib/tags.ts).
-- Endpoint /api/categories/sync regenera tags.ts a partir desta tabela.

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);
CREATE INDEX IF NOT EXISTS idx_categories_sort ON categories(sort_order);

-- Seed com as 6 atuais (mantém estado vigente)
INSERT INTO categories (id, name, slug, sort_order, created_at, updated_at) VALUES
  ('cat-ia',         'IA',         'ia',         0, strftime('%s','now')*1000, strftime('%s','now')*1000),
  ('cat-geo',        'GEO',        'geo',        1, strftime('%s','now')*1000, strftime('%s','now')*1000),
  ('cat-seo',        'SEO',        'seo',        2, strftime('%s','now')*1000, strftime('%s','now')*1000),
  ('cat-branding',   'Branding',   'branding',   3, strftime('%s','now')*1000, strftime('%s','now')*1000),
  ('cat-tecnologia', 'Tecnologia', 'tecnologia', 4, strftime('%s','now')*1000, strftime('%s','now')*1000),
  ('cat-negocios',   'Negócios',   'negocios',   5, strftime('%s','now')*1000, strftime('%s','now')*1000);
