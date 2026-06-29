/**
 * Dicionários de UI para internacionalização (i18n) — PT/EN.
 *
 * FUNDAÇÃO ADITIVA: este arquivo NÃO é consumido por nenhuma página ainda.
 * Ele apenas estabelece a estrutura tipada para adoção incremental no futuro.
 * O site público continua 100% em PT — `pt` é o idioma padrão e a fonte de verdade.
 *
 * As strings em `pt` espelham o texto já usado nos componentes/painel reais
 * (ex: 'Leia também', 'Compartilhar', nav do painel). As de `en` são traduções
 * de referência. Veja `src/i18n/README.md` para como adotar sem quebrar o PT.
 */

/** Idiomas suportados. `pt` é o default e a fonte de verdade. */
export type Lang = 'pt' | 'en';

/** Idioma padrão do site. O blog público é PT-first. */
export const DEFAULT_LANG: Lang = 'pt';

/** Lista de idiomas conhecidos (útil para gerar hreflang / rotas no futuro). */
export const LANGS: readonly Lang[] = ['pt', 'en'] as const;

/**
 * Dicionário base (PT). É a fonte de verdade das chaves: toda chave que existir
 * aqui deve existir em todos os idiomas. O helper `useTranslations` usa este
 * objeto como fallback quando uma chave faltar no idioma alvo.
 */
const pt = {
  // --- Navegação do painel (espelha PainelLayout.astro) ---
  'painel.nav.home': 'Home',
  'painel.nav.posts': 'Posts',
  'painel.nav.novo': 'Novo post',
  'painel.nav.importar': 'Importar',
  'painel.nav.categorias': 'Categorias',
  'painel.nav.menus': 'Menus',
  'painel.nav.marcas': 'Marcas',
  'painel.nav.stats': 'Estatísticas',

  // --- Ações comuns do painel ---
  'painel.acao.salvar': 'Salvar',
  'painel.acao.cancelar': 'Cancelar',
  'painel.acao.criar': 'Criar',
  'painel.acao.editar': 'Editar',
  'painel.acao.excluir': 'Excluir',
  'painel.estado.carregando': 'Carregando...',

  // --- Strings públicas do blog (espelham os componentes reais) ---
  'blog.leia_tambem': 'Leia também',
  'blog.compartilhar': 'Compartilhar',
  'blog.autor': 'Autor',
  'blog.min_de_leitura': 'min de leitura',
} as const;

/** Chaves válidas do dicionário (derivadas da fonte de verdade PT). */
export type UIKey = keyof typeof pt;

/**
 * Tradução de referência (EN). Cobre as mesmas chaves de `pt`.
 * `satisfies Record<UIKey, string>` garante, em tempo de compilação, que
 * nenhuma chave foi esquecida nem inventada.
 */
const en = {
  // --- Painel nav ---
  'painel.nav.home': 'Home',
  'painel.nav.posts': 'Posts',
  'painel.nav.novo': 'New post',
  'painel.nav.importar': 'Import',
  'painel.nav.categorias': 'Categories',
  'painel.nav.menus': 'Menus',
  'painel.nav.marcas': 'Brands',
  'painel.nav.stats': 'Statistics',

  // --- Painel ações ---
  'painel.acao.salvar': 'Save',
  'painel.acao.cancelar': 'Cancel',
  'painel.acao.criar': 'Create',
  'painel.acao.editar': 'Edit',
  'painel.acao.excluir': 'Delete',
  'painel.estado.carregando': 'Loading...',

  // --- Public blog ---
  'blog.leia_tambem': 'Read also',
  'blog.compartilhar': 'Share',
  'blog.autor': 'Author',
  'blog.min_de_leitura': 'min read',
} satisfies Record<UIKey, string>;

/**
 * Mapa idioma → dicionário. Tipado de forma que todo idioma exponha o mesmo
 * conjunto de chaves de `pt`.
 */
export const ui: Record<Lang, Record<UIKey, string>> = {
  pt,
  en,
};
