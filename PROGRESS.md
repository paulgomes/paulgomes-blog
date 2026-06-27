# PROGRESS

Log cronológico do trabalho na Core Platform. Mais recente no topo.

> Convenção: cada entrada tem data, o que foi feito, e estado do build/deploy.

---

## 2026-06-27 — Fase 0 iniciada (modo autônomo Core Platform)

- **Auditoria arquitetural multi-agente** disparada (5 subsistemas: pipeline de conteúdo D1→Git, superfície de API, painel/editor, render/SEO, prontidão multi-tenant/i18n) para gerar `ARQUITETURA-ATUAL.md` + `ROADMAP.md`.
- Inicializados os logs do modo autônomo: `PROGRESS.md`, `DECISIONS.md`, `FILA-HUMANA.md`.
- **Commitado (local, build verde, 152 páginas)** o lote SEO/GEO/segurança em 4 commits atômicos:
  - `feat(lib)`: `reading-time.ts` + `schema.ts` (grafo JSON-LD reutilizável).
  - `feat(post)`: ShareButtons + tempo de leitura no artigo.
  - `feat(geo)`: grafo global WebSite/Organization/Person, BreadcrumbList, FAQPage, Article com `@id`+ImageObject.
  - `fix(sec,seo,perf)`: `public/_headers`, `/parceiros` noindex, preconnect Open-Meteo.
- **NÃO pushado** — push/deploy aguarda autorização humana (ver `FILA-HUMANA.md`, ADR-001).

## 2026-06-25/26 — Sessão anterior (pré-mandato Core Platform)

- Correção do hero mobile (faixa vazia) — **publicada** (commit `4685079`).
- Barra de categorias em loop (marquee), card do autor "São Paulo", widget de tempo (Open-Meteo, sem chave), AdSlot (placeholder banner), selo "Projeto criado por" WYS no rodapé, LP `/agencia-de-marketing-em-sorocaba/` — **publicados** (push `4685079..b5e857f`).
- **Fix de SEO**: `_redirects` com barra final nos alvos (elimina cadeias 301→308, vira 1 hop) + reaproveita 404 com backlink → LP. Verificado em produção. **Publicado.**
- Auditoria técnica de 7 dimensões (SEO/CWV/a11y/schema/segurança/indexação/código) → base do backlock de qualidade.
