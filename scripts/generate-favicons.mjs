// Gera os favicons a partir de public/favicon-source.png
// Roda com: node scripts/generate-favicons.mjs

import sharp from 'sharp';
import { join } from 'node:path';
import { stat } from 'node:fs/promises';

const INPUT = 'public/favicon-source.png';
const OUTPUTS = [
  { name: 'favicon-32.png', size: 32 },
  { name: 'favicon-64.png', size: 64 },
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
];

console.log('🎨 Gerando favicons a partir de', INPUT, '\n');

const beforeStat = await stat(INPUT);
console.log(`  source: ${(beforeStat.size / 1024).toFixed(0)} KB\n`);

for (const out of OUTPUTS) {
  const outPath = join('public', out.name);
  await sharp(INPUT)
    .resize({ width: out.size, height: out.size, fit: 'cover', position: 'attention' })
    .png({ compressionLevel: 9, quality: 92 })
    .toFile(outPath);
  const s = await stat(outPath);
  console.log(`  ✓ ${out.name.padEnd(25)} ${out.size}×${out.size}  →  ${(s.size / 1024).toFixed(1)} KB`);
}

console.log('\n✅ Favicons gerados em public/');
