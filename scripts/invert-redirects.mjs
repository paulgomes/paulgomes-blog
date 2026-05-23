// Inverte os redirects de /slug → /blog/slug pra /blog/slug → /slug
// Preserva comentários, linhas em branco, e redirects que não seguem o padrão
// (ex: /about /sobre 301).
//
// Roda com: node scripts/invert-redirects.mjs

import { readFile, writeFile } from 'node:fs/promises';

const FILE = 'public/_redirects';
const raw = await readFile(FILE, 'utf8');
const lines = raw.split('\n');

// Padrão: /<slug>[/]? /blog/<slug> 301
// Captura: 1=slug, 2=trailing slash (optional), 3=target slug, 4=status
const RE = /^(\/[^\s/]+)(\/?)\s+\/blog\/([^\s]+)\s+(\d+)\s*$/;

let inverted = 0;
let preserved = 0;
let blanks = 0;
let comments = 0;

const out = lines.map((line) => {
  if (line.trim() === '') { blanks++; return line; }
  if (line.startsWith('#')) { comments++; return line; }

  const m = line.match(RE);
  if (!m) {
    preserved++;
    return line;
  }
  const [, fromSlug, trailingSlash, targetSlug, status] = m;
  // Só inverte se from e target apontam pro MESMO slug (padrão esperado)
  // Ex: /post-x /blog/post-x 301
  // Compara sem barra final
  const fromBase = fromSlug.slice(1);
  if (fromBase !== targetSlug) {
    preserved++;
    return line;
  }
  inverted++;
  return `/blog/${targetSlug}${trailingSlash} /${targetSlug} ${status}`;
});

await writeFile(FILE, out.join('\n'));

console.log(`✓ public/_redirects atualizado`);
console.log(`  invertidos: ${inverted}`);
console.log(`  preservados (outros redirects): ${preserved}`);
console.log(`  comentários: ${comments}`);
console.log(`  linhas em branco: ${blanks}`);
