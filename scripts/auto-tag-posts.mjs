// Auto-taggear posts em src/content/blog/ com 1-3 tags.
//
// Modo padrão (sem flag) = PREVIEW: mostra 5 amostras representativas e SAI.
// Modo --apply: escreve a chave `tags:` no frontmatter de TODOS os posts
//               (pula posts que já têm `tags:` no frontmatter).
//
// Rode:
//   node scripts/auto-tag-posts.mjs              # preview
//   node scripts/auto-tag-posts.mjs --apply      # aplica em massa

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const BLOG_DIR = 'src/content/blog';
const APPLY = process.argv.includes('--apply');

const KEYWORDS = {
  'IA':         /\b(ia|inteligência artificial|inteligencia artificial|gpt|chatgpt|claude|llm|machine learning|aprendizado de máquina|aprendizado de maquina|openai|anthropic|gemini|copilot|gen ai|generative ai)\b/gi,
  'GEO':        /\b(geo|aeo|generative engine|answer engine|perplexity|ai search|busca generativa|sge|search generative experience)\b/gi,
  'SEO':        /\b(seo|ranqueamento|google search|search console|serp|meta tag|sitemap|backlink|on-page|off-page|posicionamento|tráfego orgânico|trafego organico|keyword)\b/gi,
  'Branding':   /\b(branding|identidade visual|identidade de marca|logo|naming|posicionamento de marca|brand|reposicionamento)\b/gi,
  'Tecnologia': /\b(tecnologia|inovação|inovacao|software|desenvolvimento|hardware|tech|digital|programação|programacao|api|cloud|nuvem|iot|3d|impressão 3d|impressao 3d|wordpress|astro|plugin)\b/gi,
  'Negócios':   /\b(negócio|negocio|empresa|empreendedor|empreendedorismo|mercado|vendas|estratégia|estrategia|gestão|gestao|liderança|lideranca|crm|erp|kotler|marketing|cliente)\b/gi,
};

function parseFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---(\r?\n)([\s\S]*)$/);
  if (!m) return null;
  return { fm: m[1], fmEnd: m[2], body: m[3] };
}

function getField(fm, field) {
  const re = new RegExp(`^${field}:\\s*(.*?)\\s*$`, 'm');
  const m = fm.match(re);
  if (!m) return '';
  let v = m[1];
  // Strip surrounding quotes
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  return v;
}

function detectLineEnding(text) {
  return text.includes('\r\n') ? '\r\n' : '\n';
}

function scoreText(text) {
  const scores = {};
  let total = 0;
  for (const [tag, re] of Object.entries(KEYWORDS)) {
    const matches = text.match(re);
    const n = matches ? matches.length : 0;
    scores[tag] = n;
    total += n;
  }
  return { scores, total };
}

function pickTags(scores, total) {
  if (total === 0) return ['Tecnologia']; // fallback
  // Ordena por score desc, mantém só os que têm score >= 1
  const entries = Object.entries(scores)
    .filter(([, v]) => v >= 1)
    .sort(([, a], [, b]) => b - a);
  if (entries.length === 0) return ['Tecnologia'];

  // 1ª tag: sempre a com mais matches (≥1)
  const result = [entries[0][0]];

  // 2ª tag: SÓ entra se tiver ≥3 matches (cap em TOP 2)
  if (entries.length >= 2 && entries[1][1] >= 3) {
    result.push(entries[1][0]);
  }

  return result;
}

function alreadyHasTags(fm) {
  return /^tags:\s*$/m.test(fm) || /^tags:\s*\[/m.test(fm);
}

async function listPosts() {
  const files = await readdir(BLOG_DIR);
  return files.filter((f) => f.endsWith('.md') || f.endsWith('.mdx'));
}

async function analyzeOne(filename) {
  const path = join(BLOG_DIR, filename);
  const raw = await readFile(path, 'utf8');
  const parsed = parseFrontmatter(raw);
  if (!parsed) return null;
  const { fm, body } = parsed;
  const title = getField(fm, 'title');
  const description = getField(fm, 'description');
  const corpus = [title, description, body.slice(0, 2000)].join('\n');
  const { scores, total } = scoreText(corpus);
  const tags = pickTags(scores, total);
  return { filename, title, description, fm, scores, total, tags, raw, lineEnding: detectLineEnding(raw) };
}

async function analyzeAll() {
  const files = await listPosts();
  const results = [];
  for (const f of files) {
    const r = await analyzeOne(f);
    if (r) results.push(r);
  }
  return results;
}

function fmt(post) {
  const scoresPretty = Object.entries(post.scores)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => `${k}: ${v}`)
    .join(', ') || '(zero matches)';
  return `[${post.filename}]
  title: ${post.title}
  matches: { ${scoresPretty} }
  → tags: [${post.tags.map((t) => `'${t}'`).join(', ')}]`;
}

async function preview(results) {
  console.log(`\n📋 Analisados: ${results.length} posts\n`);
  console.log('='.repeat(60));
  console.log('5 AMOSTRAS FIXAS (mesmos arquivos da rodada anterior)');
  console.log('='.repeat(60));

  const FIXED_SAMPLES = [
    ['IA óbvio',                         'brasil-e-um-dos-lideres-na-adocao-de-ia.md'],
    ['SEO óbvio',                        'seo-company-in-brisbane-australia.md'],
    ['Branding',                         'domine-o-mercado-torne-se-um-especialista-em-branding-e-conquiste-o-sucesso.md'],
    ['Fallback Tecnologia (zero matches)', '6-fotos-que-voce-precisa-ver.md'],
    ['Multi-match (verificar regra TOP 2 ≥3)', '10-dicas-de-marketing-digital-para-dermatologistas.md'],
  ];

  for (const [label, filename] of FIXED_SAMPLES) {
    const post = results.find((r) => r.filename === filename);
    if (!post) {
      console.log(`\n— ${label} —\n  (arquivo ${filename} não encontrado)`);
      continue;
    }
    console.log(`\n— ${label} —`);
    console.log(fmt(post));
  }

  // Histograma esperado se aplicar agora
  const histo = {};
  for (const r of results) {
    for (const t of r.tags) histo[t] = (histo[t] || 0) + 1;
  }
  console.log('\n' + '='.repeat(60));
  console.log('📊 Histograma esperado (se --apply for rodado):');
  for (const [tag, n] of Object.entries(histo).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${tag.padEnd(12)} ${n} posts`);
  }
  console.log('\nℹ️  Pra aplicar de verdade: node scripts/auto-tag-posts.mjs --apply');
}

async function applyAll(results) {
  let written = 0;
  let skipped = 0;
  const histo = {};

  for (const post of results) {
    const { filename, fm, raw, tags, lineEnding } = post;
    if (alreadyHasTags(fm)) {
      skipped++;
      continue;
    }

    // Constrói linhas de tags
    const tagLines = ['tags:', ...tags.map((t) => `  - ${t}`)].join(lineEnding);

    // Insere ANTES de heroImage (ou antes do fim do frontmatter se não houver heroImage)
    let newFm;
    if (/^heroImage:/m.test(fm)) {
      newFm = fm.replace(/^heroImage:/m, `${tagLines}${lineEnding}heroImage:`);
    } else {
      // Adiciona no fim do frontmatter
      newFm = fm + lineEnding + tagLines;
    }

    // Reconstrói arquivo
    const newRaw = raw.replace(fm, newFm);
    const path = join(BLOG_DIR, filename);
    await writeFile(path, newRaw, 'utf8');
    written++;
    for (const t of tags) histo[t] = (histo[t] || 0) + 1;
  }

  console.log(`\n✓ Auto-tag aplicado`);
  console.log(`  escritos: ${written}`);
  console.log(`  pulados (já tinham tags): ${skipped}`);
  console.log('\n📊 Distribuição final:');
  for (const [tag, n] of Object.entries(histo).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${tag.padEnd(12)} ${n} posts`);
  }
}

// === Main ===
const results = await analyzeAll();
if (APPLY) {
  await applyAll(results);
} else {
  await preview(results);
}
