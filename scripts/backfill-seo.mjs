#!/usr/bin/env node
/**
 * Backfill SEO em posts antigos.
 *
 * Le posts_meta com meta_title OU meta_description vazios,
 * roda algoritmo TF-IDF (porta de src/lib/seo-analyzer.ts),
 * UPDATE D1 em batch unico + injeta 3 campos no frontmatter dos .md.
 *
 * Uso:
 *   node scripts/backfill-seo.mjs           # aplica direto (Wys autorizou)
 *   node scripts/backfill-seo.mjs --dry-run # so mostra o que faria
 *
 * Approach surgical no .md: parse frontmatter por regex, injeta linhas novas
 * antes do fechamento '---'. Preserva format/quirks existentes (minimiza
 * git diff). Posts ja com algum dos campos: pula esse campo especifico.
 */

import { execSync } from 'node:child_process';
import { writeFileSync, readFileSync, existsSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const BLOG_DIR = path.join(PROJECT_ROOT, 'src/content/blog');
const isDryRun = process.argv.includes('--dry-run');

// ============================================================
// PORTADO DE src/lib/seo-analyzer.ts (manter em sync)
// ============================================================
const STOPWORDS = new Set([
  'a','o','as','os','um','uma','uns','umas','de','do','da','dos','das',
  'em','no','na','nos','nas','para','pra','por','pelo','pela','pelos','pelas',
  'com','sem','sobre','sob','entre','ate','desde',
  'e','ou','mas','porem','contudo','que','se','como','quando','onde','porque',
  'eu','tu','ele','ela','nos','vos','eles','elas','meu','minha','seu','sua',
  'isso','isto','aquilo','este','esta','esse','essa','aquele','aquela',
  'eh','foi','ser','esta','sao','estao','seja','sendo','tem','tinha','teve',
  'tambem','muito','pouco','mais','menos','ja','ainda','sim','nao','quase',
  'aqui','ali','la','agora','depois','antes','sempre','nunca','hoje','ontem',
  'todo','toda','todos','todas','outro','outra','outros','outras',
  'qualquer','quais','qual','quem','cujo','cuja',
  'assim','entao','pois','enquanto',
  'fazer','feito','fez','faz','fazendo','dizer','disse',
  'ter','tido','ir','vir','ver','dar','dado',
]);

function normalize(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function stripMarkdown(text) {
  return String(text || '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]+`/g, '')
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/[*_~]+/g, '')
    .replace(/^\s*>\s+/gm, '')
    .replace(/^---+$/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(text) {
  return normalize(text)
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
}

function detectFocusKeyword(title, content) {
  const cleanContent = stripMarkdown(content);
  const tokens = tokenize(cleanContent);
  const titleTokens = new Set(tokenize(title));
  if (tokens.length === 0) return '';

  const freq = {};
  for (const t of tokens) freq[t] = (freq[t] || 0) + 1;

  const bigrams = {};
  for (let i = 0; i < tokens.length - 1; i++) {
    // Rejeita bigram com palavra repetida (ex: "paulgomes paulgomes" de alt-text duplicado)
    if (tokens[i] === tokens[i + 1]) continue;
    const bg = `${tokens[i]} ${tokens[i + 1]}`;
    bigrams[bg] = (bigrams[bg] || 0) + 1;
  }

  const candidates = [];
  for (const [term, count] of Object.entries(freq)) {
    if (count < 2) continue;
    const titleBoost = titleTokens.has(term) ? 3 : 1;
    candidates.push({ term, score: count * titleBoost });
  }
  for (const [term, count] of Object.entries(bigrams)) {
    if (count < 2) continue;
    const [w1, w2] = term.split(' ');
    const titleBoost = (titleTokens.has(w1) && titleTokens.has(w2)) ? 5 : 2;
    candidates.push({ term, score: count * titleBoost * 1.5 });
  }
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0]?.term || '';
}

function generateMetaTitle(title, _focusKeyword) {
  const result = String(title || '').trim();
  if (result.length <= 60) return result;
  const truncated = result.slice(0, 57);
  const lastSpace = truncated.lastIndexOf(' ');
  return truncated.slice(0, lastSpace > 30 ? lastSpace : 57) + '...';
}

function generateMetaDescription(content, focusKeyword) {
  const clean = stripMarkdown(content);
  if (!clean) return '';
  const sentences = clean.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0);
  if (sentences.length === 0) return '';
  let startIdx = 0;
  if (focusKeyword) {
    const kw = focusKeyword.toLowerCase();
    const idx = sentences.findIndex((s) => s.toLowerCase().includes(kw));
    if (idx > 0) startIdx = idx;
  }
  let result = '';
  for (let i = startIdx; i < sentences.length; i++) {
    const next = result ? result + ' ' + sentences[i] : sentences[i];
    if (next.length > 160) {
      if (result.length < 50) result = next;
      break;
    }
    result = next;
    if (result.length >= 140) break;
  }
  if (result.length > 160) {
    const truncated = result.slice(0, 155);
    const lastSpace = truncated.lastIndexOf(' ');
    return truncated.slice(0, lastSpace > 100 ? lastSpace : 155) + '...';
  }
  return result;
}

// ============================================================
// Helpers D1 via wrangler
// ============================================================
function d1QueryJSON(sql) {
  // Workaround Windows shell: escapar aspas duplas. SQL deve ser single-line.
  const escapedSql = sql.replace(/\n/g, ' ').replace(/"/g, '\\"').trim();
  const cmd = `npx wrangler d1 execute paulgomes-painel --remote --json --command="${escapedSql}"`;
  const result = execSync(cmd, { cwd: PROJECT_ROOT, encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024 });
  // wrangler output mistura logs e JSON — encontra o array JSON
  const jsonStart = result.indexOf('[\n');
  if (jsonStart === -1) {
    throw new Error(`Nao achou JSON na saida do wrangler:\n${result.slice(0, 500)}`);
  }
  const jsonText = result.slice(jsonStart);
  const parsed = JSON.parse(jsonText);
  return parsed[0]?.results || [];
}

function d1ExecuteFile(sqlPath) {
  if (isDryRun) {
    console.log(`[DRY] wrangler d1 execute --file=${sqlPath}`);
    return;
  }
  execSync(
    `npx wrangler d1 execute paulgomes-painel --remote --file="${sqlPath}"`,
    { cwd: PROJECT_ROOT, stdio: 'inherit' }
  );
}

// ============================================================
// Frontmatter surgical injection
// ============================================================
function injectSeoFields(mdContent, fields) {
  // fields = { focusKeyword, metaTitle, metaDescription } — só preenche o que NAO está presente
  const lines = mdContent.split('\n');
  // Encontra os 2 primeiros `---`
  let openIdx = -1, closeIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      if (openIdx === -1) openIdx = i;
      else if (closeIdx === -1) { closeIdx = i; break; }
    }
  }
  if (openIdx === -1 || closeIdx === -1) {
    throw new Error('frontmatter nao encontrado (faltam markers ---)');
  }

  const fmLines = lines.slice(openIdx + 1, closeIdx);
  const hasFocus = fmLines.some((l) => /^focusKeyword\s*:/.test(l));
  const hasMt = fmLines.some((l) => /^metaTitle\s*:/.test(l));
  const hasMd = fmLines.some((l) => /^metaDescription\s*:/.test(l));

  const toInsert = [];
  if (!hasFocus && fields.focusKeyword) toInsert.push(`focusKeyword: ${JSON.stringify(fields.focusKeyword)}`);
  if (!hasMt && fields.metaTitle) toInsert.push(`metaTitle: ${JSON.stringify(fields.metaTitle)}`);
  if (!hasMd && fields.metaDescription) toInsert.push(`metaDescription: ${JSON.stringify(fields.metaDescription)}`);

  if (toInsert.length === 0) return { changed: false, content: mdContent };

  // Insere ANTES do closeIdx (que é o `---` de fechamento)
  const newLines = [
    ...lines.slice(0, closeIdx),
    ...toInsert,
    ...lines.slice(closeIdx),
  ];
  return { changed: true, content: newLines.join('\n') };
}

// ============================================================
// SQL escape (simples — assume strings UTF-8 sem null bytes)
// ============================================================
function sqlString(s) {
  if (s === null || s === undefined || s === '') return 'NULL';
  return `'${String(s).replace(/'/g, "''")}'`;
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  console.log(`\n🔍 Backfill SEO ${isDryRun ? '(DRY RUN)' : '(LIVE)'}\n`);

  // 1. Busca posts sem SEO completo
  console.log('📡 Buscando posts em D1...');
  const posts = d1QueryJSON(`
    SELECT slug, title, content_md, hero_image_url, published_at, is_featured, description,
           focus_keyword, meta_title, meta_description
    FROM posts_meta
    WHERE status = 'published'
      AND (meta_title IS NULL OR meta_title = ''
           OR meta_description IS NULL OR meta_description = '')
  `);
  console.log(`📊 ${posts.length} posts sem SEO completo\n`);

  if (posts.length === 0) {
    console.log('✓ Nada a fazer.');
    return;
  }

  let analyzed = 0;
  let mdUpdated = 0;
  let mdSkipped = 0;
  let mdNotFound = 0;
  const failures = [];
  const sampleRows = [];
  const sqlUpdates = [];

  for (const post of posts) {
    try {
      // Le content do .md local se D1 nao tem (defesa)
      let content = post.content_md || '';
      const slug = post.slug;
      const mdPath = path.join(BLOG_DIR, `${slug}.md`);
      const mdxPath = path.join(BLOG_DIR, `${slug}.mdx`);
      const targetPath = existsSync(mdxPath) ? mdxPath : (existsSync(mdPath) ? mdPath : null);

      if (!content && targetPath) {
        const full = readFileSync(targetPath, 'utf-8');
        const parts = full.split(/^---$/m);
        content = parts.length >= 3 ? parts.slice(2).join('---').trim() : full;
      }

      const focusKw = post.focus_keyword || detectFocusKeyword(post.title || '', content);
      const metaTitle = post.meta_title || generateMetaTitle(post.title || '', focusKw);
      const metaDesc = post.meta_description || generateMetaDescription(content, focusKw);

      analyzed++;

      // Coleta SQL UPDATE (só campos que ainda estao vazios)
      const sets = [];
      if (!post.focus_keyword && focusKw) sets.push(`focus_keyword = ${sqlString(focusKw)}`);
      if (!post.meta_title && metaTitle) sets.push(`meta_title = ${sqlString(metaTitle)}`);
      if (!post.meta_description && metaDesc) sets.push(`meta_description = ${sqlString(metaDesc)}`);

      if (sets.length > 0) {
        sets.push(`updated_at = ${Date.now()}`);
        sqlUpdates.push(`UPDATE posts_meta SET ${sets.join(', ')} WHERE slug = ${sqlString(slug)};`);
      }

      // Atualiza .md local (surgical)
      if (targetPath && !isDryRun) {
        const fileContent = readFileSync(targetPath, 'utf-8');
        const result = injectSeoFields(fileContent, { focusKeyword: focusKw, metaTitle, metaDescription: metaDesc });
        if (result.changed) {
          writeFileSync(targetPath, result.content, 'utf-8');
          mdUpdated++;
        } else {
          mdSkipped++;
        }
      } else if (!targetPath) {
        mdNotFound++;
      }

      if (sampleRows.length < 5) {
        sampleRows.push({ slug, focusKw, metaTitle, metaDesc: metaDesc.slice(0, 80) + '...' });
      }
    } catch (err) {
      failures.push({ slug: post.slug, error: err.message });
      console.error(`❌ ${post.slug}: ${err.message}`);
    }
  }

  // Executa SQL em batch
  if (sqlUpdates.length > 0) {
    const sqlFile = path.join(PROJECT_ROOT, 'tmp-seo-backfill.sql');
    writeFileSync(sqlFile, sqlUpdates.join('\n') + '\n', 'utf-8');
    console.log(`\n🚀 Aplicando ${sqlUpdates.length} UPDATEs em D1 remoto...`);
    try {
      d1ExecuteFile(sqlFile);
    } finally {
      if (existsSync(sqlFile) && !isDryRun) unlinkSync(sqlFile);
    }
  }

  console.log('\n═══════════════════════════════════════');
  console.log('📈 Resumo:');
  console.log(`   Posts analisados:    ${analyzed}`);
  console.log(`   D1 UPDATEs:          ${sqlUpdates.length}`);
  console.log(`   .md atualizados:     ${mdUpdated}`);
  console.log(`   .md sem mudanca:     ${mdSkipped} (3 campos ja presentes)`);
  console.log(`   .md nao encontrado:  ${mdNotFound}`);
  console.log(`   Falhas:              ${failures.length}`);

  if (sampleRows.length > 0) {
    console.log('\n📝 Amostras (5 primeiras):');
    for (const s of sampleRows) {
      console.log(`\n   ${s.slug}`);
      console.log(`     keyword: ${s.focusKw || '(nao detectada)'}`);
      console.log(`     title:   ${s.metaTitle}`);
      console.log(`     desc:    ${s.metaDesc}`);
    }
  }

  if (failures.length > 0) {
    console.log('\n❌ Falhas:');
    for (const f of failures) console.log(`   ${f.slug}: ${f.error}`);
  }

  if (isDryRun) {
    console.log('\n⚠️  DRY RUN — nada foi aplicado em D1 nem em arquivos.');
  } else {
    console.log('\n✓ D1 remoto atualizado.');
    console.log('  Proximo: git diff src/content/blog/ && git commit');
  }
}

main().catch((err) => {
  console.error('\n❌ Falha geral:', err);
  process.exit(1);
});
