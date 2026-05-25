-- K2 complement: renomeia drafts.tags -> drafts.categorias.
-- (K1 cobriu posts_meta apenas. Drafts tambem precisa pro refactor de
-- codigo funcionar end-to-end.)
--
-- Rodar JUNTO com 0008 na janela de deploy K3.
-- Rollback: ALTER TABLE drafts RENAME COLUMN categorias TO tags;

ALTER TABLE drafts RENAME COLUMN tags TO categorias;
