# PROGRESS

Log cronológico do trabalho na Core Platform. Mais recente no topo.

> Convenção: cada entrada tem data, o que foi feito, e estado do build/deploy.

---

## 2026-06-27 — Deploy autorizado e publicado

- Push de **11 commits** (`b5e857f..f8fe824`) → Cloudflare Pages. **Verificado em produção:** grafo JSON-LD (WebSite/Org/Person), "Leia também", headers de segurança (nosniff/Referrer-Policy/X-Frame-Options/Permissions-Policy/HSTS) e canonical intacto (limite #1 preservado). `FILA-HUMANA` item 1 resolvido.

## 2026-06-27 — Modo turbo (execução contínua, sem push)

Fatias entregues (cada uma: build verde + dist-diff em superfície de SEO + commit atômico):
- **Fase 1.2 — domínio→config:** feeds `llms.txt`/`llms-full.txt`/`video-sitemap.xml` e BreadcrumbList (post + categoria) passam a derivar o domínio de `SITE_CONFIG`. Saída byte-idêntica (llms 39 URLs, loc do video-sitemap e breadcrumbs intactos). Commits `067023f`, `4b560f1`.
- **Fase 5.2 — Leia também:** novo `RelatedPosts.astro` (ranqueia por sobreposição de categorias, fallback mais recentes), 3 cards no fim do artigo. Internal linking + dwell time. Commit `5ba5aa5`.
- **Fase 5.1 ADIADA (ver ADR-008):** `content.config.ts` não declara `metaTitle`/`metaDescription` (são descartados no build) e a auditoria achou `metaTitle` truncado com "…" em post(s); habilitar cegamente pioraria títulos → fere o princípio #1 (não quebrar SEO). Precisa de revisão de conteúdo.

Restante do ROADMAP que **não** avancei nesta sessão (motivo): Fase 2 i18n (escopo grande, ~200 strings — próxima sessão), Fase 3.4 rate-limit (⛔ precisa KV, `FILA-HUMANA`), Fase 4 multi-tenant (⛔ decisões de negócio, `FILA-HUMANA`).

## 2026-06-27 — Fase 0 concluída · Fase 1 iniciada (modo autônomo)

- **Fase 0 concluída:** `ARQUITETURA-ATUAL.md` e `ROADMAP.md` produzidos a partir da auditoria de 5 subsistemas. Roadmap priorizado em 6 fases (Fase 1 = fundação de configuração; Fase 2 = i18n; Fase 3 = backend limpo/hardening; Fase 4 = multi-tenant; Fase 5 = SEO/GEO; Fase 6+ = épicos).
- **Fase 1 · fatia 1.1 (feita):** criada a fonte única `src/config/site.ts` (`TenantConfig`) e `src/lib/schema.ts` passou a consumir domínio+identidade dela. **Build verde, saída byte-idêntica** (grafo JSON-LD e canonical inalterados — limite inviolável #1 preservado). Primeiro passo pra eliminar os 19+ literais de domínio.
- ADRs novos: ver `DECISIONS.md`.

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
