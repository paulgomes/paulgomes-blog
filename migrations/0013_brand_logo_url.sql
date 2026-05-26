-- Permite cadastrar logo da marca (alem do nome textual).
-- Marcas com logo_url renderizam <img> no marquee; sem logo_url, renderizam nome.

ALTER TABLE brands ADD COLUMN logo_url TEXT;
