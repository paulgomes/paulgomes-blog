-- Itens de menu (Header e Footer), hierarquia recursiva via parent_id
CREATE TABLE IF NOT EXISTS menu_items (
  id TEXT PRIMARY KEY,
  menu_type TEXT NOT NULL,            -- 'header' | 'footer'
  parent_id TEXT,                      -- NULL = raiz; ID de outro item = submenu
  label TEXT NOT NULL,
  url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  open_new_tab INTEGER NOT NULL DEFAULT 0,
  is_hidden INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (parent_id) REFERENCES menu_items(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_menu_items_type
  ON menu_items(menu_type, parent_id, sort_order);

-- Seed Header: replica menu hardcoded atual
INSERT INTO menu_items (id, menu_type, parent_id, label, url, sort_order, open_new_tab, is_hidden, created_at, updated_at) VALUES
  ('h-home',      'header', NULL, 'Home',      '/',          0, 0, 0, strftime('%s','now')*1000, strftime('%s','now')*1000),
  ('h-sobre',     'header', NULL, 'Sobre',     '/sobre',     1, 0, 0, strftime('%s','now')*1000, strftime('%s','now')*1000),
  ('h-insights',  'header', NULL, 'Insights',  '/blog',      2, 0, 0, strftime('%s','now')*1000, strftime('%s','now')*1000),
  ('h-parceiros', 'header', NULL, 'Parceiros', '/parceiros', 3, 0, 0, strftime('%s','now')*1000, strftime('%s','now')*1000),
  ('h-contato',   'header', NULL, 'Contato',   '/contato',   4, 0, 0, strftime('%s','now')*1000, strftime('%s','now')*1000);

-- Seed Footer
INSERT INTO menu_items (id, menu_type, parent_id, label, url, sort_order, open_new_tab, is_hidden, created_at, updated_at) VALUES
  ('f-home',         'footer', NULL, 'Home',                   '/',            0, 0, 0, strftime('%s','now')*1000, strftime('%s','now')*1000),
  ('f-sobre',        'footer', NULL, 'Sobre',                  '/sobre',       1, 0, 0, strftime('%s','now')*1000, strftime('%s','now')*1000),
  ('f-insights',     'footer', NULL, 'Insights',               '/blog',        2, 0, 0, strftime('%s','now')*1000, strftime('%s','now')*1000),
  ('f-parceiros',    'footer', NULL, 'Parceiros',              '/parceiros',   3, 0, 0, strftime('%s','now')*1000, strftime('%s','now')*1000),
  ('f-contato',      'footer', NULL, 'Contato',                '/contato',     4, 0, 0, strftime('%s','now')*1000, strftime('%s','now')*1000),
  ('f-privacidade',  'footer', NULL, 'Política de Privacidade','/privacidade', 5, 0, 0, strftime('%s','now')*1000, strftime('%s','now')*1000);
