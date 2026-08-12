#!/usr/bin/env node
/**
 * Testes do algoritmo do ChatGPT Ads Readiness.
 *
 * Roda os .ts de src/lib/readiness direto no Node 22 via `--experimental-strip-types`
 * (só há anotações de tipo nesses arquivos — nada de enum/decorator, que exigiriam
 * transformação de verdade).
 *
 *   node --experimental-strip-types scripts/readiness.test.mjs
 */

import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const load = (p) => import(pathToFileURL(path.join(ROOT, p)).href);

const { assertWeights, classify, totalScore, scoreDimensions, simulateScenario, wysLeadScore, wysTier } =
  await load('src/lib/readiness/scoring.ts');
const { diagnose } = await load('src/lib/readiness/diagnose.ts');
const { QUESTIONS, visibleQuestions } = await load('src/lib/readiness/questions.ts');
const { DIMENSIONS } = await load('src/lib/readiness/types.ts');

let passed = 0;
const failures = [];
function test(name, fn) {
  try {
    fn();
    passed++;
  } catch (err) {
    failures.push(`${name}: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------

test('pesos das dimensões somam exatamente 100', () => {
  assertWeights();
  const sum = DIMENSIONS.reduce((n, d) => n + d.weight, 0);
  assert.equal(sum, 100);
});

test('classificação respeita as 4 faixas do briefing', () => {
  assert.equal(classify(0).band, 'baixa');
  assert.equal(classify(39).band, 'baixa');
  assert.equal(classify(40).band, 'desenvolvimento');
  assert.equal(classify(59).band, 'desenvolvimento');
  assert.equal(classify(60).band, 'ajustes');
  assert.equal(classify(79).band, 'ajustes');
  assert.equal(classify(80).band, 'alta');
  assert.equal(classify(100).band, 'alta');
});

test('IDs de perguntas são únicos', () => {
  const ids = QUESTIONS.map((q) => q.id);
  assert.equal(new Set(ids).size, ids.length, 'há IDs duplicados no banco de perguntas');
});

test('toda pergunta pontuada aponta para uma dimensão existente', () => {
  const valid = new Set(DIMENSIONS.map((d) => d.id));
  for (const q of QUESTIONS) {
    if (q.dimension) assert.ok(valid.has(q.dimension), `${q.id} usa dimensão inválida: ${q.dimension}`);
  }
});

test('opções de perguntas single pontuadas têm score entre 0 e 1', () => {
  for (const q of QUESTIONS) {
    if (q.kind !== 'single' || !q.dimension) continue;
    for (const o of q.options ?? []) {
      assert.ok(typeof o.score === 'number', `${q.id}/${o.value} sem score`);
      assert.ok(o.score >= 0 && o.score <= 1, `${q.id}/${o.value} score fora de 0..1`);
    }
  }
});

test('diagnóstico vazio não quebra e não inventa score', () => {
  const d = diagnose({}, null);
  assert.equal(d.total, 0);
  assert.equal(d.classification.band, 'baixa');
  assert.equal(d.roadmap.length, 3);
});

test('respostas máximas produzem alta prontidão', () => {
  const answers = {};
  for (const q of QUESTIONS) {
    if (!q.dimension) continue;
    if (q.kind === 'single') {
      // Escolhe a opção de maior score.
      const best = [...(q.options ?? [])].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];
      if (best) answers[q.id] = best.value;
    } else if (q.kind === 'multi') {
      answers[q.id] = (q.options ?? []).map((o) => o.value).filter((v) => v !== 'nenhuma' && v !== 'nenhum');
    } else if (q.kind === 'text' || q.kind === 'longtext') {
      answers[q.id] = 'x'.repeat(200);
    }
  }
  const d = diagnose(answers, null);
  assert.ok(d.total >= 80, `esperado >= 80, veio ${d.total}`);
  assert.equal(d.classification.band, 'alta');
});

test('respostas mínimas produzem baixa prontidão', () => {
  const answers = {};
  for (const q of QUESTIONS) {
    if (!q.dimension || q.kind !== 'single') continue;
    const worst = [...(q.options ?? [])].sort((a, b) => (a.score ?? 0) - (b.score ?? 0))[0];
    if (worst) answers[q.id] = worst.value;
  }
  const d = diagnose(answers, null);
  assert.ok(d.total < 40, `esperado < 40, veio ${d.total}`);
});

test('dimensão sem resposta não arrasta o total para baixo', () => {
  // Só responde mensuração, e responde bem. O total não pode virar ~15.
  const answers = {
    track_origem: 'sim',
    track_ga: 'sim',
    track_gtm: 'sim',
    track_conversoes: 'sim',
    track_lead_cliente: 'sim',
    track_crm: 'sim',
  };
  const dims = scoreDimensions(answers, null);
  const total = totalScore(dims);
  assert.equal(total, 100, `dimensões não respondidas deveriam ser excluídas; veio ${total}`);
});

test('lógica adaptativa: quem nunca anunciou não recebe pergunta de métricas de Ads', () => {
  const nunca = visibleQuestions({ ads_canais: ['nenhum'] }).map((q) => q.id);
  assert.ok(!nunca.includes('ads_metricas_dominio'), 'não deveria perguntar CPL/ROAS a quem nunca anunciou');
  assert.ok(!nunca.includes('ads_satisfacao'));

  const anuncia = visibleQuestions({ ads_canais: ['google'] }).map((q) => q.id);
  assert.ok(anuncia.includes('ads_metricas_dominio'), 'deveria perguntar CPL/ROAS a quem já anuncia');
});

test('lógica adaptativa: perguntas por modelo de negócio', () => {
  const ecom = visibleQuestions({ modelo: 'ecommerce' }).map((q) => q.id);
  assert.ok(ecom.includes('ecom_checkout'));
  assert.ok(!ecom.includes('b2b_ciclo'));
  assert.ok(!ecom.includes('saas_ltv'));

  const b2b = visibleQuestions({ modelo: 'b2b' }).map((q) => q.id);
  assert.ok(b2b.includes('b2b_ciclo'));
  assert.ok(!b2b.includes('ecom_checkout'));

  const saas = visibleQuestions({ modelo: 'saas' }).map((q) => q.id);
  assert.ok(saas.includes('saas_ltv'));
  assert.ok(!saas.includes('ecom_checkout'));
});

test('simulação: sem ticket ou meta, não inventa número', () => {
  const s = simulateScenario({});
  assert.equal(s.vendasNecessarias, null);
  assert.equal(s.leadsNecessarios, null);
});

test('simulação: meta ÷ ticket = vendas necessárias', () => {
  const s = simulateScenario({ eco_ticket: 5000, eco_meta: 100000 });
  assert.equal(s.vendasNecessarias, 20);
  // Sem taxa de fechamento informada, leads fica null de propósito.
  assert.equal(s.leadsNecessarios, null);
});

test('simulação: com taxa de fechamento, calcula leads necessários', () => {
  const s = simulateScenario({ eco_ticket: 5000, eco_meta: 100000, com_taxa: 'sim', com_taxa_valor: 20 });
  assert.equal(s.vendasNecessarias, 20);
  assert.equal(s.leadsNecessarios, 100); // 20 vendas ÷ 0.2
  assert.equal(s.taxaFechamentoOrigem, 'informada');
});

test('sinais do site elevam conversão e discoverability', () => {
  const base = { site_clareza: 'parcial' };
  const semScan = scoreDimensions(base, null);
  const comScan = scoreDimensions(base, {
    url: 'https://x.com', finalUrl: 'https://x.com', status: 200,
    title: 'Uma empresa que faz coisas boas', metaDescription: 'x'.repeat(80),
    h1: ['Título'], h2Count: 4, hasForm: true, hasWhatsAppLink: true, hasTelLink: true,
    hasMailtoLink: true, hasSchemaOrg: true, schemaTypes: ['Organization'], hasViewportMeta: true,
    hasOpenGraph: true, hasCanonical: true, htmlBytes: 1000, imgCount: 4, imgWithoutAlt: 0,
    trustSignals: ['depoimento'], ctaTerms: ['orçamento'], langAttr: 'pt-BR',
  });

  const conv = (d) => d.find((x) => x.id === 'conversao').score;
  const disc = (d) => d.find((x) => x.id === 'discoverability').score;
  assert.ok(conv(comScan) > conv(semScan), 'scan positivo deveria elevar conversão');
  assert.ok(disc(comScan) > disc(semScan), 'scan positivo deveria elevar discoverability');
});

test('gargalos são os 3 piores e vêm ordenados', () => {
  const answers = {
    track_origem: 'nao', track_ga: 'nao', track_gtm: 'nao', track_conversoes: 'nao',
    track_lead_cliente: 'nao', track_crm: 'nao',
    ia_aparece: 'sim', ia_pesquisou: 'aparece', ia_conteudo: 'sim', ia_presenca_externa: 'forte',
    site_clareza: 'sim', site_caminho: ['formulario', 'whatsapp', 'telefone'], site_lp: 'sim', site_mobile: 'sim',
  };
  const d = diagnose(answers, null);
  assert.ok(d.bottlenecks.length <= 3);
  assert.equal(d.bottlenecks[0].dimension, 'mensuracao', 'mensuração zerada deveria ser o gargalo nº 1');
  for (let i = 1; i < d.bottlenecks.length; i++) {
    const prev = d.dimensions.find((x) => x.id === d.bottlenecks[i - 1].dimension).score;
    const cur = d.dimensions.find((x) => x.id === d.bottlenecks[i].dimension).score;
    assert.ok(prev <= cur, 'gargalos fora de ordem');
  }
});

test('roadmap difere entre perfis diferentes', () => {
  const ecom = diagnose({ modelo: 'ecommerce', ads_canais: ['nenhum'] }, null);
  const b2b = diagnose({ modelo: 'b2b', ads_canais: ['google'] }, null);
  const flat = (d) => d.roadmap.flatMap((p) => p.items).join('|');
  assert.notEqual(flat(ecom), flat(b2b), 'perfis diferentes deveriam gerar roadmaps diferentes');
});

test('WYS Lead Score é independente do readiness', () => {
  // Empresa despreparada MAS com verba alta = lead quente, mesmo com readiness baixo.
  const answers = { eco_investimento: 'mais30k', com_volume: '500mais', eco_ticket: 50000, eco_meta: 1000000 };
  const dims = scoreDimensions(answers, null);
  const score = wysLeadScore(answers, dims, true);
  assert.ok(score >= 70, `lead com verba alta deveria pontuar alto; veio ${score}`);
  assert.ok(['qualificado', 'altamente-qualificado'].includes(wysTier(score)));

  // Verba mínima = baixa prioridade comercial.
  const pobre = { eco_investimento: 'ate1k', com_volume: 'ate20' };
  const scorePobre = wysLeadScore(pobre, scoreDimensions(pobre, null), false);
  assert.ok(scorePobre < score, 'verba baixa deveria pontuar menos');
});

test('faixas do WYS Lead Score seguem o briefing', () => {
  assert.equal(wysTier(0), 'baixa');
  assert.equal(wysTier(39), 'baixa');
  assert.equal(wysTier(40), 'oportunidade');
  assert.equal(wysTier(69), 'oportunidade');
  assert.equal(wysTier(70), 'qualificado');
  assert.equal(wysTier(84), 'qualificado');
  assert.equal(wysTier(85), 'altamente-qualificado');
});

test('score nunca sai da faixa 0-100', () => {
  const casos = [
    {},
    { eco_ticket: -999, eco_meta: 1e12 },
    { site_caminho: [], provas: [] },
    { provas: ['nenhuma'] },
  ];
  for (const answers of casos) {
    const d = diagnose(answers, null);
    assert.ok(d.total >= 0 && d.total <= 100, `total fora da faixa: ${d.total}`);
    assert.ok(d.opportunityIndex >= 0 && d.opportunityIndex <= 100);
    assert.ok(d.wysLeadScore >= 0 && d.wysLeadScore <= 100);
    for (const dim of d.dimensions) {
      assert.ok(dim.score >= 0 && dim.score <= 100, `${dim.id} fora da faixa`);
    }
  }
});

// ---------------------------------------------------------------------------

console.log(`testes: ${passed} passaram, ${failures.length} falharam`);
if (failures.length) {
  console.error('\nFALHAS:');
  for (const f of failures) console.error('  - ' + f);
  process.exit(1);
}
console.log('OK — algoritmo de score, lógica adaptativa e roadmap validados.');
