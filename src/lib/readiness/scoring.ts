/**
 * Algoritmo do ChatGPT Ads Readiness Score.
 *
 * Regras que valem para tudo aqui:
 *  - Toda pergunta pontuada contribui de 0 a 1, ponderada pelo `weight` dentro
 *    da própria dimensão. A dimensão é normalizada pelo peso EFETIVAMENTE
 *    respondido, então pular perguntas não penaliza artificialmente.
 *  - Dimensão sem nenhuma resposta não vira 0: fica `null` e é excluída da
 *    média ponderada, com os pesos redistribuídos. Zero seria uma afirmação
 *    sobre a empresa que o diagnóstico não tem base para fazer.
 *  - O score mede PREPARAÇÃO. Ele não prevê aprovação de anúncios nem
 *    performance — ver os textos em classification().
 */

import { DIMENSIONS, type Answers, type Classification, type DimensionId, type DimensionScore, type ScenarioSimulation, type SiteSignals } from './types';
import { visibleQuestions } from './questions';

/** Confere que os pesos das dimensões somam 100. Chamado pelos testes. */
export function assertWeights(): void {
  const total = DIMENSIONS.reduce((n, d) => n + d.weight, 0);
  if (total !== 100) {
    throw new Error(`Pesos das dimensões somam ${total}, deveriam somar 100.`);
  }
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const pct = (n: number) => Math.round(clamp01(n) * 100);

function toNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[^\d.,-]/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

// ---------------------------------------------------------------------------
// Score por dimensão
// ---------------------------------------------------------------------------

interface RawDimension {
  earned: number;
  possible: number;
  answered: number;
}

function accumulate(answers: Answers): Record<DimensionId, RawDimension> {
  const acc = {} as Record<DimensionId, RawDimension>;
  for (const d of DIMENSIONS) acc[d.id] = { earned: 0, possible: 0, answered: 0 };

  for (const q of visibleQuestions(answers)) {
    if (!q.dimension) continue;
    const weight = q.weight ?? 1;
    const value = answers[q.id];

    let score: number | null = null;

    if (q.kind === 'multi') {
      const arr = Array.isArray(value) ? value : [];
      // Multi sem seleção = não respondida. Com seleção, `scoreMulti` decide.
      if (arr.length > 0) score = clamp01(q.scoreMulti ? q.scoreMulti(arr) : 0);
    } else if (q.kind === 'single') {
      const opt = q.options?.find((o) => o.value === value);
      if (opt && typeof opt.score === 'number') score = clamp01(opt.score);
    } else if (q.kind === 'text' || q.kind === 'longtext') {
      // Campo aberto pontua por substância: uma resposta de uma palavra não
      // demonstra diferenciação articulada. 120+ caracteres = pontuação cheia.
      const text = String(value ?? '').trim();
      if (text.length > 0) score = clamp01(text.length / 120);
    }

    if (score === null) continue;
    acc[q.dimension].earned += score * weight;
    acc[q.dimension].possible += weight;
    acc[q.dimension].answered += 1;
  }

  return acc;
}

/**
 * Sinais do site entram na dimensão `conversao` e `discoverability` como
 * evidência OBSERVADA, com peso próprio. Só é chamado quando o scan funcionou —
 * nunca inventamos sinal para site que não pôde ser lido.
 */
function siteContribution(signals: SiteSignals): { conversao: number; discoverability: number } {
  // Conversão: existe caminho para virar oportunidade?
  const conversionChecks = [
    signals.hasForm,
    signals.hasWhatsAppLink || signals.hasTelLink,
    signals.ctaTerms.length > 0,
    signals.hasViewportMeta, // proxy honesto de "pensou em mobile"
    signals.trustSignals.length > 0,
  ];
  const conversao = conversionChecks.filter(Boolean).length / conversionChecks.length;

  // Discoverability: a página se explica para uma máquina?
  const discoveryChecks = [
    !!signals.title && signals.title.length >= 15,
    !!signals.metaDescription && signals.metaDescription.length >= 50,
    signals.h1.length > 0,
    signals.h2Count >= 2,
    signals.hasSchemaOrg,
    signals.hasOpenGraph,
    signals.hasCanonical,
  ];
  const discoverability = discoveryChecks.filter(Boolean).length / discoveryChecks.length;

  return { conversao, discoverability };
}

export function scoreDimensions(answers: Answers, signals: SiteSignals | null): DimensionScore[] {
  const acc = accumulate(answers);

  if (signals) {
    const site = siteContribution(signals);
    // Peso 3 — a evidência observada pesa como uma pergunta importante, mas não
    // domina o auto-relato: um site pode ser ótimo e a operação, não.
    const W = 3;
    acc.conversao.earned += site.conversao * W;
    acc.conversao.possible += W;
    acc.conversao.answered += 1;
    acc.discoverability.earned += site.discoverability * W;
    acc.discoverability.possible += W;
    acc.discoverability.answered += 1;
  }

  return DIMENSIONS.map((d) => {
    const raw = acc[d.id];
    return {
      id: d.id,
      label: d.label,
      score: raw.possible > 0 ? pct(raw.earned / raw.possible) : 0,
      weight: d.weight,
      answered: raw.answered,
      meaning: d.meaning,
    };
  });
}

/**
 * Total ponderado. Dimensões sem resposta são excluídas e seu peso é
 * redistribuído entre as demais — em vez de arrastarem o total para baixo.
 */
export function totalScore(dimensions: DimensionScore[]): number {
  const active = dimensions.filter((d) => d.answered > 0);
  if (active.length === 0) return 0;
  const weightSum = active.reduce((n, d) => n + d.weight, 0);
  const weighted = active.reduce((n, d) => n + d.score * d.weight, 0);
  return Math.round(weighted / weightSum);
}

// ---------------------------------------------------------------------------
// Classificação
// ---------------------------------------------------------------------------

export function classify(total: number): Classification {
  if (total < 40) {
    return {
      band: 'baixa',
      label: 'Baixa prontidão',
      message:
        'Antes de aumentar investimento em mídia, sua empresa precisa fortalecer fundamentos importantes de aquisição e mensuração.',
    };
  }
  if (total < 60) {
    return {
      band: 'desenvolvimento',
      label: 'Prontidão em desenvolvimento',
      message: 'Existe potencial, mas alguns gargalos podem comprometer a eficiência do investimento.',
    };
  }
  if (total < 80) {
    return {
      band: 'ajustes',
      label: 'Pronta com ajustes',
      message:
        'Sua empresa possui uma estrutura razoável para iniciar uma estratégia de aquisição via IA, mas existem pontos que podem aumentar sua eficiência antes da escala.',
    };
  }
  return {
    band: 'alta',
    label: 'Alta prontidão',
    message:
      'Sua empresa apresenta uma estrutura madura para explorar aquisição através de mídia e inteligência artificial.',
  };
}

// ---------------------------------------------------------------------------
// AI Acquisition Opportunity
// ---------------------------------------------------------------------------

/**
 * Indicador INTERNO da ferramenta: onde há mais espaço estratégico a ganhar.
 * Não representa potencial de faturamento — é a combinação entre o tamanho da
 * operação (que sustenta investimento) e a lacuna ainda aberta (o que dá para
 * melhorar). Empresa grande e já madura tem oportunidade menor do que empresa
 * grande e despreparada, porque resta menos a corrigir.
 */
export function opportunityIndex(answers: Answers, dimensions: DimensionScore[]): number {
  const byId = Object.fromEntries(dimensions.map((d) => [d.id, d.score])) as Record<DimensionId, number>;

  const investRank: Record<string, number> = {
    ate1k: 0.15, '1a3k': 0.35, '3a5k': 0.55, '5a10k': 0.75, '10a30k': 0.9, mais30k: 1,
  };
  const volumeRank: Record<string, number> = {
    ate20: 0.2, '20a50': 0.4, '50a100': 0.6, '100a500': 0.85, '500mais': 1, naosei: 0.3,
  };

  const capacidade =
    (investRank[String(answers['eco_investimento'] ?? '')] ?? 0.3) * 0.6 +
    (volumeRank[String(answers['com_volume'] ?? '')] ?? 0.3) * 0.4;

  // Lacuna nas duas dimensões que mais destravam aquisição via IA.
  const lacuna = ((100 - (byId.discoverability ?? 0)) * 0.6 + (100 - (byId.conversao ?? 0)) * 0.4) / 100;

  // Ticket alto amplia o retorno de cada ponto corrigido.
  const ticket = toNumber(answers['eco_ticket']);
  const ticketBoost = ticket === null ? 0.5 : clamp01(Math.log10(Math.max(ticket, 1)) / 5);

  return pct(capacidade * 0.4 + lacuna * 0.4 + ticketBoost * 0.2);
}

// ---------------------------------------------------------------------------
// Simulação de cenário
// ---------------------------------------------------------------------------

const INVEST_MID: Record<string, number> = {
  ate1k: 1000, '1a3k': 2000, '3a5k': 4000, '5a10k': 7500, '10a30k': 20000, mais30k: 40000,
};

/**
 * Aritmética simples e explícita, apresentada sempre como SIMULAÇÃO.
 * Quando falta insumo, o campo volta `null` e a UI omite a linha — nunca
 * preenchemos lacuna com número inventado.
 */
export function simulateScenario(answers: Answers): ScenarioSimulation {
  const ticket = toNumber(answers['eco_ticket']);
  const meta = toNumber(answers['eco_meta']);
  const investimento = INVEST_MID[String(answers['eco_investimento'] ?? '')] ?? null;

  const taxaInformada = toNumber(answers['com_taxa_valor']);
  let taxaFechamento: number | null = null;
  let origem: ScenarioSimulation['taxaFechamentoOrigem'] = null;

  if (taxaInformada !== null && taxaInformada > 0 && taxaInformada <= 100) {
    taxaFechamento = taxaInformada / 100;
    origem = 'informada';
  }

  const vendasNecessarias = ticket && meta && ticket > 0 ? Math.ceil(meta / ticket) : null;
  const leadsNecessarios =
    vendasNecessarias !== null && taxaFechamento ? Math.ceil(vendasNecessarias / taxaFechamento) : null;

  return {
    vendasNecessarias,
    leadsNecessarios,
    ticketMedio: ticket,
    faturamentoDesejado: meta,
    investimentoMensal: investimento,
    taxaFechamento,
    taxaFechamentoOrigem: origem,
  };
}

// ---------------------------------------------------------------------------
// WYS Lead Score — interno, não exibido ao usuário
// ---------------------------------------------------------------------------

export type WysTier = 'baixa' | 'oportunidade' | 'qualificado' | 'altamente-qualificado';

/**
 * Qualificação comercial do lead para a WYS. Deliberadamente diferente do
 * readiness: uma empresa despreparada pode ser um lead EXCELENTE (há muito a
 * fazer), desde que tenha verba e estrutura para contratar.
 */
export function wysLeadScore(answers: Answers, dimensions: DimensionScore[], hasSite: boolean): number {
  const investRank: Record<string, number> = {
    ate1k: 0.1, '1a3k': 0.3, '3a5k': 0.55, '5a10k': 0.75, '10a30k': 0.95, mais30k: 1,
  };
  const volumeRank: Record<string, number> = {
    ate20: 0.25, '20a50': 0.45, '50a100': 0.65, '100a500': 0.9, '500mais': 1, naosei: 0.3,
  };

  const verba = investRank[String(answers['eco_investimento'] ?? '')] ?? 0.2;
  const capacidade = volumeRank[String(answers['com_volume'] ?? '')] ?? 0.3;

  const ticket = toNumber(answers['eco_ticket']);
  const ticketScore = ticket === null ? 0.35 : clamp01(Math.log10(Math.max(ticket, 1)) / 4.5);

  const meta = toNumber(answers['eco_meta']);
  const metaScore = meta === null ? 0.35 : clamp01(Math.log10(Math.max(meta, 1)) / 6);

  const byId = Object.fromEntries(dimensions.map((d) => [d.id, d.score])) as Record<DimensionId, number>;
  // Espaço de trabalho: quanto mais lacuna, mais escopo de projeto.
  const escopo = clamp01((100 - (byId.mensuracao ?? 50)) / 100) * 0.5 +
    clamp01((100 - (byId.discoverability ?? 50)) / 100) * 0.5;

  const estrutura = clamp01(((byId.comercial ?? 0) + (byId.escala ?? 0)) / 200);
  const siteScore = hasSite ? 1 : 0.3;

  const raw =
    verba * 0.3 +
    capacidade * 0.15 +
    ticketScore * 0.12 +
    metaScore * 0.08 +
    escopo * 0.15 +
    estrutura * 0.12 +
    siteScore * 0.08;

  return pct(raw);
}

export function wysTier(score: number): WysTier {
  if (score < 40) return 'baixa';
  if (score < 70) return 'oportunidade';
  if (score < 85) return 'qualificado';
  return 'altamente-qualificado';
}

/** Fração das perguntas pontuadas visíveis que foram efetivamente respondidas. */
export function completude(answers: Answers): number {
  const scored = visibleQuestions(answers).filter((q) => q.dimension);
  if (scored.length === 0) return 0;
  const done = scored.filter((q) => {
    const v = answers[q.id];
    if (Array.isArray(v)) return v.length > 0;
    return v !== null && v !== undefined && String(v).trim() !== '';
  });
  return Math.round((done.length / scored.length) * 100) / 100;
}
