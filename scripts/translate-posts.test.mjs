#!/usr/bin/env node
/**
 * Teste do pipeline de tradução SEM chamar a API.
 *
 * Mocka o `fetch` global com um tradutor-identidade (devolve o texto de entrada
 * sem alterar) e roda o pipeline sobre TODOS os posts reais do acervo. O que se
 * verifica aqui não é a qualidade da tradução — é que a transformação não
 * corrompe frontmatter, não perde corpo e não mexe nas categorias (enum que é
 * gate de build).
 *
 *   node scripts/translate-posts.test.mjs
 */

import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC_DIR = path.join(ROOT, 'src/content/blog');

// --- mock: devolve a entrada intacta, imitando o envelope da Messages API ----
globalThis.fetch = async (_url, init) => {
  const body = JSON.parse(init.body);
  const user = body.messages[0].content;

  let text;
  if (user.startsWith('Translate the VALUES of this JSON')) {
    // Ecoa o mesmo JSON — simula tradução preservando as chaves.
    const json = user.slice(user.indexOf('{'));
    text = JSON.stringify(JSON.parse(json));
  } else {
    // Corpo: devolve exatamente o markdown recebido.
    text = user.slice(user.indexOf('\n\n') + 2);
  }

  return {
    ok: true,
    status: 200,
    json: async () => ({ content: [{ text }], usage: { input_tokens: 1, output_tokens: 1 } }),
    text: async () => '',
  };
};

const { translatePost, splitFrontmatter } = await import('./translate-posts.mjs');

const files = (await readdir(SRC_DIR)).filter((f) => /\.(md|mdx)$/.test(f)).sort();
let checked = 0;
const problems = [];

for (const file of files) {
  const raw = await readFile(path.join(SRC_DIR, file), 'utf8');
  const original = splitFrontmatter(raw);

  let out;
  try {
    ({ out } = await translatePost({ apiKey: 'test', model: 'test', raw }));
  } catch (err) {
    problems.push(`${file}: pipeline lançou "${err.message}"`);
    continue;
  }

  const result = splitFrontmatter(out);
  if (!result) {
    problems.push(`${file}: saída sem frontmatter válido`);
    continue;
  }

  try {
    // 1. O corpo tem de sobreviver intacto (o mock é identidade).
    assert.equal(result.body.trim(), original.body.trim(), 'corpo alterado');

    // 2. As categorias não podem mudar — enum é gate de build.
    const cats = (fm) => fm.split('\n').filter((l) => /^\s*-\s/.test(l) || /^categorias:/.test(l)).join('|');
    assert.equal(cats(result.fm), cats(original.fm), 'bloco de categorias alterado');

    // 3. Datas preservadas: se pubDate mudar, a ordenação e o SEO vão junto.
    const pub = (fm) => (/^pubDate:.*$/m.exec(fm) || [''])[0];
    assert.equal(pub(result.fm), pub(original.fm), 'pubDate alterado');

    // 4. heroImage preservado (URL nunca deve ser "traduzida").
    const hero = (fm) => (/^heroImage:.*$/m.exec(fm) || [''])[0];
    assert.equal(hero(result.fm), hero(original.fm), 'heroImage alterado');

    // 5. Nenhuma chave de frontmatter pode sumir.
    const keys = (fm) => fm.split('\n').map((l) => /^([A-Za-z_][A-Za-z0-9_]*):/.exec(l)?.[1]).filter(Boolean).join(',');
    assert.equal(keys(result.fm), keys(original.fm), 'conjunto de chaves mudou');

    checked++;
  } catch (err) {
    problems.push(`${file}: ${err.message}`);
  }
}

console.log(`posts verificados: ${checked}/${files.length}`);
if (problems.length) {
  console.error(`\nFALHAS (${problems.length}):`);
  for (const p of problems.slice(0, 25)) console.error('  - ' + p);
  if (problems.length > 25) console.error(`  … e mais ${problems.length - 25}`);
  process.exit(1);
}
console.log('OK — frontmatter, categorias, datas, heroImage e corpo preservados.');
