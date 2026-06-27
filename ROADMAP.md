# ROADMAP

Backlog priorizado da Core Platform. Ordem: **maior impacto / menor risco → menor**.
Regra de ouro: site no ar e build verde a cada fatia. Fatias verticais pequenas e completas.
Princípios de decisão (desempate): não quebrar SEO > nativo Cloudflare > multi-tenant já > type safety > performance/GEO > manutenção em 10 anos.

> Legenda: 🟢 baixo risco · 🟡 médio · 🔴 alto/refactor · ⛔ depende da `FILA-HUMANA`.

---

## FASE 1 — Fundação de configuração (desacoplar o tenant) 🟢→🟡
**Por quê primeiro:** os 19+ literais `https://paulgomes.com.br` e a identidade hardcoded são a raiz que **bloqueia multi-tenant** e ainda **ameaçam o limite #1** (se o domínio mudar, canonical/sitemap/RSS quebram). Resolver isto destrava quase todo o resto, com risco baixo se a saída do build ficar idêntica.

- **1.1** Criar `src/config/site.ts` — fonte única tipada (domínio, marca, autor, social, GSC, R2 domain). Hoje 1 tenant; estrutura já no formato `TenantConfig`. ✅ critério: build idêntico byte-a-byte.
- **1.2** Migrar consumidores para o config, fatia por fatia, verificando o `dist/` a cada um: `schema.ts` → `BaseHead` → `BlogPost`/breadcrumb → `llms*.ts`/`video-sitemap`/`rss` → páginas/LP/painel. Canonical e URLs **não podem mudar**.
- **1.3** Centralizar identidade visível: `consts.ts` passa a derivar do config (sem quebrar imports).
- **Saída:** zero domínio hardcoded; trocar de tenant = trocar 1 objeto de config.

## FASE 2 — Camada i18n (zero hardcode) 🟡
**Por quê:** mandato PT-BR/EN/ES, "não hardcode textos". Migração incremental, pt-BR como default (sem mudar URL/SEO dos posts existentes → respeita limite #1).
- **2.1** `src/i18n/` — dicionários tipados por locale + helper `t(key, locale)` + tipos que garantem chave existente em build. Nativo (sem lib externa).
- **2.2** Config de roteamento i18n do Astro; `lang`/`og:locale`/`inLanguage` derivados do locale.
- **2.3** Migrar strings por camada: componentes públicos → páginas → painel → respostas de API → emails. `seo-analyzer` (stopwords/power words) por locale.
- **2.4** `FormattedDate` locale-aware.
- ⛔ Decisão de negócio: estratégia de URL por idioma (subpath `/en/` vs domínio) entra na `FILA-HUMANA`.

## FASE 3 — Backend limpo + hardening (SOLID, segurança) 🟡
- **3.1** Extrair util único de `slugify` (remove a cópia do `editor.astro`).
- **3.2** Helper único de sync D1→Git (`_utils/github.ts`) usado por publish/sync/feature; tratamento de falha uniforme + compensação (evita órfão).
- **3.3** **RBAC:** `requireRole()` + `author_id` (autor só edita o próprio). Protege limite #6.
- **3.4** **Rate-limit** por IP em `/api/contact` e `/api/newsletter` (KV nativo). ⛔ precisa de KV namespace (FILA-HUMANA item 4).
- **3.5** **Audit log** (`audit_logs`: user, ação, antes/depois) — rastreabilidade.
- **3.6** Normalizar `categorias` no D1 (tabela de junção ou validação server-side) + migração de rename de categoria que atualiza `posts_meta` (protege build-verde).
- **3.7** CSRF (SameSite=Strict / token) nos endpoints de estado.

## FASE 4 — Modelo de dados multi-tenant 🔴 ⛔
**Pré-requisitos:** Fases 1–3 + decisões de negócio (mono-repo vs repo-por-tenant; subdomínio vs domínio próprio; build-por-tenant vs SSR híbrido) — `FILA-HUMANA` item 5.
- **4.1** `tenant_id` em todas as tabelas D1 + índices; migração não-destrutiva (tenant atual = `paulgomes`).
- **4.2** Resolução **domínio→tenant** (Host header no middleware) + isolamento nas queries.
- **4.3** Config por tenant em D1 (marca, domínio, SEO, social, paleta, logo, GSC).
- **4.4** R2 com prefixo por tenant; categorias/menus/brands/schema por tenant.
- **4.5** Pipeline de build por tenant (ou loader de Content Layer por tenant).
- **4.6** Repositories/services por domínio (camada limpa, baixo acoplamento).

## FASE 5 — SEO/GEO automático + qualidade (impacto, baixo risco) 🟢
Itens concretos já mapeados (auditoria de 7 dimensões + render):
- **5.1** Usar `metaTitle`/`metaDescription`/`focusKeyword` do frontmatter no `BlogPost` (campos hoje ignorados — ganho de SEO imediato).
- **5.2** `RelatedPosts` ("Leia também") por categoria no fim do artigo (internal linking + dwell time).
- **5.3** Link interno para a LP de Sorocaba (hoje órfã do menu).
- **5.4** Paginação SSR de `/blog` (`/blog/pagina/[n]`) — páginas 2+ hoje não têm URL/ranqueiam.
- **5.5** Skip-link (WCAG 2.4.1) + focus-visible (Header/carrossel) + aria nos ícones.
- **5.6** Limpar/preencher descriptions vazias e quebradas; tratar 4 posts thin (expandir ou 301).
- **5.7** Schema automático por tipo de conteúdo (HowTo/FAQ/Video) + sitemap `lastmod`.
- **5.8** AVIF, subset de fonte, og:image por página.

## FASE 6+ — Visão de longo prazo (épicos)
- **Editor de blocos** (Notion-like): slash commands, callouts, tabelas, embeds, code highlight, Mermaid, TOC, blocos reutilizáveis, templates; parser HTML↔MD real (substitui regex).
- **GEO/AEO:** content chunking, answer blocks/TL;DR/key points automáticos, entity linking, citation optimization.
- **Performance:** server islands, partial hydration, edge cache + purge no publish, prefetch.
- **CMS/workflow:** histórico/versões, comparação, duplicar, autosave robusto, aprovação editorial, preview mobile/desktop.
- **Analytics:** dashboard unificado (GSC + GA4 + Cloudflare Analytics).
- **IA nativa:** geração de título/slug/meta/resumo/FAQ/schema/alt/categorias/links internos.
- **Design system:** tokens completos + theming por tenant.

---

## Sequenciamento e dependências
- **Fase 1** não depende de ninguém → começa **já**.
- **Fase 5** é paralela e de baixo risco (pode intercalar entre fases pesadas para entregar valor de SEO contínuo).
- **Fases 4** e partes da **3** dependem da `FILA-HUMANA` (KV, decisões de arquitetura multi-tenant).
- Nada de big-bang: cada fase migra incrementalmente com o site no ar.
