# i18n — Fundação PT/EN (aditiva, ainda não adotada)

Este diretório é **apenas a infraestrutura** de internacionalização. Ele **não
traduz o site** nem é consumido por nenhuma página hoje. O blog público continua
**100% em PT**, com as mesmas URLs, o mesmo SEO e o mesmo comportamento de antes.

> Regra de ouro: PT (`pt`) é o idioma padrão e a **fonte de verdade**. Nada aqui
> deve alterar o site PT atual. Adote por partes, sem big-bang.

## O que existe

- **`ui.ts`** — dicionários tipados `{ pt, en }`. As chaves vivem em `pt`
  (fonte de verdade); `en` é validado em compile-time via `satisfies` para não
  faltar/sobrar chave. Exporta `type Lang = 'pt' | 'en'` e `DEFAULT_LANG = 'pt'`.
- **`index.ts`** — helpers sem dependências:
  - `useTranslations(lang)` → retorna `t(key)` com **fallback para PT**.
  - `getLangFromUrl(url)` → lê o prefixo `/en/` do pathname; default `pt`.
  - `isLang(value)` → type guard.

```ts
import { useTranslations, getLangFromUrl } from '../i18n';

const lang = getLangFromUrl(Astro.url); // 'pt' por padrão
const t = useTranslations(lang);
t('blog.leia_tambem'); // 'Leia também' (pt) | 'Read also' (en)
```

## Como adotar incrementalmente (sem quebrar o PT)

1. **Trocar strings hardcoded por `t(...)` — só em PT, primeiro.**
   Num componente, use `useTranslations('pt')` (ou `getLangFromUrl`, que já
   resolve para `pt`). O texto renderizado fica idêntico ao de hoje; você só
   centralizou a string. Zero mudança de URL, zero mudança de SEO.

2. **Adicionar páginas EN sob `/en/` — como rotas NOVAS.**
   Crie `src/pages/en/...` espelhando as páginas que quiser traduzir. As rotas
   PT existentes (`/sobre/`, `/categoria/...`) **não mudam**. `getLangFromUrl`
   passa a devolver `'en'` apenas dentro de `/en/`.

3. **`hreflang` e `<html lang>` — só quando houver par PT↔EN real.**
   Ao publicar uma página EN equivalente a uma PT, adicione `hreflang` ligando
   as duas (e `x-default` apontando para PT). Enquanto não houver o par, **não**
   emita `hreflang` — evita sinal de SEO inconsistente.

4. **Expandir os dicionários conforme a necessidade.**
   Acrescente chaves em `pt` (e o TypeScript exige a tradução `en`
   correspondente). Comece pelas strings comuns já cobertas: nav do painel,
   `Leia também`, `Compartilhar`, `Autor`, `min de leitura`.

## O que NÃO fazer

- **Não** prefixar/redirecionar as rotas PT atuais (nada de `/pt/...`). PT é o
  raiz e deve continuar assim para preservar canonical, `_redirects` e sitemap.
- **Não** emitir `hreflang` para idioma sem página equivalente publicada.
- **Não** assumir que `en` está completo: é tradução de referência inicial, não
  uma tradução final revisada do site.

## Escopo

Isto é **fundação, não tradução completa**. O conjunto de strings é pequeno e
intencionalmente focado nas comuns de UI. A tradução de conteúdo (posts) e a
cobertura total de UI são trabalho futuro, fora desta base.
