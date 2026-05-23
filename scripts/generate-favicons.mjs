// Gera os favicons a partir de public/favicon-source.png
// Roda com: node scripts/generate-favicons.mjs

import sharp from 'sharp';
import pngToIco from 'png-to-ico';
import { writeFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

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

// 1. PNGs (32, 64, apple-touch, 192, 512)
for (const out of OUTPUTS) {
  const outPath = join('public', out.name);
  await sharp(INPUT)
    .resize({ width: out.size, height: out.size, fit: 'cover', position: 'attention' })
    .png({ compressionLevel: 9, quality: 92 })
    .toFile(outPath);
  const s = await stat(outPath);
  console.log(`  ✓ ${out.name.padEnd(25)} ${out.size}×${out.size}  →  ${(s.size / 1024).toFixed(1)} KB`);
}

// 2. favicon.ico multi-size (16, 32, 48)
const icoSizes = [16, 32, 48];
const icoBuffers = await Promise.all(
  icoSizes.map((size) =>
    sharp(INPUT)
      .resize({ width: size, height: size, fit: 'cover', position: 'attention' })
      .png({ compressionLevel: 9 })
      .toBuffer()
  )
);
const icoBuffer = await pngToIco(icoBuffers);
await writeFile('public/favicon.ico', icoBuffer);
const icoStat = await stat('public/favicon.ico');
console.log(`  ✓ favicon.ico               16/32/48 multi-size  →  ${(icoStat.size / 1024).toFixed(1)} KB`);

console.log('\n✅ Favicons gerados em public/');
