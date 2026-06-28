/**
 * CLI do Migration Engine (Anel 3 — runner Node, cargas pesadas).
 *
 * Uso:
 *   node dist/cli/import.js --connector wordpress-xml --source migration/wordpress-export.xml \
 *        [--out .out] [--mapping mapa.json] [--limit N]
 *
 * Por seguranca, escreve os .md gerados em --out (preview/staging), NUNCA em
 * src/content/blog. A publicacao (commit Git-primeiro + gate + redirects) e o
 * passo 14, integrado ao painel/Worker — fora do escopo deste runner de preview.
 */
import { parseArgs } from 'node:util';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { createLogger } from '../core/utils/logger.js';
import { runImport } from '../core/pipeline/import-pipeline.js';
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

  const result = await runImport({
    connectorId: values.connector ?? 'wordpress-xml',
    source: values.source,
    categoryMapping,
    allowedCategories: KNOWN_CATEGORIES,
    limit: values.limit ? Number(values.limit) : undefined,
    logger,
    signal: AbortSignal.timeout(10 * 60_000),
    secrets: envSecrets,
  });

  // escreve artifacts no diretorio de preview
  const outDir = resolve(values.out ?? '.out');
  await mkdir(outDir, { recursive: true });
  for (const a of result.artifacts) {
    const dest = join(outDir, a.path);
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, a.content, 'utf-8');
  }
  await writeFile(join(outDir, 'migration-report.json'), JSON.stringify(result.report, null, 2), 'utf-8');

  // resumo humano em stdout
  const r = result.report;
  const lines = [
    '',
    '=== Migration Engine — relatorio (preview) ===',
    `conector:        ${r.connectorId}`,
    `artigos:         ${r.totals.posts}`,
    `duplicados:      ${r.duplicated}`,
    `SEO preservado:  ${r.seoPreserved} (com data de publicacao)`,
    `erros:           ${r.errors}`,
    `avisos:          ${r.warnings}`,
    `tempo:           ${r.durationMs} ms`,
    `saida:           ${outDir}/src/content/blog/`,
    '',
    'amostra (ate 5):',
    ...result.perPost.slice(0, 5).map((p) => `  - ${p.slug}  [${p.status}]  cats=[${p.categorias.join(', ')}]`),
    '',
  ];
  process.stdout.write(lines.join('\n') + '\n');

  return r.errors > 0 ? 1 : 0;
}

main().then((code) => process.exit(code)).catch((err) => {
  process.stderr.write('FALHA: ' + (err instanceof Error ? err.stack ?? err.message : String(err)) + '\n');
  process.exit(1);
});
