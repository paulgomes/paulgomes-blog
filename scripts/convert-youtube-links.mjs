// Converte links puros do YouTube em posts MD/MDX para uso do componente
// <YouTube id="..." />.
//
// Modo padrão = PREVIEW: identifica os arquivos afetados, mostra 5 amostras
//                        com diff resumido, SAI.
// Modo --apply: aplica conversões + renomeia .md → .mdx se necessário.
//
// Rode:
//   node scripts/convert-youtube-links.mjs              # preview
//   node scripts/convert-youtube-links.mjs --apply      # aplica

import { readdir, readFile, writeFile, rename } from 'node:fs/promises';
import { join, basename } from 'node:path';

const BLOG_DIR = 'src/content/blog';
const APPLY = process.argv.includes('--apply');

// Captura IDs do YouTube em:
// - https://www.youtube.com/watch?v=ID
// - https://youtu.be/ID
// - https://youtube.com/watch?v=ID
const YT_RE = /https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/g;

// Captura essas URLs DENTRO de <...> (autolinks WP) ou \<...\> (escapados)
const ANGLE_AUTOLINK = /\\?<(https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)[a-zA-Z0-9_-]{11}[^>\s]*)\\?>/g;

function detectLineEnding(text) {
  return text.includes('\r\n') ? '\r\n' : '\n';
}

function extractIds(text) {
  const ids = [];
  const seen = new Set();
  let m;
  YT_RE.lastIndex = 0;
  while ((m = YT_RE.exec(text)) !== null) {
    if (!seen.has(m[1])) {
      ids.push(m[1]);
      seen.add(m[1]);
    }
  }
  return ids;
}

function parseFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---(\r?\n)([\s\S]*)$/);
  if (!m) return null;
  return { fm: m[1], fmEnd: m[2], body: m[3], all: m[0] };
}

function hasYouTubeImport(body) {
  return /import\s+YouTube\s+from\s+['"][^'"]+YouTube\.astro['"]/i.test(body);
}

/**
 * Converte cada link puro do YouTube no body por <YouTube id="..." />.
 * Limpa artefatos WP:
 *   - `\_` escape errado de underscore
 *   - autolinks <https://...>
 */
function convertBody(body, lineEnding) {
  let out = body;

  // 1. Remove autolinks angle-bracket ao redor de URLs do YT, deixando só a URL
  //    pra ser pega pelo regex seguinte
  out = out.replace(ANGLE_AUTOLINK, (_full, url) => url);

  // 2. Substitui cada URL pura por componente YouTube
  out = out.replace(YT_RE, (_full, id) => `<YouTube id="${id}" />`);

  // 3. Limpa escape de underscore: \_  → _
  out = out.replace(/\\_/g, '_');

  return out;
}

function addImportIfMissing(body, lineEnding) {
  if (hasYouTubeImport(body)) return body;
  // Adiciona após o topo do body (1ª linha em branco ou direto)
  return `import YouTube from '../../components/YouTube.astro';${lineEnding}${lineEnding}${body}`;
}

async function listPosts() {
  const files = await readdir(BLOG_DIR);
  return files.filter((f) => f.endsWith('.md') || f.endsWith('.mdx'));
}

async function analyzeAll() {
  const files = await listPosts();
  const affected = [];
  for (const f of files) {
    const path = join(BLOG_DIR, f);
    const raw = await readFile(path, 'utf8');
    const ids = extractIds(raw);
    if (ids.length > 0) {
      affected.push({
        filename: f,
        path,
        raw,
        ids,
        lineEnding: detectLineEnding(raw),
        isMd: f.endsWith('.md'),
      });
    }
  }
  return affected;
}

function shortDiff(beforeBody, afterBody) {
  // Mostra primeiras 3 linhas que mudaram
  const a = beforeBody.split('\n');
  const b = afterBody.split('\n');
  const diff = [];
  const max = Math.min(a.length, b.length);
  for (let i = 0; i < max && diff.length < 3; i++) {
    if (a[i] !== b[i]) {
      diff.push(`  - ${a[i].slice(0, 100).trimEnd()}`);
      diff.push(`  + ${b[i].slice(0, 100).trimEnd()}`);
    }
  }
  return diff.join('\n');
}

async function preview(affected) {
  console.log(`\n📺 Posts com YouTube embedado: ${affected.length}\n`);
  console.log('='.repeat(60));
  console.log('5 AMOSTRAS (preview — nada foi escrito ainda)');
  console.log('='.repeat(60));

  const samples = affected.slice(0, 5);
  for (const post of samples) {
    const parsed = parseFrontmatter(post.raw);
    if (!parsed) {
      console.log(`\n[${post.filename}] (frontmatter inválido — pulando)`);
      continue;
    }
    const newBody = addImportIfMissing(
      convertBody(parsed.body, post.lineEnding),
      post.lineEnding
    );
    console.log(`\n[${post.filename}] ${post.isMd ? '(.md → .mdx)' : ''}`);
    console.log(`  IDs detectados: ${post.ids.join(', ')}`);
    console.log(`  Diff (primeiras linhas alteradas):`);
    const dt = shortDiff(parsed.body, newBody);
    console.log(dt || '  (nenhuma — provavelmente body inteiro reescrito)');
  }

  console.log('\n' + '='.repeat(60));
  console.log('📋 Lista completa de arquivos a serem alterados:');
  for (const post of affected) {
    console.log(`  - ${post.filename}${post.isMd ? ' → .mdx' : ''} (${post.ids.length} vídeo${post.ids.length > 1 ? 's' : ''})`);
  }
  console.log('\nℹ️  Pra aplicar: node scripts/convert-youtube-links.mjs --apply');
}

async function applyAll(affected) {
  let written = 0;
  let renamed = 0;
  for (const post of affected) {
    const parsed = parseFrontmatter(post.raw);
    if (!parsed) continue;

    const newBody = addImportIfMissing(
      convertBody(parsed.body, post.lineEnding),
      post.lineEnding
    );

    const newRaw = `---${post.lineEnding}${parsed.fm}${post.lineEnding}---${parsed.fmEnd}${newBody}`;

    // Determina caminho final (renomeia .md → .mdx)
    let finalPath = post.path;
    if (post.isMd) {
      finalPath = post.path.replace(/\.md$/, '.mdx');
    }

    await writeFile(finalPath, newRaw, 'utf8');
    written++;

    // Se renomeou, deleta o .md original
    if (post.isMd && finalPath !== post.path) {
      const fs = await import('node:fs/promises');
      await fs.unlink(post.path);
      renamed++;
    }
  }

  console.log(`\n✓ Conversão aplicada`);
  console.log(`  arquivos escritos: ${written}`);
  console.log(`  renomeados .md → .mdx: ${renamed}`);
}

// === Main ===
const affected = await analyzeAll();
if (affected.length === 0) {
  console.log('Nenhum post com YouTube embedado encontrado.');
  process.exit(0);
}

if (APPLY) {
  await applyAll(affected);
} else {
  await preview(affected);
}
