-- Adiciona coluna hero_image_alt em posts_meta + drafts.
-- Backfill posterior (alt = title) feito via scripts/backfill-hero-alt.mjs

ALTER TABLE posts_meta ADD COLUMN hero_image_alt TEXT;
ALTER TABLE drafts ADD COLUMN hero_image_alt TEXT;
