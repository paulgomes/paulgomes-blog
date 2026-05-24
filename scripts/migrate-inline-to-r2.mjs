// Migra imagens de src/assets/posts/inline/ pro R2 em /posts/legacy/inline/<filename>.
// Muitos arquivos não têm extensão — content-type via magic-number sniffing.
//
// --dry-run: lista + sniff de mime, sem subir.
//
// Rode:
//   node scripts/migrate-inline-to-r2.mjs --dry-run
//   node scripts/migrate-inline-to-r2.mjs

import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const SOURCE_DIR = 'src/assets/posts/inline';
const R2_BUCKET = 'paulgomes-uploads';
const R2_PREFIX = 'posts/legacy/inline';
const PUBLIC_DOMAIN = 'https://media.paulgomes.com.br';
const DRY_RUN = process.argv.includes('--dry-run');

async function detectMime(filepath) {
  const fd = await readFile(filepath);
  const head = fd.slice(0, 200);
  // PNG: 89 50 4E 47
  if (head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4E && head[3] === 0x47) return 'image/png';
  // JPEG: FF D8 FF
  if (head[0] === 0xFF && head[1] === 0xD8 && head[2] === 0xFF) return 'image/jpeg';
  // GIF: 47 49 46 38 (GIF8)
  if (head[0] === 0x47 && head[1] === 0x49 && head[2] === 0x46 && head[3] === 0x38) return 'image/gif';
  // WebP: RIFF....WEBP
  if (head[0] === 0x52 && head[1] === 0x49 && head[2] === 0x46 && head[3] === 0x46 &&
      head[8] === 0x57 && head[9] === 0x45 && head[10] === 0x42 && head[11] === 0x50) {
    return 'image/webp';
  }
  // SVG (texto)
  const text = head.toString('utf8').toLowerCase();
  if (text.includes('<svg')) return 'image/svg+xml';
  if (text.startsWith('<?xml') && text.includes('<svg')) return 'image/svg+xml';
  return null;
}

async function r2Exists(filename, expectedSize) {
  const url = `${PUBLIC_DOMAIN}/${R2_PREFIX}/${encodeURIComponent(filename)}`;
  try {
    const res = await fetch(url, { method: 'HEAD' });
    if (!res.ok) return false;
    const length = parseInt(res.headers.get('content-length') || '0', 10);
    return length === expectedSize;
  } catch {
    return false;
  }
}

function uploadOne(filename, contentType) {
  const sourcePath = join(SOURCE_DIR, filename).replace(/\\/g, '/');
  const targetKey = `${R2_PREFIX}/${filename}`;
  const cmd = `npx wrangler r2 object put "${R2_BUCKET}/${targetKey}" --file="${sourcePath}" --content-type=${contentType} --remote`;
  execSync(cmd, { stdio: 'pipe' });
}

async function main() {
  console.log(DRY_RUN ? '📋 DRY RUN MODE — nada será enviado\n' : '🚀 LIVE MODE — enviando inline pro R2\n');

  const all = await readdir(SOURCE_DIR);
  const entries = [];
  for (const f of all) {
    const path = join(SOURCE_DIR, f);
    const st = await stat(path);
    if (!st.isFile()) continue;
    const mime = await detectMime(path);
    entries.push({ filename: f, size: st.size, mime });
  }

  console.log(`Arquivos encontrados: ${entries.length}\n`);

  const byMime = {};
  let totalSize = 0;
  let skippedUnknown = 0;
  for (const e of entries) {
    const key = e.mime || 'desconhecido (SKIP)';
    byMime[key] = (byMime[key] || 0) + 1;
    totalSize += e.size;
    if (!e.mime) skippedUnknown++;
  }
  console.log('Content-Type por sniffing:');
  for (const [k, v] of Object.entries(byMime).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k}: ${v}`);
  }
  console.log(`\nTamanho total: ${(totalSize / 1024 / 1024).toFixed(1)} MB`);
  if (skippedUnknown > 0) {
    console.log(`\n⚠️  ${skippedUnknown} arquivo(s) com mime desconhecido serão pulados:`);
    for (const e of entries.filter((x) => !x.mime).slice(0, 5)) {
      console.log(`    - ${e.filename}`);
    }
  }

  console.log('\nAmostra de 5 destinos:');
  for (const e of entries.filter((x) => x.mime).slice(0, 5)) {
    console.log(`  inline/${e.filename}`);
    console.log(`    → ${PUBLIC_DOMAIN}/${R2_PREFIX}/${e.filename}`);
  }

  if (DRY_RUN) {
    console.log('\n⚠️  Pra executar de verdade, rode sem --dry-run');
    return;
  }

  let uploaded = 0, skipped = 0, errors = 0;
  const errDetails = [];
  const uploadable = entries.filter((e) => e.mime);

  for (let i = 0; i < uploadable.length; i++) {
    const e = uploadable[i];
    const exists = await r2Exists(e.filename, e.size);
    if (exists) {
      skipped++;
    } else {
      try {
        uploadOne(e.filename, e.mime);
        uploaded++;
      } catch (err) {
        errors++;
        errDetails.push(`${e.filename}: ${err.message || err}`);
      }
    }
    if ((i + 1) % 10 === 0 || i + 1 === uploadable.length) {
      console.log(`  [${i + 1}/${uploadable.length}] uploaded=${uploaded} skipped=${skipped} errors=${errors}`);
    }
  }

  console.log(`\n✅ ${uploaded} arquivos enviados pro R2 (inline/)`);
  console.log(`⏭️  ${skipped} pulados (já existiam)`);
  console.log(`❌ ${errors} erros`);
  console.log(`⏭️  ${skippedUnknown} sem mime detectado (não enviados)`);
  if (errors > 0) {
    console.log('Primeiros erros:');
    for (const e of errDetails.slice(0, 5)) console.log(`  - ${e}`);
  }
}

main().catch((err) => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
