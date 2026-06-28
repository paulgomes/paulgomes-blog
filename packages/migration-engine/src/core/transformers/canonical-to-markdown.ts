/**
 * Renderer CanonicalPost -> arquivo .md nativo (Exporter 'markdown').
 * Frontmatter espelha functions/api/_utils/github.ts:buildMarkdown.
 * Data ORIGINAL preservada (normalizeDate), nunca "agora".
 */
import type { CanonicalPost } from '../types/canonical.js';
import type { Exporter, ExportArtifact } from '../types/connector.js';
import { buildFrontmatter, normalizeDate } from '../utils/frontmatter.js';
import { blocksToMarkdown } from './blocks.js';

export function renderMarkdown(post: CanonicalPost): string {
  const fm = buildFrontmatter({
    title: post.title,
    description: post.description,
    pubDate: normalizeDate(post.publishedAt),
    updatedDate: post.updatedAt ? normalizeDate(post.updatedAt) : null,
    categorias: post.mappedCategories,
    heroImage: post.heroMedia ? (post.heroMedia.destUrl ?? post.heroMedia.sourceUrl) : null,
    heroImageAlt: post.heroMedia?.alt ?? null,
    focusKeyword: post.seo.focusKeyword ?? null,
    metaTitle: post.seo.metaTitle ?? null,
    metaDescription: post.seo.metaDescription ?? null,
  });
  const body = blocksToMarkdown(post.body);
  return fm + body;
}

export class MarkdownExporter implements Exporter {
  readonly id = 'markdown';
  async export(post: CanonicalPost): Promise<ExportArtifact> {
    return {
      path: `src/content/blog/${post.slug}.md`,
      content: renderMarkdown(post),
      mime: 'text/markdown',
    };
  }
}
