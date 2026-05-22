// Script para otimizar imagens da intro cinematográfica
// Reduz resolução para 1600px de largura e converte com qualidade ajustada
// Roda com: node scripts/optimize-intro.mjs

import sharp from 'sharp';
import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

const INPUT_DIR = 'src/assets/intro';
const MAX_WIDTH = 1600;
const QUALITY = 82;

console.log('🎬 Otimizando imagens da intro cinematográfica...\n');

const files = await readdir(INPUT_DIR);
const pngs = files.filter((f) => f.endsWith('.png')).sort();

let totalBefore = 0;
let totalAfter = 0;

for (const file of pngs) {
  const inputPath = join(INPUT_DIR, file);
  const outputPath = join(INPUT_DIR, file.replace('.png', '.webp'));

  const beforeStat = await stat(inputPath);
  totalBefore += beforeStat.size;

  await sharp(inputPath)
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .webp({ quality: QUALITY })
    .toFile(outputPath);

  const afterStat = await stat(outputPath);
  totalAfter += afterStat.size;

  const beforeMB = (beforeStat.size / 1024 / 1024).toFixed(2);
  const afterMB = (afterStat.size / 1024 / 1024).toFixed(2);
  const savings = ((1 - afterStat.size / beforeStat.size) * 100).toFixed(0);

  console.log(`  ✓ ${file.padEnd(25)} ${beforeMB}MB → ${afterMB}MB  (-${savings}%)`);
}

const totalBeforeMB = (totalBefore / 1024 / 1024).toFixed(2);
const totalAfterMB = (totalAfter / 1024 / 1024).toFixed(2);
const totalSavings = ((1 - totalAfter / totalBefore) * 100).toFixed(0);

console.log(`\n📊 Total: ${totalBeforeMB}MB → ${totalAfterMB}MB  (-${totalSavings}%)`);
console.log('✅ Otimização concluída!\n');
