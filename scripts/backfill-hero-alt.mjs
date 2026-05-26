#!/usr/bin/env node
/**
 * Backfill hero_image_alt = title em posts publicados sem alt.
 *
 * - Filtra: status='published' AND hero_image_url IS NOT NULL AND (hero_image_alt IS NULL OR '').
 *   (alt nao faz sentido sem imagem)
 * - Aplica D1 em batch unico (1 wrangler call) + injeta linha no .md surgical.
 * - Idempotente: rodar de novo pula posts ja com alt.
 *
 * Uso: node scripts/backfill-hero-alt.mjs
 */

import { execSync } from 'node:child_process';
import { writeFileSync, readFileSync, existsSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const BLOG_DIR = path.join(PROJECT_ROOT, 'src/content/blog');

function d1QueryJSON(sql) {
  const escaped = sql.replace(/\n/g, ' ').replace(/"/g, '\\"').trim();
  const cmd = `npx wrangler d1 execute paulgomes-painel --remote --json --command="${escaped}"`;
  const result = execSync(cmd, { cwd: PROJECT_ROOT, encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024 });
  const jsonStart = result.indexOf('[\n');
  if (jsonStart === -1) throw new Error(`JSON nao encontrado:\n${result.slice(0, 500)}`);
  const parsed = JSON.parse(result.slice(jsonStart));
  return parsed[0]?.results || [];
}

function sqlString(s) {
  if (s === null || s === undefined || s === '') return 'NULL';
  return `'${String(s).replace(/'/g, "''")}'`;
}

function injectHeroAlt(mdContent, alt) {
  // Insere linha `heroImageAlt:` logo depois da linha `heroImage:` (apenas se nao existir)
  if (/^heroImageAlt\s*:/m.test(mdContent)) return { changed: false, content: mdContent };
  if (!/^heroImage\s*:/m.test(mdContent)) return { changed: false, content: mdContent };

  const altLine = `heroImageAlt: ${JSON.stringify(alt)}`;
  const newContent = mdContent.replace(
    /^(heroImage\s*:.*)$/m,
    `$1\n${altLine}`
  );
  return { changed: true, content: newContent };
}

async function main() {
  console.log('\n🔍 Backfill hero_image_alt = title\n');

  const posts = d1QueryJSON(`
    SELECT slug, title
    FROM posts_meta
    WHERE status = 'published'
      AND hero_image_url IS NOT NULL
      AND hero_image_url != ''
      AND (hero_image_alt IS NULL OR hero_image_alt = '')
  `);
  console.log(`📊 ${posts.length} posts sem alt (com hero)\n`);

  if (posts.length === 0) {
    console.log('✓ Nada a fazer.');
    return;
  }

  // SQL batch UPDATE
  const now = Date.now();
  const updates = posts.map((p) =>
    `UPDATE posts_meta SET hero_image_alt = ${sqlString(p.title)}, updated_at = ${now} WHERE slug = ${sqlString(p.slug)};`
  );
  const sqlFile = path.join(PROJECT_ROOT, 'tmp-hero-alt-backfill.sql');
  writeFileSync(sqlFile, updates.join('\n') + '\n', 'utf-8');

  console.log(`🚀 Aplicando ${updates.length} UPDATEs em D1 remoto...`);
  try {
    execSync(
      `npx wrangler d1 execute paulgomes-painel --remote --file="${sqlFile}"`,
      { cwd: PROJECT_ROOT, stdio: 'inherit' }
    );
  } finally {
    if (existsSync(sqlFile)) unlinkSync(sqlFile);
  }

  // Regenerar .md surgical
  console.log('\n📝 Atualizando frontmatter dos .md...');
  let mdUpdated = 0;
  let mdSkipped = 0;
  let mdNotFound = 0;
  const sampleRows = [];

  for (const p of posts) {
    const mdPath = path.join(BLOG_DIR, `${p.slug}.md`);
    const mdxPath = path.join(BLOG_DIR, `${p.slug}.mdx`);
    const target = existsSync(mdxPath) ? mdxPath : (existsSync(mdPath) ? mdPath : null);

    if (!target) {
      mdNotFound++;
      continue;
    }

    const original = readFileSync(target, 'utf-8');
    const result = injectHeroAlt(original, p.title);

    if (result.changed) {
      writeFileSync(target, result.content, 'utf-8');
      mdUpdated++;
    } else {
      mdSkipped++;
    }

    if (sampleRows.length < 3) {
      sampleRows.push({ slug: p.slug, alt: p.title });
    }
  }

  console.log('\n═══════════════════════════════════════');
  console.log('📈 Resumo:');
  console.log(`   D1 UPDATEs:          ${updates.length}`);
  console.log(`   .md atualizados:     ${mdUpdated}`);
  console.log(`   .md sem mudanca:     ${mdSkipped} (alt ja presente ou sem heroImage)`);
  console.log(`   .md nao encontrado:  ${mdNotFound}`);

  if (sampleRows.length > 0) {
    console.log('\n📝 Amostras:');
    for (const s of sampleRows) {
      console.log(`\n   ${s.slug}`);
      console.log(`     alt: ${s.alt}`);
    }
  }

  console.log('\n✓ D1 remoto atualizado. Proximo: git diff && git commit');
}

main().catch((err) => {
  console.error('\n❌ Falha:', err);
  process.exit(1);
});
