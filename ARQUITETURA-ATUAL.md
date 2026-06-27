# ARQUITETURA-ATUAL

Estado da plataforma **hoje** (Fase 0 · auditoria 2026-06-27, 5 agentes / 233 leituras).
Como tudo funciona, camadas, responsabilidades, dívida técnica e gargalos. Insumo do `ROADMAP.md`.

---

## 1. Visão geral

Hoje é um **blog single-tenant** (`paulgomes.com.br`, ~120 posts, 115+ migrados de WordPress) com painel editorial próprio. Posicionado para virar **Core Platform multi-tenant** (N blogs, cada um com tema/domínio/SEO/branding próprios). A base é **static-first** (Astro SSG) com um **backend serverless** (Cloudflare Pages Functions + D1 + R2). O diferencial arquitetural é o **pipeline D1→Git**: edita-se no D1, publica-se gerando arquivos no Git, e o Astro builda do Git.

**Stack:** Astro 6 (SSG, `output: static`, `format: directory`, `trailingSlash: ignore`) · Tailwind 4 · MDX · React (só no editor do painel) · Cloudflare Pages (deploy auto no push `main`) · Pages Functions · D1 (`paulgomes-painel`) · R2 (`paulgomes-uploads`) · GitHub Contents API.

---

## 2. Camadas e responsabilidades

### 2.1 Pipeline de Conteúdo (D1 → Git) — o coração
- **D1 = fonte de edição; Git = fonte do build.** Ordem sempre D1→Git.
- **Categorias:** tabela `categories` (D1) → `POST /api/categorias/sync` regenera `src/lib/categorias.ts` entre markers `<CATEGORIAS_BEGIN>/<CATEGORIAS_END>` (enum + slugs + cores) → commit no Git. O `src/content.config.ts` valida o frontmatter dos posts contra esse enum (Zod) **em build time**.
- **Posts:** `drafts` (D1) até publicar → `POST /api/drafts/[id]/publish` gera o `.md` (via `buildMarkdown` + GitHub API), insere em `posts_meta` (`ON CONFLICT(slug)`), apaga o draft. Edição de post publicado vai pro D1 e marca `git_synced=false`; `POST /api/posts/[slug]/sync` regenera o `.md` e marca `synced_at`.
- Arquivos-chave: `src/content.config.ts`, `src/lib/categorias.ts`, `functions/api/categorias/sync.ts`, `functions/api/drafts/[id]/publish.ts`, `functions/api/posts/[slug]/sync.ts`, `functions/api/_utils/github.ts` (`commitFile`/`deleteFile`/`buildMarkdown`), `functions/api/_utils/slugify.ts`.

### 2.2 Superfície de API (Pages Functions, ~30 endpoints)
- **Gate de auth:** `functions/_middleware.ts` valida sessão (cookie HttpOnly, 7 dias) e protege `/painel/*` e `/api/*` **exceto allowlist** (`/api/auth/login`, `/api/auth/me`, `/api/newsletter/*`, `/api/contact`, `/api/weather`).
- **Conteúdo:** posts (CRUD + sync + feature + restore + purge + sync-all), drafts (CRUD + publish).
- **Metadados:** categorias, brands (reorder/title/sync), menus (hierárquico, detecção de ciclo).
- **Públicos:** newsletter (Resend, double opt-in), contact (Email Service + honeypot + escape HTML), weather (proxy Open-Meteo... hoje client-side), stats.
- **Mídia:** `upload.ts` (multipart → R2, path `YYYY/MM/uuid.ext`, valida tipo, 10MB no client).
- **Utils:** `_utils/{auth,crypto,db,github,slugify,menus,require-auth}.ts`.

### 2.3 Painel + Editor (Astro static + React island)
- 8 páginas em `src/pages/painel/*` (index, login, posts/index, posts/editor, categorias, menus, marcas, stats). **Zero SSR** — cada página chama a API por `fetch`.
- **Editor:** `src/components/painel/Editor.tsx` (TipTap, React `client:load`) + `editor.astro` (autosave 1.5s, SEO analyzer, featured toggle). Conversão HTML→Markdown via **regex** (`htmlToMarkdown`).
- **SEO analyzer client-side:** `src/lib/seo-analyzer.ts` (TF-IDF, stopwords/power words PT-BR).
- **Design tokens do painel:** `src/styles/painel.css` (~3.5k linhas).

### 2.4 Render + SEO/GEO (Astro SSG)
- Roteamento: `[...slug].astro` (posts na raiz, via `getStaticPaths`), `blog/index.astro`, `categoria/[categoria].astro`, `index.astro`, páginas estáticas, LP de Sorocaba.
- **`<head>` global:** `BaseHead.astro` (meta/OG/Twitter/canonical + **grafo JSON-LD WebSite/Organization/Person**, recém-adicionado).
- **Post:** `BlogPost.astro` (Article + BreadcrumbList + ImageObject, tempo de leitura, share).
- **Feeds:** `rss.xml.js`, sitemap (plugin no `astro.config.mjs`, exclui `/painel`), `video-sitemap.xml.ts`, `llms.txt.ts` + `llms-full.txt.ts`.
- **Menus:** `src/data/menu-{header,footer}.json` gerados do D1.

---

## 3. Fluxo de dados (publish lifecycle)
```
Painel (draft) --PUT /api/drafts/:id--> D1.drafts
   |  publicar
   v
POST /api/drafts/:id/publish
   ├─ buildMarkdown(draft) → GitHub Contents API (commit .md)
   ├─ INSERT posts_meta ON CONFLICT(slug)
   └─ DELETE draft
   |  push main
   v
Cloudflare Pages → npm run build
   ├─ getCollection('blog') lê src/content/blog/*.md
   ├─ Zod valida categorias contra src/lib/categorias.ts (gerado do D1)
   │     └─ se D1 e Git divergem no enum → BUILD QUEBRA
   └─ HTML estático
```
**Circular crítico:** categoria nova no D1 → `sync` regenera `categorias.ts` → push → build revalida enum.

---

## 4. Limites invioláveis — onde vivem no código
1. **Posts continuam buildando/ranqueando:** `_redirects` (301 legados, alvos com barra = 1 hop), canonical auto-referente em `BaseHead`, sitemap/RSS/schema. URL antiga sempre resolve.
2. **Build verde:** o enum Zod (`content.config.ts` × `categorias.ts`) é o ponto frágil. **D1→Git sempre.**
3. **D1 = edição, Git = build:** `git_synced`/`synced_at` rastreiam divergência; `sync` reconcilia.
4. **Painel é static + Functions (não SSR):** todo o painel é `fetch` → `/api/*`.
5. **Deploy auto no push `main`** (integração GitHub ↔ Cloudflare Pages).
6. **Allowlists de middleware:** endpoint novo sob path liberado (`/api/newsletter/*`) precisa proteção explícita.

---

## 5. Dívida técnica priorizada

| Sev | Item | Onde | Impacto |
|---|---|---|---|
| 🔴 alta | **Domínio `paulgomes.com.br` hardcoded em 19+ arquivos** | schema.ts, BaseHead, BlogPost, [...slug], categoria, llms*.ts, video-sitemap, contact/newsletter, painel, LP | Bloqueia multi-tenant E é risco ao limite #1 se o domínio mudar (canonical/sitemap/RSS quebram) |
| 🔴 alta | **Enum de categorias em arquivo único + markers** | categorias.ts, categorias/sync.ts | Frágil pra N tenants; risco ao build-verde se sync falhar |
| 🔴 alta | **Sem RBAC** (qualquer user autenticado faz tudo) | _middleware.ts, functions/api/* | Multi-user inseguro: editor apaga post de outro |
| 🔴 alta | **Sem i18n** (200+ strings PT-BR hardcoded) | componentes, páginas, API, emails, painel, seo-analyzer | Bloqueia mandato PT/EN/ES |
| 🔴 alta | **D1+Git não-atômico** (sem rollback) | publish.ts, sync.ts | Se commit Git OK e D1 falha (ou vice-versa) → estado órfão |
| 🟡 média | **`metaTitle`/`metaDescription`/`focusKeyword` do frontmatter IGNORADOS** | BlogPost.astro | Campos de SEO preenchidos mas não usados (desperdício) |
| 🟡 média | **Sem rate-limit** em `/api/contact` e `/api/newsletter` | contact.ts, newsletter/subscribe.ts | Spam/custo (Resend/Email Service cobram por envio) |
| 🟡 média | **`htmlToMarkdown` por regex** (frágil) | Editor.tsx | Perde formatação em HTML aninhado; rumo a editor de blocos pede parser real |
| 🟡 média | **`slugify` duplicado** (functions × editor.astro) | _utils/slugify.ts, editor.astro | Divergência → slug D1 ≠ slug .md → conteúdo perdido |
| 🟡 média | **`categorias` é JSON string em D1** (sem FK/constraint) | posts_meta, drafts | Categoria deletada/renomeada deixa órfã |
| 🟡 média | **Sem audit log** | — | Não dá pra reverter/debugar edição acidental |
| 🟢 baixa | `as any` em respostas fetch; sem RelatedPosts; paginação `/blog` client-side; `FeaturedPost.astro` morto; emoji sem aria no editor; sessão sem refresh | vários | Qualidade/SEO/a11y incrementais |

---

## 6. Gargalos e riscos
- **Build-verde acoplado ao sync de categorias:** maior risco operacional. Renomear categoria no D1 sem sync → posts antigos no Git falham o Zod → site cai no próximo build. Precisa de pré-flight/migração de rename.
- **Drift D1↔Git:** edição manual no Git ou falha parcial cria fantasmas; `sync-all` mascara sem audit.
- **Single-tenant em tudo:** D1 sem `tenant_id`, R2/repo/D1/segredos únicos, branding em `consts.ts`, entidade schema fixa.
- **i18n ausente:** `<html lang="pt-BR">` fixo, og:locale fixo, ~200 strings espalhadas (UI + API + emails + painel + power/stopwords do analyzer).
- **GitHub Contents API base64 ~3.5MB:** ok hoje (posts 10–100KB), quebra com conteúdo grande/imagens inline.

---

## 7. Prontidão multi-tenant (gaps que travam a evolução)
- **Domínio:** extrair os 19+ literais para 1 fonte (config/`Astro.site`) → pré-requisito de tudo.
- **Identidade:** `consts.ts` (SITE_TITLE/AUTHOR/SOCIAL), `schema.ts` (Person/Org), logo/avatar, GSC token → config por tenant.
- **Dados:** `tenant_id` em todas as tabelas D1 + resolução domínio→tenant; R2 com prefixo por tenant; categorias/menus/brands por tenant.
- **Build:** Astro SSG é build-time (1 domínio por build). Decisão pendente (FILA-HUMANA): mono-repo multi-tenant + build por tenant vs. repo por tenant vs. SSR híbrido na borda.

## 8. Prontidão i18n (volume estimado)
- **~200 strings** visíveis hardcoded: componentes/páginas (UI), respostas de API (~80), emails, painel (~200 labels), placeholders, validações Zod, `seo-analyzer` (power/stopwords PT-BR).
- Falta: camada `t()` + dicionários tipados por locale, roteamento i18n, `lang`/`og:locale`/`inLanguage` por página, datas locale-aware (`FormattedDate`).
