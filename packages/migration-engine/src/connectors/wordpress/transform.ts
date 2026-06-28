/**
 * Conversao WP item (RawEntity.raw) -> CanonicalPost. Vive no nucleo do conector,
 * mas e funcao PURA (sem I/O): recebe o item e o mapa de categorias, devolve canonico.
 */
import type { CanonicalPost } from '../../core/types/canonical.js';
import type { WpItem, WpCategory } from './xml.js';
import { htmlToMarkdown } from '../../core/transformers/html.js';
import { markdownToBlocks } from '../../core/transformers/blocks.js';
import { slugify } from '../../core/utils/slugify.js';
import { contentHash } from '../../core/utils/hash.js';
import { mapCategories } from '../../core/validators/categories.js';

function toArray<T>(v: T | T[] | undefined | null): T[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

/** Extrai texto de string | {#text} | {__cdata}. */
function text(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if (typeof o['__cdata'] === 'string') return o['__cdata'];
    if (typeof o['#text'] === 'string') return o['#text'];
    if (typeof o['#text'] === 'number') return String(o['#text']);
  }
  return '';
}

/** "2023-08-14 20:00:00" (gmt) -> ISO; fallback para pubDate RFC822. */
function wpDateToIso(item: WpItem): string | null {
  const gmt = text(item['wp:post_date_gmt']);
  if (gmt && !gmt.startsWith('0000')) {
    const d = new Date(gmt.replace(' ', 'T') + 'Z');
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  const local = text(item['wp:post_date']);
  if (local && !local.startsWith('0000')) {
    const d = new Date(local.replace(' ', 'T'));
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  const pub = text(item.pubDate);
  if (pub) {
    const d = new Date(pub);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return null;
}

function splitTaxonomy(cats: WpCategory[]): { categories: string[]; tags: string[] } {
  const categories: string[] = [];
  const tags: string[] = [];
  for (const c of cats) {
    const name = text(c['#text']) || text((c as unknown as Record<string, unknown>)['__cdata']);
    if (!name) continue;
    if (c['@_domain'] === 'post_tag') tags.push(name);
    else categories.push(name); // 'category' (ou ausente)
  }
  return { categories, tags };
}

function stripMarkdown(s: string): string {
  return s
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#*_`>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function deriveDescription(item: WpItem, bodyMd: string): string {
  const excerpt = stripMarkdown(htmlToMarkdown(text(item['excerpt:encoded'])));
  const base = excerpt || stripMarkdown(bodyMd);
  if (base.length <= 160) return base;
  const cut = base.slice(0, 157);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 80 ? cut.slice(0, lastSpace) : cut).trim() + '…';
}

export interface WpTransformOptions {
  /** mapa categoria-da-origem -> categoria do enum. */
  categoryMapping: Record<string, string>;
  /** enum permitido (lido de src/lib/categorias.ts). */
  allowedCategories: readonly string[];
}

export function wpItemToCanonical(item: WpItem, opts: WpTransformOptions): CanonicalPost {
  const title = text(item.title);
  const slug = text(item['wp:post_name']) || slugify(title);
  const html = text(item['content:encoded']);
  const bodyMd = htmlToMarkdown(html);
  const body = markdownToBlocks(bodyMd);

  const { categories, tags } = splitTaxonomy(toArray(item.category));
  const { mapped, unmapped } = mapCategories(categories, opts.categoryMapping, opts.allowedCategories);

  const publishedAt = wpDateToIso(item);
  const description = deriveDescription(item, bodyMd);

  const warnings = [];
  if (unmapped.length) {
    warnings.push({
      level: 'warning' as const,
      code: 'CATEGORY_UNMAPPED',
      message: `Categorias sem mapeamento (ignoradas): ${unmapped.join(', ')}`,
    });
  }
  const status = body.length === 0 ? 'empty' : unmapped.length ? 'needs-review' : 'ok';

  return {
    sourceId: text(item['wp:post_id']) || slug,
    slug,
    originalUrl: text(item.link) || null,
    title,
    description,
    body,
    bodyFormat: 'markdown',
    publishedAt,
    updatedAt: text(item['wp:post_modified']) ? new Date(text(item['wp:post_modified']).replace(' ', 'T')).toISOString() : null,
    rawCategories: categories,
    mappedCategories: mapped,
    rawTags: tags,
    authorRef: text(item['dc:creator']) ? { sourceId: text(item['dc:creator']), name: text(item['dc:creator']) } : null,
    heroMedia: null, // featured image via _thumbnail_id/attachment — Fase 2
    inlineMedia: [],
    seo: {},
    contentHash: contentHash(bodyMd),
    status,
    warnings,
  };
}
