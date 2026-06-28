/**
 * Passo 14 — publicar canonicos no formato nativo (Git-primeiro, no Anel 3 / CLI).
 *
 * - Gate de categorias DEFENSIVO (nunca grava .md com categoria fora do enum).
 * - Escreve os .md em blogDir; PULA slugs ja existentes (nunca duplica/sobrescreve,
 *   exceto com overwrite=true).
 * - Gera redirects 301 quando o slug de destino difere do caminho original,
 *   no formato real do public/_redirects (`<source> <dest> 301`), com dedup.
 *
 * NAO faz git add/commit nem push: escreve no working tree para revisao + build.
 */
import { writeFile, readFile, mkdir, access } from 'node:fs/promises';
import { join } from 'node:path';
import type { PublishablePost } from '../pipeline/import-pipeline.js';
import type { StructuredLogger } from '../types/ports.js';
import { assertCategoriesInEnum } from '../validators/categories.js';

export interface PublishOptions {
  /** caminho absoluto de src/content/blog */
  blogDir: string;
  /** caminho absoluto de public/_redirects */
  redirectsFile: string;
  /** dominio canonico, p/ derivar o caminho original de URLs absolutas. */
  siteUrl: string;
  /** enum permitido (gate). */
  allowedCategories: readonly string[];
  /** sobrescrever .md existente (default false = pula). */
  overwrite?: boolean;
  logger: StructuredLogger;
}

export interface PublishReport {
  written: string[];
  skipped: string[];
  blocked: { slug: string; reason: string }[];
  redirectsAdded: string[];
}

async function exists(p: string): Promise<boolean> {
  try { await access(p); return true; } catch { return false; }
}

/** Linha(s) de redirect 301 para um post, se o caminho original mudou. */
export function redirectLinesFor(post: PublishablePost, siteUrl: string): string[] {
  if (!post.originalUrl) return [];
  let oldPath: string;
  try {
    oldPath = new URL(post.originalUrl, siteUrl).pathname;
  } catch {
    return [];
  }
  const oldNoSlash = oldPath.replace(/\/+$/, '') || '/';
  const newPath = `/${post.slug}/`;
  // slug inalterado -> sem redirect
  if (oldNoSlash === `/${post.slug}`) return [];
  return [`${oldNoSlash} ${newPath} 301`];
}

export async function publishPosts(posts: PublishablePost[], opts: PublishOptions): Promise<PublishReport> {
  const report: PublishReport = { written: [], skipped: [], blocked: [], redirectsAdded: [] };
  await mkdir(opts.blogDir, { recursive: true });

  const redirectLines: string[] = [];

  for (const post of posts) {
    // gate defensivo (mesmo o pipeline ja filtrando): nunca gravar fora do enum.
    const gate = assertCategoriesInEnum(post.categorias, opts.allowedCategories);
    if (gate.length) {
      report.blocked.push({ slug: post.slug, reason: gate.map((g) => g.message).join('; ') });
      continue;
    }

    const dest = join(opts.blogDir, `${post.slug}.md`);
    if (!opts.overwrite && (await exists(dest))) {
      report.skipped.push(post.slug);
      continue;
    }
    await writeFile(dest, post.content, 'utf-8');
    report.written.push(post.slug);
    redirectLines.push(...redirectLinesFor(post, opts.siteUrl));
  }

  // merge de redirects (dedup contra os existentes)
  if (redirectLines.length) {
    let existing = '';
    if (await exists(opts.redirectsFile)) existing = await readFile(opts.redirectsFile, 'utf-8');
    const existingSet = new Set(existing.split('\n').map((l) => l.trim()).filter(Boolean));
    const toAdd = [...new Set(redirectLines)].filter((l) => !existingSet.has(l));
    if (toAdd.length) {
      const sep = existing && !existing.endsWith('\n') ? '\n' : '';
      const block = `\n# Migration Engine — redirects gerados\n${toAdd.join('\n')}\n`;
      await writeFile(opts.redirectsFile, existing + sep + block, 'utf-8');
      report.redirectsAdded.push(...toAdd);
    }
  }

  opts.logger.info('publish concluido', {
    written: report.written.length,
    skipped: report.skipped.length,
    blocked: report.blocked.length,
    redirects: report.redirectsAdded.length,
  });
  return report;
}
