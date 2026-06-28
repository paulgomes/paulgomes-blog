import sharp from 'sharp';
import { existsSync } from 'node:fs';

// Gera public/og-image.png (1200x630) a partir de uma imagem-fonte.
// Origem: 1o argumento da CLI, ou ./og-source.png na raiz do repo.
//   node scripts/process-og.mjs caminho/para/og.png
const src = process.argv[2] ?? 'og-source.png';

if (!existsSync(src)) {
  console.error(`✗ Fonte nao encontrada: ${src}`);
  console.error('  Uso: node scripts/process-og.mjs <caminho-da-imagem-fonte>');
  process.exit(1);
}

await sharp(src)
  .resize(1200, 630, { fit: 'cover', position: 'center' })
  .png({ quality: 90 })
  .toFile('public/og-image.png');

console.log(`✓ public/og-image.png gerado (1200x630) a partir de ${src}`);
