/**
 * Helpers de i18n — sem dependências, totalmente tipados.
 *
 * FUNDAÇÃO ADITIVA: nada aqui é consumido pelo site ainda. Importar este módulo
 * não altera comportamento; o objetivo é estar pronto para uso incremental.
 * Veja `src/i18n/README.md`.
 */

import { ui, DEFAULT_LANG, LANGS, type Lang, type UIKey } from './ui';

export { DEFAULT_LANG, LANGS };
export type { Lang, UIKey };

/**
 * Type guard: confirma que uma string é um `Lang` conhecido.
 */
export function isLang(value: string): value is Lang {
  return (LANGS as readonly string[]).includes(value);
}

/**
 * Retorna a função `t(key)` para o idioma dado, com fallback automático para
 * PT (`DEFAULT_LANG`) quando a chave faltar no idioma alvo. Como o tipo `UIKey`
 * cobre todas as chaves, o fallback é uma rede de segurança em runtime — não
 * deve ocorrer com chaves válidas.
 *
 * @example
 * const t = useTranslations('en');
 * t('blog.leia_tambem'); // 'Read also'
 */
export function useTranslations(lang: Lang): (key: UIKey) => string {
  const dict = ui[lang] ?? ui[DEFAULT_LANG];
  return function t(key: UIKey): string {
    return dict[key] ?? ui[DEFAULT_LANG][key];
  };
}

/**
 * Extrai o idioma a partir do primeiro segmento do pathname da URL.
 * Reconhece prefixos como `/en/` ou `/en`. Qualquer outra coisa cai no
 * `DEFAULT_LANG` (PT) — então as rotas PT atuais, sem prefixo, continuam PT.
 *
 * @example
 * getLangFromUrl(new URL('https://x.com/en/sobre/')); // 'en'
 * getLangFromUrl(new URL('https://x.com/sobre/'));    // 'pt'
 */
export function getLangFromUrl(url: URL): Lang {
  const [, first] = url.pathname.split('/');
  if (first && isLang(first)) return first;
  return DEFAULT_LANG;
}

/** Tag BCP-47 usada em `<html lang>`, `inLanguage` e `hreflang`. */
export const BCP47: Record<Lang, string> = {
  pt: 'pt-BR',
  en: 'en',
};

/** Locale no formato Open Graph (`og:locale`). */
export const OG_LOCALE: Record<Lang, string> = {
  pt: 'pt_BR',
  en: 'en_US',
};

/**
 * Monta o caminho de um post no idioma dado. PT e a raiz (`/<slug>/`) e nunca
 * ganha prefixo — preservar isso e o que mantem canonical, `_redirects` e
 * sitemap intactos. EN vive sob `/en/<slug>/`.
 *
 * @example
 * postPath('glossario-de-ia', 'pt'); // '/glossario-de-ia/'
 * postPath('glossario-de-ia', 'en'); // '/en/glossario-de-ia/'
 */
export function postPath(slug: string, lang: Lang): string {
  return lang === DEFAULT_LANG ? `/${slug}/` : `/${lang}/${slug}/`;
}

/** Descreve uma pagina equivalente em outro idioma, para hreflang/switcher. */
export interface Alternate {
  lang: Lang;
  /** Caminho absoluto no site (comeca com `/`). */
  path: string;
}

/**
 * Gera o conjunto de `hreflang` de um post que tem par PT<->EN.
 * Inclui `x-default` apontando para o PT, que e a versao canonica do conteudo.
 *
 * Só deve ser chamado quando as DUAS versoes existem de fato: emitir hreflang
 * para um idioma sem pagina publicada e sinal inconsistente pro Google.
 */
export function postAlternates(slug: string, langs: readonly Lang[]): Alternate[] {
  return langs.map((lang) => ({ lang, path: postPath(slug, lang) }));
}
