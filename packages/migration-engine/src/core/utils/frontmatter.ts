/**
 * Geracao de frontmatter que ESPELHA functions/api/_utils/github.ts:buildMarkdown,
 * para que o import reproduza o formato dos posts existentes (fidelidade de SEO).
 */

export interface FrontmatterInput {
  title: string;
  description?: string | null;
  /** YYYY-MM-DD (ja normalizada — ver normalizeDate). */
  pubDate: string;
  updatedDate?: string | null;
  categorias?: string[] | null;
  heroImage?: string | null;
  heroImageAlt?: string | null;
  featured?: boolean;
  focusKeyword?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
}

/** YAML string entre aspas — escapa \\ e " e quebras (igual ao yamlString do projeto). */
export function yamlString(s: string): string {
  return '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n') + '"';
}

/**
 * Normaliza um instante ISO para a data-calendario YYYY-MM-DD PRETENDIDA,
 * evitando o drift de 1 dia que toISOString() (UTC) introduz para timezones negativos.
 * Preserva a data ORIGINAL da origem (nunca usa "agora").
 */
export function normalizeDate(iso: string | null | undefined): string {
  if (!iso) return new Date(0).toISOString().slice(0, 10);
  // Se ja for YYYY-MM-DD, mantem.
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(iso);
  if (m && m[1]) return m[1];
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  // usa componentes UTC da string original (a origem ja traz a data pretendida)
  return d.toISOString().slice(0, 10);
}

export function buildFrontmatter(input: FrontmatterInput): string {
  let fm = '---\n';
  fm += `title: ${yamlString(input.title)}\n`;
  fm += `description: ${yamlString(input.description || '')}\n`;
  fm += `pubDate: ${input.pubDate}\n`;
  if (input.updatedDate) fm += `updatedDate: ${input.updatedDate}\n`;
  if (input.categorias && input.categorias.length) {
    fm += 'categorias:\n';
    for (const c of input.categorias) fm += `  - ${c}\n`;
  }
  if (input.heroImage) fm += `heroImage: ${yamlString(input.heroImage)}\n`;
  if (input.heroImageAlt) fm += `heroImageAlt: ${yamlString(input.heroImageAlt)}\n`;
  if (input.featured) fm += `featured: true\n`;
  if (input.focusKeyword) fm += `focusKeyword: ${yamlString(input.focusKeyword)}\n`;
  if (input.metaTitle) fm += `metaTitle: ${yamlString(input.metaTitle)}\n`;
  if (input.metaDescription) fm += `metaDescription: ${yamlString(input.metaDescription)}\n`;
  fm += '---\n\n';
  return fm;
}
