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
