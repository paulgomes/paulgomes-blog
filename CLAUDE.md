# CLAUDE.md — guia do projeto para assistentes de IA

Blog editorial do Paul Gomes (`paulgomes.com.br`). Este arquivo orienta o trabalho
de IA neste repositório. Documentos de estado vivem na raiz: `PROGRESS.md`,
`ROADMAP.md`, `FILA-HUMANA.md`, `DECISIONS.md`, `ARQUITETURA-ATUAL.md`.

## Stack

Astro 6 (`output: 'static'`) + React 19 + TypeScript estrito + Tailwind 4 + Zod,
hospedado no **Cloudflare Pages** com painel editorial próprio em `/painel`.
Node `>=22.12.0`. ~120 `.md` + 10 `.mdx` em `src/content/blog`.

## Arquitetura em 1 minuto

Conteúdo vive em **dois lugares**, e o fluxo canônico é **D1 → Git → Build → Deploy**:

- **Edição** → D1 (`paulgomes-painel`): `drafts`, `posts_meta`, `categories`, etc.
  Escrito pelas **Cloudflare Pages Functions** (`functions/api/**`).
- **Publicação/Render** → Git (`src/content/blog/*.{md,mdx}`): commitado via GitHub
  Contents API (`functions/api/_utils/github.ts`).
- **Mídia** → R2 (`paulgomes-uploads`, `media.paulgomes.com.br`).
- **Deploy** → push em `main` dispara rebuild automático do Cloudflare Pages.

## ⛔ LIMITES invioláveis (ler antes de mexer)

1. **SEO (#1):** não quebrar canonical / `_redirects` (301) / sitemap / RSS / JSON-LD.
   Mudança em superfície de SEO exige verificar o `dist/` (comparar antes/depois).
2. **Build verde (#2):** o enum de categorias é gate de build — `categorias` é
   `z.enum(CATEGORIAS)` (`src/lib/categorias.ts`, entre markers `CATEGORIAS_BEGIN/END`).
   **Categoria fora do enum quebra o build.** 14 válidas: IA, GEO, SEO, Branding,
   Tecnologia, Negócios, Em Alta, ASI, Cybersecurity, Podcasts, DevOps, Google Ads,
   Redes Sociais, PALESTRAS.
3. **D1 = edição, Git = build** (#3). **Painel = static + Functions, zero SSR** (#4).
4. **Push em `main` = deploy automático e irreversível** (#5). Ver ADR-001.
5. **Middleware/allowlists** (#6): endpoint novo precisa de proteção explícita em
   `functions/_middleware.ts`.

## Regra de deploy (ADR-001)

Trabalho autônomo gera **commits locais com build verde**; **push/deploy só com
autorização humana** (afeta o SEO de 115+ posts, é irreversível).

## Comandos

```bash
npm run dev       # astro dev -> localhost:4321
npm run build     # gera dist/ (~120 páginas). USAR para validar build verde
npm run preview   # serve o dist/
npm run favicons  # regenera favicons (Sharp)
```

Segredos de produção (não estão no repo; ficam no Cloudflare Pages):
`SESSION_SECRET`, `GITHUB_TOKEN`, `RESEND_API_KEY`, `EMAIL_API_TOKEN`. Bindings
`DB` (D1) e `MEDIA` (R2) em `wrangler.toml`. O site público builda 100% sem segredos.

Migrations D1 (manuais): `wrangler d1 execute paulgomes-painel --remote --file=migrations/NNNN.sql`.

## Convenções

- **Slug:** `functions/api/_utils/slugify.ts` (NFD + colapso). Fonte única.
- **Frontmatter:** gerado por `buildMarkdown` (`functions/api/_utils/github.ts`).
- **Posts sem `heroImage`:** ganham capa-fallback **#0203FC + título** + imagem OG
  gerada (`src/components/CoverFallback.astro`, `src/pages/og/[...slug].png.ts`).

## Migration Engine (`packages/migration-engine/`)

Subsistema de importação/exportação/sync entre CMSs por arquitetura de conectores.
Pacote TS **standalone** (sem `npm workspaces` — não afeta o build do site).
Doc completo: `docs/MIGRATION-ENGINE.md`. UI no painel: `/painel/importacoes`.

```bash
cd packages/migration-engine && npm install && npm run build
npm test                                    # vitest
node dist/cli/import.js --source <x.xml>     # preview -> .out/
node dist/cli/import.js --source <x.xml> --publish  # escreve em src/content/blog
npm run build:browser                        # regenera src/lib/migration-engine.browser.js
```

## Estado atual

Em transição de single-tenant → Core Platform multi-tenant (Fase 1 de 6 do ROADMAP).
Pendências priorizadas em `FILA-HUMANA.md` e `ROADMAP.md`.
