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
const { getCountry, formatMoney, groupDigits, parseMoney, formatPhone, isPhonePlausible,
        toE164, normalizeUrl, currencySymbol, COUNTRIES, bracketLabel,
        INVEST_BRACKETS } = await load('src/lib/readiness/locale.ts');

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


// --- insights ---------------------------------------------------------------

const { executiveSummary, strategicAlerts, evidenceByDimension, priorityActions } =
  await load('src/lib/readiness/insights.ts');

test('sumário executivo cita os dados informados pela empresa', () => {
  const identity = { empresa:'Acme Odonto', site:'acme.com.br', segmento:'odontologia', local:'Sorocaba', modelo:'servico' };
  const answers = { modelo:'servico', objetivo:'leads', produto_principal:'Implante dentário',
                    eco_ticket:5000, eco_meta:100000, eco_investimento:'5a10k' };
  const d = diagnose(answers, null);
  const txt = executiveSummary(identity, answers, d).join(' ');
  assert.ok(txt.includes('Acme Odonto'), 'deveria citar a empresa');
  assert.ok(txt.includes('odontologia'), 'deveria citar o segmento');
  assert.ok(/implante dent/i.test(txt), 'deveria citar o produto');
  assert.ok(txt.includes('20 vendas'), 'deveria calcular vendas necessarias');
});

test('sumário executivo não inventa número quando falta insumo', () => {
  const identity = { empresa:'X', site:'', segmento:'', local:'', modelo:'b2b' };
  const txt = executiveSummary(identity, { modelo:'b2b' }, diagnose({ modelo:'b2b' }, null)).join(' ');
  assert.ok(!/R\$/.test(txt), 'nao deveria citar valores sem ticket/meta/verba informados');
});

test('alerta crítico: meta exige mais leads do que a capacidade', () => {
  const answers = { eco_ticket:1000, eco_meta:500000, com_taxa:'sim', com_taxa_valor:10, com_volume:'ate20' };
  const d = diagnose(answers, null);
  const a = strategicAlerts(answers, d, null);
  assert.ok(a.some(x => x.severity==='critico' && /mais leads/i.test(x.title)), 'faltou o alerta de capacidade');
});

test('alerta crítico: verba alta sem mensuração', () => {
  const answers = { eco_investimento:'mais30k', track_origem:'nao', track_ga:'nao', track_gtm:'nao',
                    track_conversoes:'nao', track_lead_cliente:'nao', track_crm:'nao' };
  const d = diagnose(answers, null);
  assert.ok(strategicAlerts(answers, d, null).some(x => /mensura/i.test(x.title) && x.severity==='critico'));
});

test('alerta crítico: objetivo de conversão sem caminho no site', () => {
  const signals = { url:'u', finalUrl:'u', status:200, title:'t', metaDescription:null, h1:[], h2Count:0,
    hasForm:false, hasWhatsAppLink:false, hasTelLink:false, hasMailtoLink:false, hasSchemaOrg:false,
    schemaTypes:[], hasViewportMeta:false, hasOpenGraph:false, hasCanonical:false, htmlBytes:10,
    imgCount:0, imgWithoutAlt:0, trustSignals:[], ctaTerms:[], langAttr:null };
  const answers = { objetivo:'vendas' };
  const d = diagnose(answers, signals);
  assert.ok(strategicAlerts(answers, d, signals).some(x => /caminho de convers/i.test(x.title)));
});

test('empresa saudável não recebe alerta crítico fabricado', () => {
  const answers = { eco_investimento:'3a5k', com_volume:'100a500', com_tempo_resposta:'5min',
    track_origem:'sim', track_ga:'sim', track_gtm:'sim', track_conversoes:'sim',
    track_lead_cliente:'sim', track_crm:'sim', oferta_status:'definida',
    ia_aparece:'sim', ia_pesquisou:'aparece', ia_conteudo:'sim', ia_presenca_externa:'forte' };
  const d = diagnose(answers, null);
  const criticos = strategicAlerts(answers, d, null).filter(x => x.severity==='critico');
  assert.equal(criticos.length, 0, `nao deveria haver critico; veio: ${criticos.map(c=>c.title).join(', ')}`);
});

test('evidências separam o que sustenta do que puxa para baixo', () => {
  const answers = { track_conversoes:'sim', track_origem:'nao', track_ga:'nao' };
  const ev = evidenceByDimension(answers, null).find(e => e.dimension==='mensuracao');
  assert.ok(ev, 'deveria haver evidencia de mensuracao');
  assert.ok(ev.strengths.some(s => /Convers.es configuradas/i.test(s.label)));
  assert.ok(ev.gaps.some(g => /origem dos leads/i.test(g.label)));
});

test('plano priorizado coloca impacto alto e esforço baixo primeiro', () => {
  const answers = { com_tempo_resposta:'mais1dia', track_conversoes:'nao', site_lp:'home' };
  const d = diagnose(answers, null);
  const p = priorityActions(answers, d, null);
  assert.ok(p.length > 0);
  assert.equal(p[0].impact, 'alto');
  assert.equal(p[0].effort, 'baixo');
});

test('perfis diferentes geram alertas diferentes', () => {
  const a1 = strategicAlerts({ objetivo:'vendas', com_tempo_resposta:'mais1dia' },
    diagnose({ objetivo:'vendas', com_tempo_resposta:'mais1dia' }, null), null).map(x=>x.title).join('|');
  const a2 = strategicAlerts({ objetivo:'marca', com_tempo_resposta:'5min' },
    diagnose({ objetivo:'marca', com_tempo_resposta:'5min' }, null), null).map(x=>x.title).join('|');
  assert.notEqual(a1, a2);
});

test('resumo conta os mesmos críticos que a seção de alertas (com sinais do site)', () => {
  const signals = { url:'u', finalUrl:'u', status:200, title:'t', metaDescription:null, h1:[], h2Count:0,
    hasForm:false, hasWhatsAppLink:false, hasTelLink:false, hasMailtoLink:false, hasSchemaOrg:false,
    schemaTypes:[], hasViewportMeta:false, hasOpenGraph:false, hasCanonical:false, htmlBytes:10,
    imgCount:0, imgWithoutAlt:0, trustSignals:[], ctaTerms:[], langAttr:null };
  const answers = { objetivo:'vendas', eco_investimento:'mais30k', track_origem:'nao',
    track_conversoes:'nao', track_lead_cliente:'nao', track_crm:'nao', track_ga:'nao', track_gtm:'nao' };
  const d = diagnose(answers, signals);
  const criticos = strategicAlerts(answers, d, signals).filter(a => a.severity === 'critico');
  assert.ok(criticos.length >= 2, 'o cenario deveria produzir 2+ criticos');
  const txt = executiveSummary({empresa:'X',site:'u',segmento:'',local:'',modelo:'b2c'}, answers, d, signals).join(' ');
  assert.ok(txt.includes(`${criticos.length} pontos criticos`.replace('criticos','críticos')),
    `resumo deveria citar ${criticos.length} pontos criticos; texto: ${txt.slice(-220)}`);
});

test('concordância no singular quando há exatamente 1 crítico', () => {
  const answers = { eco_investimento:'mais30k', track_origem:'nao', track_conversoes:'nao',
    track_lead_cliente:'nao', track_crm:'nao', track_ga:'nao', track_gtm:'nao' };
  const d = diagnose(answers, null);
  const criticos = strategicAlerts(answers, d, null).filter(a => a.severity === 'critico');
  assert.equal(criticos.length, 1);
  const txt = executiveSummary({empresa:'X',site:'',segmento:'',local:'',modelo:'b2c'}, answers, d, null).join(' ');
  assert.ok(txt.includes('Foi identificado 1 ponto crítico'), 'faltou concordancia no singular');
  assert.ok(!txt.includes('Foram identificados 1'), 'concordancia errada no singular');
});

// --- localizacao e mascaras -------------------------------------------------

test('moeda acompanha o país informado', () => {
  assert.equal(getCountry('BR').currency, 'BRL');
  assert.equal(getCountry('PT').currency, 'EUR');
  assert.equal(getCountry('US').currency, 'USD');
  assert.equal(getCountry('AR').currency, 'ARS');
  // Pais fora da lista cai no fallback internacional, nao em BRL.
  assert.equal(getCountry('ZZ').currency, 'USD');
  assert.equal(getCountry(null).code, 'BR', 'default deve ser Brasil');
});

test('formatação de dinheiro nunca rotula euro como real', () => {
  const br = formatMoney(3500, getCountry('BR'));
  const pt = formatMoney(3500, getCountry('PT'));
  assert.ok(br.includes('R$'), `esperado R$ em ${br}`);
  assert.ok(!pt.includes('R$'), `PT nao pode exibir R$: ${pt}`);
  assert.ok(/€/.test(pt), `esperado simbolo de euro em ${pt}`);
});

test('separador de milhar segue o país', () => {
  assert.equal(groupDigits('3500', getCountry('BR')), '3.500');
  assert.equal(groupDigits('3500', getCountry('US')), '3,500');
  assert.equal(groupDigits('', getCountry('BR')), '');
  assert.equal(groupDigits('abc', getCountry('BR')), '');
  // Zeros a esquerda nao viram "0.001"
  assert.equal(groupDigits('0007', getCountry('BR')), '7');
});

test('parseMoney desfaz a máscara', () => {
  assert.equal(parseMoney('R$ 3.500'), 3500);
  assert.equal(parseMoney('1,234,567'), 1234567);
  assert.equal(parseMoney(''), null);
  assert.equal(parseMoney('abc'), null);
});

test('máscara de telefone brasileira alterna fixo e celular', () => {
  const br = getCountry('BR');
  assert.equal(formatPhone('1533334444', br), '(15) 3333-4444');   // fixo, 10 digitos
  assert.equal(formatPhone('15999998888', br), '(15) 99999-8888'); // celular, 11
  assert.equal(formatPhone('15', br), '(15');                       // parcial nao quebra
  assert.equal(formatPhone('', br), '');
});

test('máscara de telefone respeita outros países', () => {
  assert.equal(formatPhone('912345678', getCountry('PT')), '912 345 678');
  assert.equal(formatPhone('4155551234', getCountry('US')), '(415) 555-1234');
  // Pais sem mascara nacional apenas agrupa, sem inventar formato.
  const intl = formatPhone('123456789', getCountry('ZZ'));
  assert.ok(/^[\d ]+$/.test(intl), `internacional deveria ser digitos e espacos: ${intl}`);
});

test('validação de telefone recusa número incompleto', () => {
  const br = getCountry('BR');
  assert.equal(isPhonePlausible('1599999888', br), true);   // 10 = fixo
  assert.equal(isPhonePlausible('159999988888', br), false); // 12 = invalido
  assert.equal(isPhonePlausible('159', br), false);
  assert.equal(isPhonePlausible('912345678', getCountry('PT')), true);
});

test('E.164 inclui o DDI do país', () => {
  assert.equal(toE164('15999998888', getCountry('BR')), '+5515999998888');
  assert.equal(toE164('912345678', getCountry('PT')), '+351912345678');
  assert.equal(toE164('', getCountry('BR')), '');
});

test('normalizeUrl aceita domínio sem esquema e recusa lixo', () => {
  assert.equal(normalizeUrl('empresa.com.br'), 'https://empresa.com.br/');
  assert.equal(normalizeUrl('https://empresa.com.br/x'), 'https://empresa.com.br/x');
  assert.equal(normalizeUrl('  acme.io  '), 'https://acme.io/');
  assert.equal(normalizeUrl('nao-e-url'), null);
  assert.equal(normalizeUrl(''), null);
});

test('todo país da lista produz símbolo e máscara utilizáveis', () => {
  for (const c of COUNTRIES) {
    const sym = currencySymbol(c);
    assert.ok(sym && sym.length > 0, `${c.code} sem simbolo`);
    assert.ok(formatMoney(1000, c).length > 0, `${c.code} nao formata`);
    for (const m of c.phoneMasks) {
      assert.ok((m.match(/#/g) || []).length >= 6, `${c.code}: mascara curta demais (${m})`);
    }
  }
});

test('relatório usa a moeda do país no resumo executivo', () => {
  const answers = { eco_ticket:1000, eco_meta:50000, eco_investimento:'5a10k' };
  const d = diagnose(answers, null);
  const id = { empresa:'Lisboa Lda', site:'', segmento:'', local:'Lisboa', pais:'PT', modelo:'b2b' };
  const txt = executiveSummary(id, answers, d, null, getCountry('PT')).join(' ');
  assert.ok(!txt.includes('R$'), `resumo PT nao pode citar R$: ${txt.slice(0,200)}`);
  assert.ok(/€/.test(txt), 'resumo PT deveria citar euro');
});

test('alertas usam a moeda do país', () => {
  const answers = { eco_investimento:'mais30k', track_origem:'nao', track_conversoes:'nao',
    track_lead_cliente:'nao', track_crm:'nao', track_ga:'nao', track_gtm:'nao' };
  const d = diagnose(answers, null);
  const txt = strategicAlerts(answers, d, null, getCountry('US')).map(a=>a.detail).join(' ');
  assert.ok(!txt.includes('R$'), `alerta US nao pode citar R$: ${txt.slice(0,200)}`);
});

test('faixas de investimento são reescritas na moeda do país', () => {
  const br = bracketLabel('5a10k', getCountry('BR'));
  const pt = bracketLabel('5a10k', getCountry('PT'));
  assert.ok(br.includes('R$'), `BR deveria usar R$: ${br}`);
  assert.ok(!pt.includes('R$'), `PT nao pode usar R$: ${pt}`);
  assert.ok(/€/.test(pt), `PT deveria usar euro: ${pt}`);
  assert.ok(bracketLabel('ate1k', getCountry('BR')).startsWith('Até'));
  assert.ok(bracketLabel('mais30k', getCountry('BR')).startsWith('Acima de'));
  assert.equal(bracketLabel('nao-e-faixa', getCountry('BR')), null);
});

test('toda faixa do questionário tem rótulo localizado', () => {
  const q = QUESTIONS.find(x => x.id === 'eco_investimento');
  for (const o of q.options) {
    assert.ok(INVEST_BRACKETS[o.value], `faixa ${o.value} sem limites em INVEST_BRACKETS`);
    for (const c of COUNTRIES) {
      const l = bracketLabel(o.value, c);
      assert.ok(l && l.length > 0, `${c.code}/${o.value} sem rotulo`);
    }
  }
});

test('nenhum texto do relatório fora do Brasil contém R$', () => {
  const country = getCountry('PT');
  const answers = { eco_ticket:2500, eco_meta:150000, eco_investimento:'10a30k',
    com_volume:'ate20', com_taxa:'sim', com_taxa_valor:5, track_origem:'nao',
    track_conversoes:'nao', track_lead_cliente:'nao', track_crm:'nao',
    track_ga:'nao', track_gtm:'nao', objetivo:'vendas', modelo:'b2b' };
  const d = diagnose(answers, null);
  const id = { empresa:'Lisboa Lda', site:'', segmento:'software', local:'Lisboa', pais:'PT', modelo:'b2b' };

  const textos = [
    ...executiveSummary(id, answers, d, null, country),
    ...strategicAlerts(answers, d, null, country).flatMap(a => [a.title, a.detail]),
    ...evidenceByDimension(answers, null, country).flatMap(e =>
      [...e.strengths, ...e.gaps].flatMap(x => [x.label, x.answer])),
  ].join(' | ');

  assert.ok(!textos.includes('R$'), `vazou R$ no relatorio PT: ${textos.slice(0, 300)}`);
});

// ---------------------------------------------------------------------------

console.log(`testes: ${passed} passaram, ${failures.length} falharam`);
if (failures.length) {
  console.error('\nFALHAS:');
  for (const f of failures) console.error('  - ' + f);
  process.exit(1);
}
console.log('OK — algoritmo de score, lógica adaptativa e roadmap validados.');
