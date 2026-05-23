export const TAGS = ['IA', 'GEO', 'SEO', 'Branding', 'Tecnologia', 'Negócios'] as const;
export type Tag = typeof TAGS[number];

export const TAG_SLUGS: Record<Tag, string> = {
  'IA': 'ia',
  'GEO': 'geo',
  'SEO': 'seo',
  'Branding': 'branding',
  'Tecnologia': 'tecnologia',
  'Negócios': 'negocios',
};

// Inverso: slug → label
export const SLUG_TO_TAG: Record<string, Tag> = Object.fromEntries(
  Object.entries(TAG_SLUGS).map(([k, v]) => [v, k])
) as Record<string, Tag>;

// Cores ciano-derivadas pra chips (light + dark)
export const TAG_COLORS: Record<Tag, { bg: string; fg: string }> = {
  'IA':         { bg: '#00b4d8', fg: '#ffffff' },
  'GEO':        { bg: '#0096b8', fg: '#ffffff' },
  'SEO':        { bg: '#0077a3', fg: '#ffffff' },
  'Branding':   { bg: '#005f86', fg: '#ffffff' },
  'Tecnologia': { bg: '#1f2937', fg: '#ffffff' },
  'Negócios':   { bg: '#4b5563', fg: '#ffffff' },
};
