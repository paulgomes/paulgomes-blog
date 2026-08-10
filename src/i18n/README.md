# i18n — PT/EN

PT (`pt`) é o idioma padrão e a **fonte de verdade**. EN vive sob `/en/` como
rotas **novas**: nenhuma URL PT muda, e canonical/`_redirects`/sitemap/RSS do
site PT seguem exatamente como antes.

> Status: **adotado** para os posts e para o chrome do site público.
> O `/painel` continua em PT (os dicionários `painel.*` existem mas ainda não
> são consumidos pelas telas).

## Peças

- **`ui.ts`** — dicionários tipados `{ pt, en }`. As chaves vivem em `pt`
  (fonte de verdade); `en` é validado em compile-time via `satisfies`, então
  esquecer uma tradução quebra o `tsc`, não a página.
- **`index.ts`** — helpers sem dependências:
  - `useTranslations(lang)` → `t(key)` com fallback para PT.
  - `getLangFromUrl(url)` → lê o prefixo `/en/`; default `pt`.
  - `postPath(slug, lang)` → `/slug/` em PT, `/en/slug/` em EN.
  - `postAlternates(slug, langs)` → pares para `hreflang`/seletor.
  - `BCP47` / `OG_LOCALE` → tags de idioma para `<html lang>`, `inLanguage`,
    `hreflang` e `og:locale`.

## Como o par PT↔EN se forma

O **slug é a chave**. Um post em `src/content/blog/<slug>.md` ganha versão EN
quando existe `src/content/blog-en/<slug>.md` — mesmo nome de arquivo.

A partir daí, e **somente** a partir daí:

- `BaseHead` emite `hreflang` `pt-BR` + `en` + `x-default` (apontando pro PT);
- `LangSwitcher` renderiza o link entre as duas versões;
- `/en/<slug>/` é gerada por `src/pages/en/[...slug].astro`.

Post sem tradução não emite `hreflang` nenhum e não mostra seletor — evita
sinal inconsistente pro Google e link para URL que não existe. A rota EN também
descarta traduções órfãs (sem original PT), então o par é sempre real nos dois
sentidos.

## Traduzindo posts

```bash
ANTHROPIC_API_KEY=sk-... npm run translate -- --dry-run   # simula, não chama API
ANTHROPIC_API_KEY=sk-... npm run translate -- --limit 5   # piloto
ANTHROPIC_API_KEY=sk-... npm run translate                # tudo que falta
npm run translate:test                                     # pipeline com fetch mockado
```

O script (`scripts/translate-posts.mjs`) é idempotente: guarda o hash do
original em `scripts/translation-manifest.json` e só retraduz o que mudou.

**Nunca traduza `categorias`.** É chave de taxonomia e o enum em
`src/lib/categorias.ts` é gate de build — categoria traduzida quebra o build.
O script preserva `categorias`, `pubDate`, `updatedDate`, `heroImage` e
`featured` byte a byte; traduz `title`, `description`, `heroImageAlt`,
`metaTitle`, `metaDescription` e `focusKeyword`, além do corpo.

## O que NÃO fazer

- **Não** prefixar/redirecionar as rotas PT atuais (nada de `/pt/...`).
- **Não** emitir `hreflang` para idioma sem página equivalente publicada.
- **Não** misturar idiomas numa mesma página (`RelatedPosts` já filtra por
  idioma; mantenha assim).
- **Não** tratar o EN como revisado: hoje é **tradução de máquina**, sinalizada
  como tal em `/en/` via `listagem.traduzido_aviso`.

## Pendente

- Chrome do `/painel` ainda em PT.
- Sem páginas EN para `/sobre`, `/contato`, `/categoria/*` — o `Header`/`Footer`
  numa página EN ainda linkam para as versões PT.
- RSS e `feed.json` continuam só-PT.
