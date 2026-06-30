// SECAO ENTRE MARKERS GERADA AUTOMATICAMENTE pelo painel (/api/categorias/sync).
// NAO EDITAR A MAO — use /painel/categorias pra alterar.
// O resto do arquivo (SLUG_TO_CATEGORIA derivado) eh preservado pelo sync.

// <CATEGORIAS_BEGIN>
export const CATEGORIAS = ['IA', 'GEO', 'SEO', 'Branding', 'Tecnologia', 'Negócios', 'Em Alta', 'ASI', 'Cybersecurity', 'Podcasts', 'DevOps', 'Google Ads', 'Redes Sociais', 'PALESTRAS', 'gta6'] as const;
export type Categoria = typeof CATEGORIAS[number];

export const CATEGORIA_SLUGS: Record<Categoria, string> = {
  'IA': 'ia',
  'GEO': 'geo',
  'SEO': 'seo',
  'Branding': 'branding',
  'Tecnologia': 'tecnologia',
  'Negócios': 'negocios',
  'Em Alta': 'em-alta',
  'ASI': 'asi',
  'Cybersecurity': 'cybersecurity',
  'Podcasts': 'podcasts',
  'DevOps': 'devops',
  'Google Ads': 'google-ads',
  'Redes Sociais': 'redes-sociais',
  'PALESTRAS': 'palestras',
  'gta6': 'gta6',
};

export const CATEGORIA_COLORS: Record<Categoria, { bg: string; fg: string }> = {
  'IA': { bg: '#0103F9', fg: '#ffffff' },
  'GEO': { bg: '#0102CC', fg: '#ffffff' },
  'SEO': { bg: '#0077a3', fg: '#ffffff' },
  'Branding': { bg: '#005f86', fg: '#ffffff' },
  'Tecnologia': { bg: '#1f2937', fg: '#ffffff' },
  'Negócios': { bg: '#4b5563', fg: '#ffffff' },
  'Em Alta': { bg: '#6b7280', fg: '#ffffff' },
  'ASI': { bg: '#374151', fg: '#ffffff' },
  'Cybersecurity': { bg: '#0103F9', fg: '#ffffff' },
  'Podcasts': { bg: '#0102CC', fg: '#ffffff' },
  'DevOps': { bg: '#0077a3', fg: '#ffffff' },
  'Google Ads': { bg: '#005f86', fg: '#ffffff' },
  'Redes Sociais': { bg: '#1f2937', fg: '#ffffff' },
  'PALESTRAS': { bg: '#4b5563', fg: '#ffffff' },
  'gta6': { bg: '#6b7280', fg: '#ffffff' },
};
// <CATEGORIAS_END>

// Inverso: slug → label
export const SLUG_TO_CATEGORIA: Record<string, Categoria> = Object.fromEntries(
  Object.entries(CATEGORIA_SLUGS).map(([k, v]) => [v, k])
) as Record<string, Categoria>;
