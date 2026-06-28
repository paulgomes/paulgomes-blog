/**
 * CLI do Migration Engine (Anel 3 — runner Node).
 *
 * Preview (default): escreve os .md em --out (staging seguro), nunca toca no blog.
 *   node dist/cli/import.js --connector wordpress-xml --source ../../migration/wordpress-export.xml
 *
 * Publish (passo 14): escreve em src/content/blog (pulando slugs existentes),
 *   gera redirects 301 em public/_redirects, SEM git/push (voce revisa + builda).
 *   node dist/cli/import.js --connector wordpress-xml --source X.xml --publish [--overwrite]
 */
import { parseArgs } from 'node:util';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { createLogger } from '../core/utils/logger.js';
import { runImport } from '../core/pipeline/import-pipeline.js';
import { publishPosts } from '../core/publish/publish.js';
import { KNOWN_CATEGORIES } from '../core/validators/categories.js';
import type { SecretResolver } from '../core/types/ports.js';

const envSecrets: SecretResolver = { async get(name) { return process.env[name]; } };

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: {
      connector: { type: 'string', default: 'wordpress-xml' },
      source: { type: 'string' },
      out: { type: 'string', default: '.out' },
      mapping: { type: 'string' },
      limit: { type: 'string' },
      publish: { type: 'boolean', default: false },
      'blog-dir': { type: 'string' },
      redirects: { type: 'string' },
      'site-url': { type: 'string', default: 'https://paulgomes.com.br' },
      overwrite: { type: 'boolean', default: false },
    },
  });

  if (!values.source) {
    process.stderr.write('erro: --source <arquivo> e obrigatorio\n');
    return 2;
  }

  const logger = createLogger();
  let categoryMapping: Record<string, string> = {};
  if (values.mapping) {
    categoryMapping = JSON.parse(await readFile(values.mapping, 'utf-8')) as Record<string, string>;
  }

  const sourceContent = await readFile(values.source, 'utf-8');
  const result = await runImport({
    connectorId: values.connector ?? 'wordpress-xml',
    source: values.source,
    sourceContent,
    categoryMapping,
    allowedCategories: KNOWN_CATEGORIES,
    limit: values.limit ? Number(values.limit) : undefined,
    logger,
    signal: AbortSignal.timeout(10 * 60_000),
    secrets: envSecrets,
  });

  const r = result.report;
  const summary: string[] = [
    '',
    '=== Migration Engine — relatorio ===',
    `conector:        ${r.connectorId}`,
    `artigos:         ${r.totals.posts}`,
    `duplicados:      ${r.duplicated}`,
    `SEO preservado:  ${r.seoPreserved} (com data de publicacao)`,
    `erros:           ${r.errors}`,
    `avisos:          ${r.warnings}`,
    `tempo:           ${r.durationMs} ms`,
  ];

  if (values.publish) {
    const blogDir = resolve(values['blog-dir'] ?? '../../src/content/blog');
    const redirectsFile = resolve(values.redirects ?? '../../public/_redirects');
    const pub = await publishPosts(result.posts, {
      blogDir,
      redirectsFile,
      siteUrl: values['site-url'] ?? 'https://paulgomes.com.br',
      allowedCategories: KNOWN_CATEGORIES,
      overwrite: values.overwrite ?? false,
      logger,
    });
    summary.push(
      '--- PUBLISH ---',
      `escritos:        ${pub.written.length}`,
      `pulados (ja existem): ${pub.skipped.length}`,
      `bloqueados (gate):    ${pub.blocked.length}`,
      `redirects 301:   ${pub.redirectsAdded.length}`,
      `blog:            ${blogDir}`,
      '',
      'PROXIMO PASSO: revise, rode `npm run build` (na raiz) e commite. Push e seu (ADR-001).',
      '',
    );
  } else {
    // preview: escreve em --out
    const outDir = resolve(values.out ?? '.out');
    await mkdir(outDir, { recursive: true });
    for (const p of result.posts) {
      const dest = join(outDir, 'src/content/blog', `${p.slug}.md`);
      await mkdir(dirname(dest), { recursive: true });
      await writeFile(dest, p.content, 'utf-8');
    }
    await writeFile(join(outDir, 'migration-report.json'), JSON.stringify(r, null, 2), 'utf-8');
    summary.push(`saida (preview): ${outDir}/src/content/blog/`, '', 'amostra (ate 5):',
      ...result.posts.slice(0, 5).map((p) => `  - ${p.slug}  [${p.status}]  cats=[${p.categorias.join(', ')}]`), '');
  }

  process.stdout.write(summary.join('\n') + '\n');
  return r.errors > 0 ? 1 : 0;
}

main().then((code) => process.exit(code)).catch((err) => {
  process.stderr.write('FALHA: ' + (err instanceof Error ? err.stack ?? err.message : String(err)) + '\n');
  process.exit(1);
});
