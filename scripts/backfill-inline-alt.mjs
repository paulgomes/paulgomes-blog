#!/usr/bin/env node
/**
 * Backfill alt em imagens INLINE de posts .md/.mdx.
 *
 * Casos cobertos:
 *   1. Markdown ![](url) ou ![ ](url) — alt vazio
 *   2. HTML <img ... alt=""> — defensivo (atualmente 0 no projeto)
 *   3. HTML <img ... > sem alt — defensivo
 *
 * Casos NAO tocados:
 *   - Markdown ![alt-ja-preenchido](url)
 *   - <Image .../> (componente Astro — alt obrigatorio no JSX)
 *   - <YouTube .../>, <Image src=...alt="">, etc (.mdx)
 *
 * Estrategia de gerar alt: heading mais proximo ANTES > title do post > filename > fallback generico.
 *
 * Uso:
 *   node scripts/backfill-inline-alt.mjs           # DRY-RUN (default)
 *   node scripts/backfill-inline-alt.mjs --apply   # aplica de verdade
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const BLOG_DIR = path.join(PROJECT_ROOT, 'src/content/blog');
const DRY_RUN = !process.argv.includes('--apply');

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function splitFrontmatter(content) {
  // Aceita CRLF ou LF — arquivos legados WordPress vem com CRLF
  const m = content.match(/^(---\r?\n[\s\S]*?\r?\n---\r?\n?)([\s\S]*)$/);
  if (m) return { frontmatter: m[1], body: m[2] };
  return { frontmatter: '', body: content };
}

function extractTitle(frontmatter) {
  const m = frontmatter.match(/^title:\s*["']?(.+?)["']?\s*$/m);
  return m ? m[1].replace(/["']/g, '').trim() : '';
}

function extractHeadings(body) {
  const headings = [];
  const lines = body.split('\n');
  let offset = 0;
  for (const line of lines) {
    const m = line.match(/^(#{1,6})\s+(.+)$/);
    if (m) headings.push({ offset, level: m[1].length, text: m[2].trim() });
    offset += line.length + 1; // +1 do \n
  }
  return headings;
}

function findNearestHeading(headings, imgOffset) {
  let nearest = null;
  for (const h of headings) {
    if (h.offset < imgOffset) nearest = h;
    else break;
  }
  return nearest?.text || '';
}

// Filename "wys-blog-posts-15.webp" -> "wys blog posts 15"
// Rejeita lixo: dimensoes, IDs do Instagram, hashes UUID, sufixos numericos auto-incremento.
function humanizeFilename(filename) {
  if (!filename) return '';
  let base = filename.replace(/\.\w+$/, '');
  // Remove sufixos de dimensao "-1160x771", "-768x507-1", etc
  base = base.replace(/-?\d+x\d+(-\d+)?$/i, '');
  // Remove sufixos auto-incremento "-1", "-1-2", "_edited"
  base = base.replace(/-\d+(-\d+)*$/i, '').replace(/[-_]edited$/i, '');
  const clean = base.replace(/[-_]/g, ' ').trim();
  if (!clean) return '';
  if (clean.length < 5) return '';
  // Rejeita: so digitos/espacos (IDs Instagram-style)
  if (/^[\d\s]+$/.test(clean)) return '';
  // Rejeita: hashes/UUIDs alfanumericos longos sem palavras (heuristica: muitos chars sem espacos)
  if (!/\s/.test(clean) && clean.length > 16 && /[A-Z][a-z]|[a-z][A-Z]|[A-Z]{2,}|\d{4,}/.test(clean)) return '';
  return clean;
}

function generateAlt({ heading, title, filename }) {
  if (heading && heading.length >= 10) return heading;
  if (title) return title;
  const fn = humanizeFilename(filename);
  if (fn) return fn;
  return 'Imagem ilustrativa';
}

// Markdown alt escape: ] precisa ser escapado
function escapeMd(s) {
  return String(s).replace(/\]/g, '\\]');
}

// HTML attribute escape
function escapeAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

// ──────────────────────────────────────────────
// Processa 1 arquivo
// ──────────────────────────────────────────────
function processFile(filepath) {
  const original = readFileSync(filepath, 'utf-8');
  const { frontmatter, body } = splitFrontmatter(original);
  const title = extractTitle(frontmatter);
  const headings = extractHeadings(body);

  const changes = [];
  let newBody = body;

  // ── 1. Markdown ![](url) ou ![ ](url) (alt vazio) ──
  newBody = newBody.replace(
    /!\[(\s*)\]\(([^)]+)\)/g,
    (match, _ws, imgUrl, offset) => {
      const filename = imgUrl.split('/').pop()?.split('?')[0] || '';
      const heading = findNearestHeading(headings, offset);
      const alt = generateAlt({ heading, title, filename });
      const newMd = `![${escapeMd(alt)}](${imgUrl})`;
      changes.push({ type: 'md-empty', before: match, after: newMd, alt, source: heading ? 'heading' : (title ? 'title' : 'filename') });
      return newMd;
    }
  );

  // ── 2. HTML <img ... alt=""> ──
  newBody = newBody.replace(
    /<img\b([^>]*?)\salt=""([^>]*)>/gi,
    (match, before, after, offset) => {
      const srcMatch = (before + after).match(/src=["']([^"']+)["']/);
      const src = srcMatch ? srcMatch[1] : '';
      const filename = src.split('/').pop()?.split('?')[0] || '';
      const heading = findNearestHeading(headings, offset);
      const alt = generateAlt({ heading, title, filename });
      const newTag = `<img${before} alt="${escapeAttr(alt)}"${after}>`;
      changes.push({ type: 'html-empty', before: match, after: newTag, alt, source: heading ? 'heading' : (title ? 'title' : 'filename') });
      return newTag;
    }
  );

  // ── 3. HTML <img ... > SEM alt (defensivo) ──
  newBody = newBody.replace(
    /<img\b([^>]*?)\/?>/gi,
    (match, attrs, offset) => {
      if (/\balt=/i.test(attrs)) return match; // ja tem alt
      const srcMatch = attrs.match(/src=["']([^"']+)["']/);
      const src = srcMatch ? srcMatch[1] : '';
      const filename = src.split('/').pop()?.split('?')[0] || '';
      const heading = findNearestHeading(headings, offset);
      const alt = generateAlt({ heading, title, filename });
      const newTag = `<img${attrs} alt="${escapeAttr(alt)}">`;
      changes.push({ type: 'html-missing', before: match, after: newTag, alt, source: heading ? 'heading' : (title ? 'title' : 'filename') });
      return newTag;
    }
  );

  return { changes, newContent: frontmatter + newBody };
}

// ──────────────────────────────────────────────
// MAIN
// ──────────────────────────────────────────────
async function main() {
  console.log(`\n🔍 Backfill inline alt ${DRY_RUN ? '(DRY-RUN)' : '(APPLY)'}\n`);

  const files = readdirSync(BLOG_DIR)
    .filter((f) => f.endsWith('.md') || f.endsWith('.mdx'))
    .map((f) => path.join(BLOG_DIR, f));

  console.log(`📂 ${files.length} arquivos varridos\n`);

  let totalChanges = 0;
  let filesChanged = 0;
  const samples = [];
  const byType = { 'md-empty': 0, 'html-empty': 0, 'html-missing': 0 };
  const bySource = { heading: 0, title: 0, filename: 0 };

  for (const filepath of files) {
    const { changes, newContent } = processFile(filepath);
    if (changes.length === 0) continue;

    filesChanged++;
    totalChanges += changes.length;

    for (const c of changes) {
      byType[c.type] = (byType[c.type] || 0) + 1;
      bySource[c.source] = (bySource[c.source] || 0) + 1;
    }

    // 1 amostra por arquivo (ate 10 totais)
    if (samples.length < 10) {
      const c = changes[0];
      samples.push({
        file: path.basename(filepath),
        type: c.type,
        source: c.source,
        alt: c.alt,
        before: c.before.length > 90 ? c.before.slice(0, 87) + '...' : c.before,
        after: c.after.length > 90 ? c.after.slice(0, 87) + '...' : c.after,
        n_in_file: changes.length,
      });
    }

    if (!DRY_RUN) {
      writeFileSync(filepath, newContent, 'utf-8');
    }
  }

  console.log('═══════════════════════════════════════');
  console.log('📈 Resumo:');
  console.log(`   Arquivos com mudança:    ${filesChanged}`);
  console.log(`   Total de alt gerados:    ${totalChanges}`);
  console.log(`   Por tipo:                md-empty=${byType['md-empty']}  html-empty=${byType['html-empty']}  html-missing=${byType['html-missing']}`);
  console.log(`   Fonte do alt:            heading=${bySource.heading}  title=${bySource.title}  filename=${bySource.filename}`);

  if (samples.length > 0) {
    console.log('\n📝 Amostras (1 por arquivo, ate 10):');
    for (const s of samples) {
      console.log(`\n   ${s.file}  [${s.type} via ${s.source}]  (${s.n_in_file} alt nesse arquivo)`);
      console.log(`     alt gerado: "${s.alt}"`);
      console.log(`     antes:  ${s.before}`);
      console.log(`     depois: ${s.after}`);
    }
  }

  if (DRY_RUN) {
    console.log('\n⚠️  DRY-RUN — nada foi aplicado.');
    console.log('   Pra aplicar: node scripts/backfill-inline-alt.mjs --apply');
  } else {
    console.log('\n✓ Aplicado nos .md/.mdx locais.');
    console.log('   Proximo: git diff && git commit');
  }
}

main().catch((err) => {
  console.error('\n❌ Falha:', err);
  process.exit(1);
});
