// Migra imagens de src/assets/posts/library/ pro R2 (paulgomes-uploads)
// em /posts/legacy/<filename>, preservando o nome original.
//
// Modo padrão = LIVE: sobe os arquivos via `wrangler r2 object put`.
// --dry-run: só lista + estatísticas, não toca em R2.
//
// Idempotência: faz HEAD em media.paulgomes.com.br antes de subir;
// se já existe com mesmo content-length, SKIP.
//
// Output final: scripts/image-mapping.json (input da fase A3).
//
// Rode:
//   node scripts/migrate-images-to-r2.mjs --dry-run    # preview
//   node scripts/migrate-images-to-r2.mjs              # upload

import { readdir, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const SOURCE_DIR = 'src/assets/posts/library';
const R2_BUCKET = 'paulgomes-uploads';
const R2_PREFIX = 'posts/legacy';
const PUBLIC_DOMAIN = 'https://media.paulgomes.com.br';
const DRY_RUN = process.argv.includes('--dry-run');

const MIME_TYPES = {
  '.webp': 'image/webp',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png':  'image/png',
  '.gif':  'image/gif',
};

function getExt(name) {
  const m = name.toLowerCase().match(/\.[^.]+$/);
  return m ? m[0] : '';
}

function getMime(name) {
  return MIME_TYPES[getExt(name)] || 'application/octet-stream';
}

async function r2Exists(filename, expectedSize) {
  const url = `${PUBLIC_DOMAIN}/${R2_PREFIX}/${filename}`;
  try {
    const res = await fetch(url, { method: 'HEAD' });
    if (!res.ok) return false;
    const length = parseInt(res.headers.get('content-length') || '0', 10);
    return length === expectedSize;
  } catch {
    return false;
  }
}

function uploadOne(filename) {
  const sourcePath = join(SOURCE_DIR, filename).replace(/\\/g, '/');
  const targetKey = `${R2_PREFIX}/${filename}`;
  const contentType = getMime(filename);
  const cmd = `npx wrangler r2 object put "${R2_BUCKET}/${targetKey}" --file="${sourcePath}" --content-type=${contentType} --remote`;
  execSync(cmd, { stdio: 'pipe' });
}

async function main() {
  console.log(DRY_RUN
    ? '📋 DRY RUN MODE — nada será enviado\n'
    : '🚀 LIVE MODE — enviando arquivos pro R2\n');

  const all = await readdir(SOURCE_DIR);
  const files = all.filter((f) => MIME_TYPES[getExt(f)]);
  console.log(`Encontrei ${files.length} arquivos em ${SOURCE_DIR}\n`);

  // Tipo / tamanho
  const typeCounts = {};
  let totalSize = 0;
  for (const f of files) {
    const ext = getExt(f);
    typeCounts[ext] = (typeCounts[ext] || 0) + 1;
    const st = await stat(join(SOURCE_DIR, f));
    totalSize += st.size;
  }
  console.log('Tipos detectados:');
  for (const [ext, n] of Object.entries(typeCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${ext}: ${n}`);
  }
  console.log(`\nTamanho total: ${(totalSize / 1024 / 1024).toFixed(1)} MB\n`);

  // Mapping
  const mapping = {};
  for (const f of files) {
    mapping[f] = `${PUBLIC_DOMAIN}/${R2_PREFIX}/${f}`;
  }

  if (DRY_RUN) {
    console.log('Amostra de 5 mappings:');
    const sample = Object.entries(mapping).slice(0, 5);
    for (const [k, v] of sample) console.log(`  ${k} → ${v}`);
    console.log('\n⚠️  Pra executar de verdade, rode sem --dry-run');
    return;
  }

  // Upload real
  let uploaded = 0, skipped = 0, errors = 0;
  const errorDetails = [];

  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const st = await stat(join(SOURCE_DIR, f));

    const exists = await r2Exists(f, st.size);
    if (exists) {
      skipped++;
    } else {
      try {
        uploadOne(f);
        uploaded++;
      } catch (err) {
        errors++;
        errorDetails.push(`${f}: ${err.message || err}`);
      }
    }

    if ((i + 1) % 50 === 0) {
      console.log(`  [${i + 1}/${files.length}] uploaded=${uploaded} skipped=${skipped} errors=${errors}`);
    }
  }

  // Salva mapping
  await writeFile('scripts/image-mapping.json', JSON.stringify(mapping, null, 2));

  console.log(`\n✅ ${uploaded} arquivos enviados pro R2`);
  console.log(`⏭️  ${skipped} arquivos pulados (já existiam)`);
  console.log(`❌ ${errors} erros`);
  if (errors > 0) {
    console.log('\nPrimeiros erros:');
    for (const e of errorDetails.slice(0, 10)) console.log(`  - ${e}`);
  }
  console.log(`📄 scripts/image-mapping.json gerado (${Object.keys(mapping).length} entries)`);
}

main().catch((err) => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
