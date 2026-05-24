// Reescreve refs locais (../../assets/posts/library/ ou inline/) nos .md/.mdx
// pra URLs absolutas R2 usando scripts/image-mapping.json (schema híbrido).
//
// Cobre 4 padrões em ordem:
//   1) frontmatter heroImage
//   2) markdown ![]()
//   3) HTML <img src="...">
//   4) catchall (descriptions, qualquer texto)
//
// --dry-run: lista mudanças sem escrever.
//
// Rode:
//   node scripts/rewrite-mdx-to-r2.mjs --dry-run
//   node scripts/rewrite-mdx-to-r2.mjs

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const BLOG_DIR = 'src/content/blog';
const MAPPING_FILE = 'scripts/image-mapping.json';
const DRY_RUN = process.argv.includes('--dry-run');

const mapping = JSON.parse(await readFile(MAPPING_FILE, 'utf8'));

const PATTERNS = [
  {
    label: 'Pré-passo: limpeza description WP (path embutido)',
    re: /^(description:\s*["'])(.+?)\s*\.{2}\/\.{2}\/assets\/posts\/[^"'\n]+(["'])$/gm,
    replace: (_match, prefix, before, closingQuote) => {
      // Conta como sucesso — substitui o path por nada, mantém o texto narrativo
      return { text: `${prefix}${before}${closingQuote}` };
    },
  },
  {
    label: 'heroImage frontmatter',
    re: /^heroImage:\s*["']?\.\.\/\.\.\/assets\/posts\/(library|inline)\/([^"'\s]+)["']?/gm,
    replace: (_match, folder, file) => {
      const key = `${folder}/${file}`;
      const url = mapping[key];
      if (!url) return { miss: true, key };
      return { text: `heroImage: "${url}"` };
    },
  },
  {
    label: 'markdown ![](...) body',
    re: /!\[([^\]]*)\]\(\.\.\/\.\.\/assets\/posts\/(library|inline)\/([^)]+)\)/g,
    replace: (_match, alt, folder, file) => {
      // Lida com "filename title": pega só o arquivo, mantém o resto
      const tailMatch = file.match(/^([^\s]+)(\s+.*)?$/);
      const fname = tailMatch ? tailMatch[1] : file;
      const tail = tailMatch && tailMatch[2] ? tailMatch[2] : '';
      const key = `${folder}/${fname}`;
      const url = mapping[key];
      if (!url) return { miss: true, key };
      return { text: `![${alt}](${url}${tail})` };
    },
  },
  {
    label: 'HTML <img> body',
    re: /<img([^>]*?)src=["']\.\.\/\.\.\/assets\/posts\/(library|inline)\/([^"']+)["']/g,
    replace: (_match, attrs, folder, file) => {
      const key = `${folder}/${file}`;
      const url = mapping[key];
      if (!url) return { miss: true, key };
      return { text: `<img${attrs}src="${url}"` };
    },
  },
  {
    label: 'catchall (description / outros)',
    re: /\.\.\/\.\.\/assets\/posts\/(library|inline)\/([a-zA-Z0-9_\-\.=]+)/g,
    replace: (_match, folder, file) => {
      // Trim ellipsis trailing (2+ dots literais — artefato de migração)
      const cleanFile = file.replace(/\.{2,}$/, '');
      const key = `${folder}/${cleanFile}`;
      const url = mapping[key];
      if (!url) return { miss: true, key };
      return { text: url };
    },
  },
];

async function listPosts() {
  const files = await readdir(BLOG_DIR);
  return files.filter((f) => f.endsWith('.md') || f.endsWith('.mdx'));
}

function applyPattern(content, pattern, stats, warnings, filename) {
  return content.replace(pattern.re, (...args) => {
    const result = pattern.replace(...args);
    if (result.miss) {
      warnings.push({ filename, pattern: pattern.label, key: result.key });
      return args[0]; // original match string
    }
    stats[pattern.label] = (stats[pattern.label] || 0) + 1;
    return result.text;
  });
}

async function processOne(filename) {
  const path = join(BLOG_DIR, filename);
  const raw = await readFile(path, 'utf8');
  const stats = {};
  const warnings = [];
  let content = raw;
  for (const p of PATTERNS) {
    content = applyPattern(content, p, stats, warnings, filename);
  }
  return { filename, raw, content, stats, warnings, changed: raw !== content };
}

const posts = await listPosts();
const results = [];
for (const f of posts) results.push(await processOne(f));

const changed = results.filter((r) => r.changed);
const allWarnings = results.flatMap((r) => r.warnings);
const totalSubs = results.reduce(
  (s, r) => s + Object.values(r.stats).reduce((a, b) => a + b, 0),
  0
);

// Stats agregadas por tipo
const aggregated = {};
for (const r of results) {
  for (const [k, v] of Object.entries(r.stats)) {
    aggregated[k] = (aggregated[k] || 0) + v;
  }
}

if (DRY_RUN) {
  console.log('📋 DRY RUN — Reescrita MDX (nenhum arquivo modificado)\n');
  console.log(`Posts analisados: ${posts.length}`);
  console.log(`Posts com refs a reescrever: ${changed.length}`);
  console.log(`Posts sem mudanças: ${posts.length - changed.length}\n`);

  console.log('Por tipo de match:');
  for (const p of PATTERNS) {
    console.log(`  ${p.label}: ${aggregated[p.label] || 0}`);
  }
  console.log(`\nTotal de substituições: ${totalSubs}`);
  console.log(`Imagens NÃO encontradas no mapping: ${allWarnings.length}`);
  if (allWarnings.length > 0) {
    console.log('  Primeiras 5:');
    for (const w of allWarnings.slice(0, 5)) {
      console.log(`    - ${w.filename} [${w.pattern}]: ${w.key}`);
    }
  }

  // Amostra de 3 diffs mostrando body
  console.log('\nAmostra de 3 diffs:');
  const withBody = results.filter((r) =>
    Object.keys(r.stats).some((k) => k !== 'heroImage frontmatter' && r.stats[k] > 0)
  );
  const samples = withBody.length >= 3 ? withBody.slice(0, 3) : changed.slice(0, 3);
  for (const r of samples) {
    console.log(`\n  [${r.filename}] stats: ${JSON.stringify(r.stats)}`);
    // Mostra diff: linhas que mudaram
    const before = r.raw.split('\n');
    const after = r.content.split('\n');
    let shown = 0;
    for (let i = 0; i < Math.min(before.length, after.length) && shown < 3; i++) {
      if (before[i] !== after[i]) {
        console.log(`    - ${before[i].slice(0, 110).trimEnd()}`);
        console.log(`    + ${after[i].slice(0, 110).trimEnd()}`);
        shown++;
      }
    }
  }
  console.log('\n⚠️  Pra aplicar, rode sem --dry-run');
} else {
  let written = 0;
  for (const r of changed) {
    await writeFile(join(BLOG_DIR, r.filename), r.content, 'utf8');
    written++;
  }
  console.log('Por tipo de match:');
  for (const p of PATTERNS) {
    console.log(`  ${p.label}: ${aggregated[p.label] || 0}`);
  }
  console.log(`\n✅ ${written} arquivos modificados`);
  console.log(`⏭️  ${posts.length - written} sem mudança`);
  console.log(`⚠️  ${allWarnings.length} warnings (refs não mapeadas)`);
  if (allWarnings.length > 0) {
    console.log('Primeiras 5:');
    for (const w of allWarnings.slice(0, 5)) {
      console.log(`  - ${w.filename} [${w.pattern}]: ${w.key}`);
    }
  }
}
