// Importa os 115 posts de src/content/blog/ pra tabela posts_meta no D1.
// Gera um SQL com INSERT ... ON CONFLICT(slug) DO UPDATE (idempotente).
//
// --dry-run: lista amostras + estatísticas, não toca em D1.
// (sem flag): grava scripts/import-posts.sql e executa via wrangler.
//
// Rode:
//   node scripts/import-posts-to-d1.mjs --dry-run
//   node scripts/import-posts-to-d1.mjs

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';

const BLOG_DIR = 'src/content/blog';
const SQL_FILE = 'scripts/import-posts.sql';
const DRY_RUN = process.argv.includes('--dry-run');

function gitBlobSha(content) {
  const buf = Buffer.from(content, 'utf8');
  const header = `blob ${buf.length}\0`;
  const sha = createHash('sha1');
  sha.update(header);
  sha.update(buf);
  return sha.digest('hex');
}

function parseFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!m) return null;
  return { fm: m[1], body: m[2] };
}

function getField(fm, field) {
  const re = new RegExp(`^${field}:\\s*(.*?)\\s*$`, 'm');
  const m = fm.match(re);
  if (!m) return null;
  let v = m[1];
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  return v;
}

function getTags(fm) {
  const block = fm.match(/^tags:\s*\r?\n((?:[ \t]+-\s+.*\r?\n?)+)/m);
  if (!block) return [];
  const lines = block[1].split(/\r?\n/);
  const tags = [];
  for (const l of lines) {
    const m = l.match(/^[ \t]+-\s+(.+)$/);
    if (m) tags.push(m[1].trim().replace(/^["']|["']$/g, ''));
  }
  return tags;
}

function sqlString(s) {
  if (s === null || s === undefined) return 'NULL';
  return "'" + String(s).replace(/'/g, "''") + "'";
}

function sqlNumber(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return 'NULL';
  return String(n);
}

async function getAdmin() {
  try {
    const out = execSync(
      'npx wrangler d1 execute paulgomes-painel --remote --command="SELECT id, email FROM users WHERE role=\'admin\' LIMIT 1" --json',
      { encoding: 'utf8' }
    );
    const json = JSON.parse(out);
    const result = Array.isArray(json) ? json[0] : json;
    const rows = result?.results || [];
    if (rows.length > 0) return rows[0];
    return null;
  } catch (err) {
    console.error('  ⚠️  Falha ao buscar admin:', String(err).slice(0, 200));
    return null;
  }
}

async function main() {
  console.log(DRY_RUN ? '📋 DRY RUN — Import D1\n' : '🚀 LIVE — Import D1\n');

  console.log('Buscando author admin no D1...');
  const admin = await getAdmin();
  if (admin) {
    console.log(`Author admin: ${admin.id} (${admin.email})`);
  } else {
    console.log('Nenhum admin encontrado — author_id será NULL');
  }

  const files = (await readdir(BLOG_DIR))
    .filter((f) => f.endsWith('.md') || f.endsWith('.mdx'))
    .sort();
  console.log(`\nPosts a inserir: ${files.length}\n`);

  const records = [];
  let totalContentLen = 0;

  for (const filename of files) {
    const path = join(BLOG_DIR, filename);
    const raw = await readFile(path, 'utf8');
    const parsed = parseFrontmatter(raw);
    if (!parsed) {
      console.warn(`⚠️  Frontmatter inválido: ${filename}`);
      continue;
    }
    const { fm, body } = parsed;

    const slug = filename.replace(/\.(md|mdx)$/, '');
    const title = getField(fm, 'title') || 'Sem título';
    const description = getField(fm, 'description') || '';
    const pubDateStr = getField(fm, 'pubDate');
    const heroImage = getField(fm, 'heroImage');
    const tags = getTags(fm);

    const pubDate = pubDateStr ? new Date(pubDateStr).getTime() : Date.now();
    const contentMd = body.trim();
    totalContentLen += contentMd.length;

    records.push({
      slug,
      title,
      description,
      contentMd,
      heroImageUrl: heroImage,
      tagsJson: JSON.stringify(tags),
      tagsArr: tags,
      authorId: admin?.id || null,
      publishedAt: pubDate,
      updatedAt: pubDate,
      githubPath: `src/content/blog/${filename}`,
      githubSha: gitBlobSha(raw),
    });
  }

  if (DRY_RUN) {
    const avg = Math.round(totalContentLen / records.length);
    console.log(`Tamanho médio content_md: ${avg} chars\n`);
    console.log('Amostras (3):\n');
    for (const r of records.slice(0, 3)) {
      const pubISO = new Date(r.publishedAt).toISOString().slice(0, 10);
      console.log(`  [${r.slug}]`);
      console.log(`     title="${r.title}"`);
      console.log(`     hero=${r.heroImageUrl}`);
      console.log(`     tags=[${r.tagsArr.join(', ')}] pub=${pubISO} (${r.publishedAt}) sha=${r.githubSha.slice(0, 7)}`);
      console.log(`     content_md=${r.contentMd.length} chars`);
      console.log('');
    }
    console.log('⚠️  Pra aplicar, rode sem --dry-run');
    return;
  }

  // Build SQL (sem BEGIN/COMMIT — D1 não aceita, cada INSERT é auto-commit)
  console.log('Gerando SQL...');
  const sqlLines = [];
  for (const r of records) {
    const cols = `(slug, title, description, content_md, hero_image_url, tags, author_id, published_at, updated_at, github_path, github_sha)`;
    const vals = [
      sqlString(r.slug),
      sqlString(r.title),
      sqlString(r.description),
      sqlString(r.contentMd),
      sqlString(r.heroImageUrl),
      sqlString(r.tagsJson),
      r.authorId ? sqlString(r.authorId) : 'NULL',
      sqlNumber(r.publishedAt),
      sqlNumber(r.updatedAt),
      sqlString(r.githubPath),
      sqlString(r.githubSha),
    ].join(', ');
    sqlLines.push(
      `INSERT INTO posts_meta ${cols} VALUES (${vals})\n` +
      `ON CONFLICT(slug) DO UPDATE SET\n` +
      `  title=excluded.title,\n` +
      `  description=excluded.description,\n` +
      `  content_md=excluded.content_md,\n` +
      `  hero_image_url=excluded.hero_image_url,\n` +
      `  tags=excluded.tags,\n` +
      `  author_id=excluded.author_id,\n` +
      `  updated_at=excluded.updated_at,\n` +
      `  github_path=excluded.github_path,\n` +
      `  github_sha=excluded.github_sha;`
    );
  }
  const sqlText = sqlLines.join('\n');
  await writeFile(SQL_FILE, sqlText, 'utf8');
  console.log(`✓ ${SQL_FILE} gerado (${(sqlText.length / 1024).toFixed(0)} KB, ${records.length} INSERTs)`);

  console.log('\nExecutando no D1 remoto...');
  execSync(`npx wrangler d1 execute paulgomes-painel --remote --file="${SQL_FILE}"`, { stdio: 'inherit' });
  console.log('\n✅ Import completo');
}

main().catch((err) => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
