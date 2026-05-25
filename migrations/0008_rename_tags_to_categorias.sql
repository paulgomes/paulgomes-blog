-- K1: Renomeia posts_meta.tags -> posts_meta.categorias.
--
-- SQLite suporta RENAME COLUMN desde 3.25 (2018). D1 usa SQLite mais novo.
-- Approach: ALTER TABLE RENAME COLUMN (1 linha, atomic, sem downtime).
--
-- ATENCAO: NAO rodar no remoto sem ter aplicado a refatoracao de codigo (K2)
-- que vai trocar referencias a "tags" por "categorias" nas queries SQL e no
-- frontmatter dos .md. Senao build/runtime quebram.
--
-- Rollback (se necessario): ALTER TABLE posts_meta RENAME COLUMN categorias TO tags;

ALTER TABLE posts_meta RENAME COLUMN tags TO categorias;
