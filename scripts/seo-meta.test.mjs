#!/usr/bin/env node
/**
 * Testes da escolha de <title> / meta description.
 *
 * O risco que estes testes protegem é específico: usar cegamente o `metaTitle`
 * do frontmatter faria o SERP exibir frases cortadas no meio, o que é PIOR do
 * que o título longo original. A regra que separa reescrita de truncagem
 * precisa estar certa.
 *
 *   node --experimental-strip-types --import ./scripts/register-ts-hook.mjs scripts/seo-meta.test.mjs
 */

import assert from 'node:assert/strict';
import path from 'node:path';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { seoTitle, seoDescription, isTruncation, trimDangling, TITLE_MAX } = await import(
  pathToFileURL(path.join(ROOT, 'src/lib/seo-meta.ts')).href
);

let passed = 0;
const failures = [];
// Aguarda o resultado: sem o await, um teste assíncrono que falha vira uma
// promise rejeitada silenciosa e o runner reportaria sucesso.
const test = async (name, fn) => {
  try {
    await fn();
    passed++;
  } catch (e) {
    failures.push(`${name}: ${e.message}`);
  }
};

// --- truncagem --------------------------------------------------------------

await test('reconhece corte com reticências como truncagem', () => {
  assert.equal(
    isTruncation(
      'Agência especialista em sites para médicos e clínicas...',
      'Agência especialista em sites para médicos e clínicas médicas'
    ),
    true
  );
  assert.equal(isTruncation('Ações para o acompanhamento no indicativo…', 'Ações para o acompanhamento no indicativo de otimizacao'), true);
});

await test('reconhece reescrita editorial como NÃO truncagem', () => {
  assert.equal(
    isTruncation(
      'Alucinações de IA: por que a máquina inventa',
      'Alucinações: por que a IA inventa e o que realmente reduz isso'
    ),
    false
  );
  assert.equal(
    isTruncation('API do Fable 5: adaptive thinking, refusals e fallback', 'Adaptive thinking, refusals e fallback: o que muda na API do Fable 5'),
    false
  );
});

// --- escolha de título ------------------------------------------------------

await test('usa a reescrita editorial quando é legítima e curta', () => {
  const t = seoTitle('Alucinações: por que a IA inventa e o que realmente reduz isso', 'Alucinações de IA: por que a máquina inventa');
  assert.equal(t, 'Alucinações de IA: por que a máquina inventa');
});

await test('NUNCA usa metaTitle terminado em reticências', () => {
  const original = 'Agência especialista em sites para médicos e clínicas médicas';
  assert.equal(seoTitle(original, 'Agência especialista em sites para médicos e clínicas...'), original);
  assert.equal(seoTitle(original, 'Agência especialista em sites para médicos e clínicas…'), original);
});

await test('ignora metaTitle ausente, vazio ou longo demais', () => {
  const original = 'Um título qualquer';
  assert.equal(seoTitle(original, undefined), original);
  assert.equal(seoTitle(original, ''), original);
  assert.equal(seoTitle(original, '   '), original);
  assert.equal(seoTitle(original, 'x'.repeat(TITLE_MAX + 1)), original);
});

await test('description segue a mesma regra com limite próprio', () => {
  const desc = 'x'.repeat(200);
  assert.equal(seoDescription(desc, 'y'.repeat(200)), desc, 'candidato longo demais deve ser ignorado');
  assert.equal(seoDescription(desc, 'Uma descrição curta e reescrita de verdade.'), 'Uma descrição curta e reescrita de verdade.');
});

// --- varredura no acervo real ----------------------------------------------

await test('nenhum <title> do acervo termina em reticências', async () => {
  const dir = path.join(ROOT, 'src/content/blog');
  const files = (await readdir(dir)).filter((f) => /\.(md|mdx)$/.test(f));
  const ruins = [];
  let melhorados = 0;

  for (const f of files) {
    const raw = await readFile(path.join(dir, f), 'utf8');
    const m = /^---\n([\s\S]*?)\n---/.exec(raw);
    if (!m) continue;
    const get = (k) => {
      const line = new RegExp(`^${k}:\\s*(.*)$`, 'm').exec(m[1]);
      return line ? line[1].trim().replace(/^["']|["']$/g, '') : '';
    };
    const title = get('title');
    const final = seoTitle(title, get('metaTitle'));
    if (/(\.{3}|…)\s*$/.test(final)) ruins.push(`${f}: "${final}"`);
    if (final !== title) melhorados++;
  }

  assert.equal(ruins.length, 0, `títulos cortados chegariam ao SERP:\n  ${ruins.slice(0, 5).join('\n  ')}`);
  assert.ok(melhorados > 0, 'a regra deveria aproveitar ao menos algumas reescritas');
  console.log(`   (${melhorados} títulos usam a reescrita editorial)`);
});

// --- limpeza de corte do importador ----------------------------------------

await test('trimDangling recua ate o fim de frase', () => {
  const t = 'Primeira frase completa aqui, com bastante texto para passar do minimo. Segunda frase cortada no meio...';
  assert.equal(trimDangling(t), 'Primeira frase completa aqui, com bastante texto para passar do minimo.');
});

await test('trimDangling nao deixa palavra pela metade quando nao ha fim de frase', () => {
  const t = 'Um texto corrido bem longo e sem nenhuma pontuacao final que sirva de corte adequado aqui...';
  const r = trimDangling(t);
  assert.ok(!/(\.{3}|…)$/.test(r), 'nao pode sobrar reticencias');
  assert.ok(r.length >= 70);
});

await test('trimDangling preserva o original se o corte deixar curto demais', () => {
  const t = 'Frase curta. Resto...';
  assert.equal(trimDangling(t), t, 'recuar deixaria menos de 70 chars, entao mantem');
});

await test('trimDangling nao mexe em texto ja completo', () => {
  const t = 'Uma descricao completa e bem formada, sem nenhum corte no final dela.';
  assert.equal(trimDangling(t), t);
});

await test('nenhuma meta description do acervo sai com reticencias', async () => {
  const dir = path.join(ROOT, 'src/content/blog');
  const files = (await readdir(dir)).filter((f) => /\.(md|mdx)$/.test(f));
  const ruins = [];
  for (const f of files) {
    const raw = await readFile(path.join(dir, f), 'utf8');
    const m = /^---\n([\s\S]*?)\n---/.exec(raw);
    if (!m) continue;
    const get = (k) => {
      const line = new RegExp(`^${k}:\\s*(.*)$`, 'm').exec(m[1]);
      return line ? line[1].trim().replace(/^["']|["']$/g, '') : '';
    };
    const final = seoDescription(get('description'), get('metaDescription'));
    if (/(\.{3}|…)\s*$/.test(final)) ruins.push(`${f}: "${final.slice(-60)}"`);
  }
  assert.equal(ruins.length, 0, `descriptions cortadas chegariam ao SERP:\n  ${ruins.slice(0,5).join('\n  ')}`);
});

// ---------------------------------------------------------------------------

await new Promise((r) => setTimeout(r, 0));
console.log(`testes: ${passed} passaram, ${failures.length} falharam`);
if (failures.length) {
  console.error('\nFALHAS:');
  for (const f of failures) console.error('  - ' + f);
  process.exit(1);
}
console.log('OK — reescritas legítimas aproveitadas, truncagens bloqueadas.');
