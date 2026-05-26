// SECAO ENTRE MARKERS GERADA AUTOMATICAMENTE pelo painel (/api/categorias/sync).
// NAO EDITAR A MAO — use /painel/categorias pra alterar.
// O resto do arquivo (SLUG_TO_CATEGORIA derivado) eh preservado pelo sync.

// <CATEGORIAS_BEGIN>
export const CATEGORIAS = ['IA', 'GEO', 'SEO', 'Branding', 'Tecnologia', 'Negócios', 'EM ALTA'] as const;
export type Categoria = typeof CATEGORIAS[number];

export const CATEGORIA_SLUGS: Record<Categoria, string> = {
  'IA': 'ia',
  'GEO': 'geo',
  'SEO': 'seo',
  'Branding': 'branding',
  'Tecnologia': 'tecnologia',
  'Negócios': 'negocios',
  'EM ALTA': 'em-alta',
};

export const CATEGORIA_COLORS: Record<Categoria, { bg: string; fg: string }> = {
  'IA': { bg: '#0103F9', fg: '#ffffff' },
  'GEO': { bg: '#0102CC', fg: '#ffffff' },
  'SEO': { bg: '#0077a3', fg: '#ffffff' },
  'Branding': { bg: '#005f86', fg: '#ffffff' },
  'Tecnologia': { bg: '#1f2937', fg: '#ffffff' },
  'Negócios': { bg: '#4b5563', fg: '#ffffff' },
  'EM ALTA': { bg: '#6b7280', fg: '#ffffff' },
};
// <CATEGORIAS_END>

// Inverso: slug → label
export const SLUG_TO_CATEGORIA: Record<string, Categoria> = Object.fromEntries(
  Object.entries(CATEGORIA_SLUGS).map(([k, v]) => [v, k])
) as Record<string, Categoria>;
