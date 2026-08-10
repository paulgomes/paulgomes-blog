#!/usr/bin/env node
/**
 * Tradução em massa PT -> EN dos posts do blog.
 *
 *   src/content/blog/<slug>.md  ->  src/content/blog-en/<slug>.md
 *
 * O slug é PRESERVADO: é ele que forma o par PT<->EN usado pelo hreflang e pelo
 * seletor de idioma (ver src/i18n/index.ts e src/components/LangSwitcher.astro).
 *
 * O que é traduzido: `title`, `description`, `heroImageAlt` e o corpo markdown.
 * O que NÃO é tocado: `pubDate`, `updatedDate`, `heroImage`, `featured` e
 * `categorias` — categoria é chave de taxonomia e o enum é gate de build
 * (src/lib/categorias.ts). Traduzir categoria QUEBRA o build.
 *
 * Idempotente: mantém um manifesto com o hash do original. Rodar de novo só
 * retraduz o que mudou (ou tudo, com --force).
 *
 * Uso:
 *   ANTHROPIC_API_KEY=sk-... node scripts/translate-posts.mjs [flags]
 *
 * Flags:
 *   --dry-run           Lista o que seria traduzido e estima custo. Não chama a API.
 *   --limit N           Traduz no máximo N posts (útil para um piloto).
 *   --only <slug>       Traduz apenas o slug indicado (repetível).
 *   --force             Retraduz mesmo se o manifesto disser que está em dia.
 *   --concurrency N     Requisições simultâneas (default 4).
 *   --model <id>        Sobrescreve o modelo (default: mesmo do enrich.ts).
 */

import { createHash } from 'node:crypto';
import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC_DIR = path.join(ROOT, 'src/content/blog');
const OUT_DIR = path.join(ROOT, 'src/content/blog-en');
const MANIFEST = path.join(ROOT, 'scripts/translation-manifest.json');

const ANTHROPIC_ENDPOINT = 'https://api.anthropic.com/v1/messages';
// Mesmo modelo usado por functions/api/ai/enrich.ts.
const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';
const MAX_TOKENS = 8192;
const MAX_RETRIES = 4;

// Campos de frontmatter que carregam texto humano e devem ser traduzidos.
// `metaTitle`/`metaDescription`/`focusKeyword` não estão no schema Astro (o Zod
// os descarta na renderização), mas existem em ~205 posts e são consumidos pelo
// painel — traduzi-los mantém o arquivo EN coerente de ponta a ponta.
const TRANSLATABLE_KEYS = [
  'title',
  'description',
  'heroImageAlt',
  'metaTitle',
  'metaDescription',
  'focusKeyword',
];

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const opts = { dryRun: false, limit: Infinity, only: [], force: false, concurrency: 4, model: DEFAULT_MODEL };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--force') opts.force = true;
    else if (a === '--limit') opts.limit = Number(argv[++i]);
    else if (a === '--only') opts.only.push(argv[++i]);
    else if (a === '--concurrency') opts.concurrency = Number(argv[++i]);
    else if (a === '--model') opts.model = argv[++i];
    else if (a === '--help' || a === '-h') {
      console.log(readFileSyncHelp());
      process.exit(0);
    } else {
      console.error(`Flag desconhecida: ${a}`);
      process.exit(1);
    }
  }
  if (!Number.isFinite(opts.concurrency) || opts.concurrency < 1) opts.concurrency = 1;
  return opts;
}

function readFileSyncHelp() {
  return `Uso: ANTHROPIC_API_KEY=sk-... node scripts/translate-posts.mjs [--dry-run] [--limit N] [--only slug] [--force] [--concurrency N] [--model id]`;
}

// ---------------------------------------------------------------------------
// Frontmatter — manipulação por LINHA, de propósito.
//
// Não usamos parser YAML: reescrever o YAML inteiro arriscaria reordenar chaves
// ou mudar aspas/escapes de 216 arquivos. Aqui só as linhas traduzíveis são
// substituídas; todo o resto sai byte a byte igual ao original.
// ---------------------------------------------------------------------------

export function splitFrontmatter(raw) {
  if (!raw.startsWith('---')) return null;
  const end = raw.indexOf('\n---', 3);
  if (end === -1) return null;
  const fmEnd = raw.indexOf('\n', end + 1);
  return {
    fm: raw.slice(raw.indexOf('\n') + 1, end + 1),
    body: raw.slice(fmEnd + 1),
  };
}

/** Extrai o valor escalar de `chave: valor`, removendo aspas se houver. */
function unquote(value) {
  const v = value.trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }
  return v;
}

/** Serializa como escalar YAML entre aspas duplas, sempre seguro. */
function quote(value) {
  return `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ')}"`;
}

/** Devolve { key, value } das linhas traduzíveis de nível raiz do frontmatter. */
export function readTranslatableFields(fm) {
  const found = {};
  for (const line of fm.split('\n')) {
    const m = /^([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$/.exec(line);
    if (!m) continue;
    const [, key, rest] = m;
    if (!TRANSLATABLE_KEYS.includes(key)) continue;
    const value = unquote(rest);
    if (value) found[key] = value;
  }
  return found;
}

/** Reescreve apenas as linhas traduzíveis, preservando o resto intacto. */
export function applyTranslatedFields(fm, translated) {
  return fm
    .split('\n')
    .map((line) => {
      const m = /^([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$/.exec(line);
      if (!m) return line;
      const [, key] = m;
      if (!TRANSLATABLE_KEYS.includes(key)) return line;
      if (translated[key] == null) return line;
      return `${key}: ${quote(translated[key])}`;
    })
    .join('\n');
}

// ---------------------------------------------------------------------------
// Anthropic
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a professional pt-BR -> en translator for an editorial tech blog.

Rules:
- Translate into natural, idiomatic English. Do not translate literally.
- Preserve Markdown/MDX structure EXACTLY: headings, lists, tables, blockquotes,
  bold/italic, footnotes and line breaks.
- NEVER translate or alter: code blocks and inline code, URLs, file paths,
  HTML/JSX tags and their attributes, MDX import statements and component names,
  frontmatter delimiters.
- Keep proper nouns, brand names and product names as they are.
- Keep the author's voice: direct, editorial, no filler.
- Output ONLY the translation. No preamble, no explanation, no code fences
  wrapping the whole answer.`;

async function callAnthropic({ apiKey, model, system, user }) {
  let lastErr;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      // Backoff exponencial: 2s, 4s, 8s, 16s.
      const waitMs = 2000 * 2 ** (attempt - 1);
      await new Promise((r) => setTimeout(r, waitMs));
    }
    try {
      const res = await fetch(ANTHROPIC_ENDPOINT, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model,
          max_tokens: MAX_TOKENS,
          system,
          messages: [{ role: 'user', content: user }],
        }),
      });

      if (res.status === 429 || res.status >= 500) {
        lastErr = new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
        continue; // transitório — tenta de novo
      }
      if (!res.ok) {
        // 4xx que não é rate limit não melhora com retry.
        throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
      }

      const data = await res.json();
      const text = String(data?.content?.[0]?.text || '').trim();
      if (!text) {
        lastErr = new Error('resposta vazia da API');
        continue;
      }
      return { text, usage: data?.usage };
    } catch (err) {
      lastErr = err;
      if (String(err.message).startsWith('HTTP 4')) throw err;
    }
  }
  throw lastErr ?? new Error('falha desconhecida');
}

// ---------------------------------------------------------------------------
// Tradução de um post
// ---------------------------------------------------------------------------

export async function translatePost({ apiKey, model, raw }) {
  const parts = splitFrontmatter(raw);
  if (!parts) throw new Error('frontmatter ausente ou malformado');

  const fields = readTranslatableFields(parts.fm);

  // Duas chamadas: metadados curtos (JSON estrito) e corpo (markdown puro).
  // Separar evita que o modelo "conserte" o YAML e corrompa o frontmatter.
  const metaPrompt = `Translate the VALUES of this JSON from Brazilian Portuguese to English.
Return ONLY a JSON object with exactly the same keys. No markdown fences.

${JSON.stringify(fields, null, 2)}`;

  // Post só-frontmatter (existe pelo menos um no acervo): não há corpo para
  // traduzir e mandar string vazia à API só produziria texto inventado.
  const hasBody = parts.body.trim().length > 0;

  const [metaRes, bodyRes] = await Promise.all([
    Object.keys(fields).length
      ? callAnthropic({ apiKey, model, system: SYSTEM_PROMPT, user: metaPrompt })
      : Promise.resolve({ text: '{}', usage: null }),
    hasBody
      ? callAnthropic({
          apiKey,
          model,
          system: SYSTEM_PROMPT,
          user: `Translate this Markdown document body from Brazilian Portuguese to English.\n\n${parts.body}`,
        })
      : Promise.resolve({ text: '', usage: null }),
  ]);

  let translatedFields = {};
  try {
    // Remove cerca de código, caso o modelo insista em envolver o JSON.
    const cleaned = metaRes.text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
    translatedFields = JSON.parse(cleaned);
  } catch {
    throw new Error(`metadados voltaram em JSON inválido: ${metaRes.text.slice(0, 160)}`);
  }

  const fm = applyTranslatedFields(parts.fm, translatedFields);
  const out = hasBody ? `---\n${fm}---\n\n${bodyRes.text}\n` : `---\n${fm}---\n`;

  const usage = {
    input: (metaRes.usage?.input_tokens ?? 0) + (bodyRes.usage?.input_tokens ?? 0),
    output: (metaRes.usage?.output_tokens ?? 0) + (bodyRes.usage?.output_tokens ?? 0),
  };
  return { out, usage };
}

// ---------------------------------------------------------------------------
// Orquestração
// ---------------------------------------------------------------------------

/** Executa `worker` sobre `items` com no máximo `limit` em voo. */
async function mapPool(items, limit, worker) {
  const results = [];
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const idx = cursor++;
      results[idx] = await worker(items[idx], idx);
    }
  });
  await Promise.all(runners);
  return results;
}

async function loadManifest() {
  if (!existsSync(MANIFEST)) return {};
  try {
    return JSON.parse(await readFile(MANIFEST, 'utf8'));
  } catch {
    return {};
  }
}

function hash(text) {
  return createHash('sha256').update(text).digest('hex').slice(0, 16);
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey && !opts.dryRun) {
    console.error('ANTHROPIC_API_KEY não definida. Use --dry-run para simular sem chave.');
    process.exit(1);
  }

  await mkdir(OUT_DIR, { recursive: true });
  const manifest = await loadManifest();

  const files = (await readdir(SRC_DIR)).filter((f) => /\.(md|mdx)$/.test(f)).sort();
  const selected = opts.only.length
    ? files.filter((f) => opts.only.includes(f.replace(/\.(md|mdx)$/, '')))
    : files;

  // Decide o que realmente precisa de trabalho.
  const jobs = [];
  let skipped = 0;
  for (const file of selected) {
    const slug = file.replace(/\.(md|mdx)$/, '');
    const raw = await readFile(path.join(SRC_DIR, file), 'utf8');
    const h = hash(raw);
    const upToDate = manifest[slug]?.sourceHash === h && existsSync(path.join(OUT_DIR, file));
    if (upToDate && !opts.force) {
      skipped++;
      continue;
    }
    jobs.push({ file, slug, raw, hash: h });
    if (jobs.length >= opts.limit) break;
  }

  const chars = jobs.reduce((n, j) => n + j.raw.length, 0);
  console.log(`posts totais: ${files.length}`);
  console.log(`já em dia (pulados): ${skipped}`);
  console.log(`a traduzir: ${jobs.length}  (~${Math.round(chars / 4 / 1000)}k tokens de entrada)`);

  if (opts.dryRun) {
    for (const j of jobs.slice(0, 20)) console.log(`  - ${j.slug}`);
    if (jobs.length > 20) console.log(`  … e mais ${jobs.length - 20}`);
    console.log('\n--dry-run: nenhuma chamada de API feita, nenhum arquivo escrito.');
    return;
  }
  if (!jobs.length) {
    console.log('Nada a fazer.');
    return;
  }

  let ok = 0;
  const failures = [];
  let totalIn = 0;
  let totalOut = 0;

  await mapPool(jobs, opts.concurrency, async (job, i) => {
    try {
      const { out, usage } = await translatePost({ apiKey, model: opts.model, raw: job.raw });
      await writeFile(path.join(OUT_DIR, job.file), out, 'utf8');
      manifest[job.slug] = {
        sourceHash: job.hash,
        model: opts.model,
        translatedAt: new Date().toISOString(),
      };
      totalIn += usage.input;
      totalOut += usage.output;
      ok++;
      console.log(`[${i + 1}/${jobs.length}] ok  ${job.slug}`);
    } catch (err) {
      failures.push({ slug: job.slug, error: err.message });
      console.error(`[${i + 1}/${jobs.length}] FALHOU  ${job.slug}: ${err.message}`);
    }
  });

  // Grava o manifesto mesmo com falhas parciais — o que deu certo não se perde.
  await writeFile(MANIFEST, JSON.stringify(manifest, null, 2) + '\n', 'utf8');

  console.log(`\ntraduzidos: ${ok}/${jobs.length}`);
  console.log(`tokens: ${totalIn} entrada / ${totalOut} saída`);
  if (failures.length) {
    console.log(`\nfalhas (${failures.length}) — rode de novo para tentar só elas:`);
    for (const f of failures) console.log(`  - ${f.slug}: ${f.error}`);
    process.exitCode = 1;
  }
}

// Só executa como CLI. Importar o módulo (nos testes) não dispara a tradução.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error('erro fatal:', err?.message || err);
    process.exit(1);
  });
}
