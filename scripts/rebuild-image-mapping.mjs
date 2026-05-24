// Reescreve scripts/image-mapping.json com schema híbrido:
// chaves "library/<file>" e "inline/<file>" → URLs absolutas R2.

import { readdir, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const PUBLIC_DOMAIN = 'https://media.paulgomes.com.br';
const LIBRARY_DIR = 'src/assets/posts/library';
const INLINE_DIR = 'src/assets/posts/inline';

async function listFiles(dir) {
  try {
    const files = await readdir(dir);
    const out = [];
    for (const f of files) {
      const path = join(dir, f);
      const st = await stat(path);
      if (st.isFile()) out.push(f);
    }
    return out;
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

const mapping = {};

// library/
const lib = await listFiles(LIBRARY_DIR);
for (const f of lib) {
  mapping[`library/${f}`] = `${PUBLIC_DOMAIN}/posts/legacy/${f}`;
}

// inline/
const inl = await listFiles(INLINE_DIR);
for (const f of inl) {
  mapping[`inline/${f}`] = `${PUBLIC_DOMAIN}/posts/legacy/inline/${f}`;
}

await writeFile('scripts/image-mapping.json', JSON.stringify(mapping, null, 2));
console.log(`✓ scripts/image-mapping.json regerado`);
console.log(`  library/  → ${lib.length} entries`);
console.log(`  inline/   → ${inl.length} entries`);
console.log(`  total:    ${Object.keys(mapping).length}`);
