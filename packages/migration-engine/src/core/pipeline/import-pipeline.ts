/**
 * Pipeline de import (in-process). Estrutura os estagios connect->validate->read->
 * convert->render->report. A versao retomavel (fila/checkpoint/Worker) e Fase 6;
 * aqui o foco e o caminho ponta-a-ponta verificavel (CLI / Anel 3).
 */
import type { StructuredLogger, SecretResolver } from '../types/ports.js';
import type { ExportArtifact } from '../types/connector.js';
import type { MigrationReport } from '../types/reports.js';
import { emptyReport } from '../types/reports.js';
import { createConnector } from '../../connectors/index.js';
import { wpItemToCanonical } from '../../connectors/wordpress/transform.js';
import type { WpItem } from '../../connectors/wordpress/xml.js';
import { renderMarkdown } from '../transformers/canonical-to-markdown.js';
import { assertCategoriesInEnum } from '../validators/categories.js';

export interface ImportOptions {
  connectorId: string;
  source: string;
  categoryMapping: Record<string, string>;
  allowedCategories: readonly string[];
  limit?: number;
  logger: StructuredLogger;
  signal: AbortSignal;
  secrets: SecretResolver;
}

export interface PerPost {
  slug: string;
  title: string;
  status: string;
  categorias: string[];
  warnings: number;
}

export interface ImportResult {
  artifacts: ExportArtifact[];
  report: MigrationReport;
  perPost: PerPost[];
}

export async function runImport(opts: ImportOptions): Promise<ImportResult> {
  const startedAt = Date.now();
  const log = opts.logger.child({ connector: opts.connectorId });
  const report = emptyReport('cli', opts.connectorId);
  const artifacts: ExportArtifact[] = [];
  const perPost: PerPost[] = [];
  const seenSlugs = new Set<string>();

  // 1. connect
  const connector = createConnector(opts.connectorId);
  await connector.connect(
    { logger: log, signal: opts.signal, secrets: opts.secrets },
    { source: opts.source },
  );

  // 2. validate
  const validation = await connector.validate();
  report.diagnostics.push(...validation.diagnostics);
  if (!validation.ok) {
    report.errors += validation.diagnostics.filter((d) => d.level === 'error').length;
    report.durationMs = Date.now() - startedAt;
    await connector.disconnect();
    return { artifacts, report, perPost };
  }

  // 3..10 read -> convert -> render
  let count = 0;
  for await (const entity of connector.fetchPosts()) {
    if (opts.signal.aborted) break;
    if (opts.limit && count >= opts.limit) break;
    count++;

    const post = wpItemToCanonical(entity.raw as WpItem, {
      categoryMapping: opts.categoryMapping,
      allowedCategories: opts.allowedCategories,
    });

    // dedup por slug
    if (seenSlugs.has(post.slug)) {
      report.duplicated++;
      log.warn('slug duplicado, ignorado', { slug: post.slug });
      continue;
    }
    seenSlugs.add(post.slug);

    // 12. validate-final: GATE de categorias (nunca commitar fora do enum)
    const gate = assertCategoriesInEnum(post.mappedCategories, opts.allowedCategories);
    if (gate.length) {
      report.errors += gate.length;
      report.diagnostics.push(...gate);
      log.error('GATE bloqueou post (categoria fora do enum)', { slug: post.slug });
      continue;
    }

    report.warnings += post.warnings.length;
    report.diagnostics.push(...post.warnings.map((w) => ({ ...w, code: `${post.slug}:${w.code}` })));
    if (post.publishedAt) report.seoPreserved++;

    const content = renderMarkdown(post);
    artifacts.push({ path: `src/content/blog/${post.slug}.md`, content, mime: 'text/markdown' });
    perPost.push({ slug: post.slug, title: post.title, status: post.status, categorias: post.mappedCategories, warnings: post.warnings.length });
    report.totals.posts++;
  }

  await connector.disconnect();
  report.durationMs = Date.now() - startedAt;
  return { artifacts, report, perPost };
}
