/**
 * Camada narrativa do relatório.
 *
 * O score sozinho é um número sem argumento. Este módulo transforma as
 * respostas em leitura estratégica: o que sustenta cada dimensão, onde as
 * respostas se contradizem entre si, e o que fazer primeiro.
 *
 * Divisão de responsabilidade: `questions.ts` é o questionário, `scoring.ts` é
 * a matemática, e aqui vive o vocabulário do relatório. Por isso os rótulos
 * curtos moram neste arquivo — mudar como o diagnóstico se explica não deveria
 * exigir mexer no instrumento de coleta.
 */

import { QUESTIONS, visibleQuestions } from './questions';
import { bracketLabel, formatMoney, getCountry, type Country } from './locale';
import type {
  Answers,
  DimensionId,
  DimensionScore,
  Diagnosis,
  Identity,
  SiteSignals,
} from './types';

// ---------------------------------------------------------------------------
// Rótulos curtos — o título da pergunta é longo demais para virar item de lista
// ---------------------------------------------------------------------------

const LABELS: Record<string, string> = {
  produto_principal: 'Descrição do produto/serviço principal',
  oferta_status: 'Definição da oferta',
  diferencial: 'Articulação do diferencial competitivo',
  provas: 'Provas de resultado disponíveis',

  ia_aparece: 'Conhecimento sobre aparecer no ChatGPT',
  ia_pesquisou: 'Teste prático de presença em IA',
  ia_conteudo: 'Conteúdo respondendo dúvidas de pré-compra',
  ia_presenca_externa: 'Presença em fontes externas',

  site_clareza: 'Clareza da proposta no site',
  site_caminho: 'Caminhos de conversão disponíveis',
  site_lp: 'Páginas dedicadas por serviço/campanha',
  site_mobile: 'Experiência mobile',

  track_origem: 'Rastreio da origem dos leads',
  track_ga: 'Google Analytics',
  track_gtm: 'Google Tag Manager',
  track_conversoes: 'Conversões configuradas',
  track_lead_cliente: 'Ligação entre lead e cliente fechado',
  track_crm: 'Integração marketing–vendas–CRM',
  com_taxa: 'Acompanhamento da taxa de conversão',
  eco_cac: 'Conhecimento do CAC',
  eco_cpl: 'Conhecimento do CPL',

  com_volume: 'Capacidade mensal de atendimento',
  com_tempo_resposta: 'Tempo de primeira resposta ao lead',
  com_equipe: 'Estrutura de equipe comercial',
  eco_investimento: 'Verba mensal prevista para mídia',

  ads_canais: 'Canais de mídia já utilizados',
  ads_satisfacao: 'Satisfação com os resultados atuais',
  ads_metricas_dominio: 'Domínio de CPL e ROAS',

  ecom_checkout: 'Experiência de checkout',
  ecom_abandono: 'Recuperação de carrinho',
  ecom_catalogo: 'Estruturação do catálogo',
  b2b_ciclo: 'Ciclo de vendas',
  b2b_qualificacao: 'Qualificação de leads',
  saas_entrada: 'Porta de entrada do produto',
  saas_ltv: 'Domínio de LTV e churn',
  local_atendimento: 'Canais de atendimento',
  local_gmb: 'Perfil no Google Empresas',
};

const OBJETIVO_TEXTO: Record<string, string> = {
  vendas: 'gerar vendas',
  leads: 'gerar leads',
  orcamento: 'receber pedidos de orçamento',
  agendamento: 'gerar agendamentos',
  marca: 'aumentar reconhecimento de marca',
  trafego: 'levar usuários ao site',
  produto: 'divulgar um produto específico',
  outro: 'atingir um objetivo próprio',
};

const MODELO_TEXTO: Record<string, string> = {
  b2b: 'B2B',
  b2c: 'B2C',
  b2b2c: 'B2B2C',
  saas: 'SaaS',
  ecommerce: 'e-commerce',
  marketplace: 'marketplace',
  servico: 'serviço profissional',
  outro: 'modelo próprio',
};

const VOLUME_MAX: Record<string, number> = {
  ate20: 20, '20a50': 50, '50a100': 100, '100a500': 500, '500mais': 2000,
};

const INVEST_MID: Record<string, number> = {
  ate1k: 1000, '1a3k': 2000, '3a5k': 4000, '5a10k': 7500, '10a30k': 20000, mais30k: 40000,
};

/** Moeda do relatório. Vem do país informado — formatar euro com "R$" seria
 *  pior do que não formatar. Default Brasil, que é o público principal. */
const money = (value: number, country?: Country | null) => formatMoney(value, country ?? getCountry(null));

function toNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[^\d.,-]/g, '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
}

// ---------------------------------------------------------------------------
// Evidências: o que sustenta cada nota
// ---------------------------------------------------------------------------

export interface Evidence {
  label: string;
  answer: string;
  /** 0-1. Acima de 0.7 conta como força; até 0.4, como lacuna. */
  score: number;
}

export interface DimensionEvidence {
  dimension: DimensionId;
  strengths: Evidence[];
  gaps: Evidence[];
}

/** Rótulo legível da resposta de uma pergunta. */
function answerLabel(
  id: string,
  answers: Answers,
  country?: Country | null
): { text: string; score: number } | null {
  const q = QUESTIONS.find((x) => x.id === id);
  if (!q) return null;
  const value = answers[id];

  if (q.kind === 'multi') {
    const arr = Array.isArray(value) ? value : [];
    if (arr.length === 0) return null;
    const labels = arr
      .map((v) => q.options?.find((o) => o.value === v)?.label ?? v)
      .filter(Boolean);
    return { text: labels.join(', '), score: q.scoreMulti ? q.scoreMulti(arr) : 0 };
  }

  if (q.kind === 'single') {
    const opt = q.options?.find((o) => o.value === value);
    if (!opt || typeof opt.score !== 'number') return null;
    // Faixa de verba é reescrita na moeda do país; o resto usa o rótulo original.
    const localized = country ? bracketLabel(opt.value, country) : null;
    return { text: localized ?? opt.label, score: opt.score };
  }

  if (q.kind === 'text' || q.kind === 'longtext') {
    const text = String(value ?? '').trim();
    if (!text) return null;
    const score = Math.min(1, text.length / 120);
    const preview = text.length > 90 ? `${text.slice(0, 90)}…` : text;
    return { text: preview, score };
  }

  return null;
}

/** Agrupa, por dimensão, o que puxou a nota para cima e para baixo. */
export function evidenceByDimension(
  answers: Answers,
  signals: SiteSignals | null,
  country?: Country | null
): DimensionEvidence[] {
  const map = new Map<DimensionId, DimensionEvidence>();

  for (const q of visibleQuestions(answers)) {
    if (!q.dimension) continue;
    const resolved = answerLabel(q.id, answers, country);
    if (!resolved) continue;

    if (!map.has(q.dimension)) {
      map.set(q.dimension, { dimension: q.dimension, strengths: [], gaps: [] });
    }
    const entry = map.get(q.dimension)!;
    const item: Evidence = {
      label: LABELS[q.id] ?? q.title,
      answer: resolved.text,
      score: resolved.score,
    };
    if (resolved.score >= 0.7) entry.strengths.push(item);
    else if (resolved.score <= 0.4) entry.gaps.push(item);
  }

  // Sinais observados no site entram como evidência de verdade, não como opinião.
  if (signals) {
    const push = (dim: DimensionId, item: Evidence, ok: boolean) => {
      if (!map.has(dim)) map.set(dim, { dimension: dim, strengths: [], gaps: [] });
      (ok ? map.get(dim)!.strengths : map.get(dim)!.gaps).push(item);
    };

    const conv: Array<[string, boolean, string, string]> = [
      ['Formulário no site', signals.hasForm, 'encontrado', 'não encontrado'],
      ['Contato direto (WhatsApp/telefone)', signals.hasWhatsAppLink || signals.hasTelLink, 'encontrado', 'não encontrado'],
      ['Termos de conversão visíveis', signals.ctaTerms.length > 0, signals.ctaTerms.slice(0, 3).join(', '), 'nenhum encontrado'],
      ['Sinais de confiança na página', signals.trustSignals.length > 0, signals.trustSignals.slice(0, 3).join(', '), 'nenhum encontrado'],
    ];
    for (const [label, ok, yes, no] of conv) {
      push('conversao', { label: `${label} (observado)`, answer: ok ? yes : no, score: ok ? 1 : 0 }, ok);
    }

    const disc: Array<[string, boolean, string, string]> = [
      ['Dados estruturados', signals.hasSchemaOrg, signals.schemaTypes.slice(0, 4).join(', '), 'não encontrados'],
      ['Meta description', !!signals.metaDescription, 'presente', 'ausente'],
      ['Estrutura de subtítulos', signals.h2Count >= 2, `${signals.h2Count} seções`, 'estrutura rasa'],
    ];
    for (const [label, ok, yes, no] of disc) {
      push('discoverability', { label: `${label} (observado)`, answer: ok ? yes : no, score: ok ? 1 : 0 }, ok);
    }
  }

  for (const entry of map.values()) {
    entry.strengths.sort((a, b) => b.score - a.score);
    entry.gaps.sort((a, b) => a.score - b.score);
  }

  return [...map.values()];
}

// ---------------------------------------------------------------------------
// Alertas estratégicos — contradições ENTRE respostas
// ---------------------------------------------------------------------------

export interface Alert {
  severity: 'critico' | 'atencao';
  title: string;
  detail: string;
}

/**
 * O valor real do diagnóstico está aqui: cada resposta isolada pode parecer
 * aceitável, e o problema só aparece no cruzamento. Meta agressiva com
 * capacidade pequena, verba alta sem mensuração, objetivo de venda sem caminho
 * de compra — nenhuma dessas some numa média ponderada.
 */
export function strategicAlerts(
  answers: Answers,
  diagnosis: Diagnosis,
  signals: SiteSignals | null,
  country?: Country | null
): Alert[] {
  const alerts: Alert[] = [];
  const by = Object.fromEntries(diagnosis.dimensions.map((d) => [d.id, d.score])) as Record<DimensionId, number>;
  const { scenario } = diagnosis;

  const capacidade = VOLUME_MAX[String(answers['com_volume'] ?? '')] ?? null;
  const verba = INVEST_MID[String(answers['eco_investimento'] ?? '')] ?? null;
  const objetivo = String(answers['objetivo'] ?? '');
  const acao = String(answers['acao_desejada'] ?? '');
  const nuncaAnunciou =
    Array.isArray(answers['ads_canais']) && (answers['ads_canais'] as string[]).includes('nenhum');

  // 1. A meta exige mais leads do que a operação consegue atender.
  if (scenario.leadsNecessarios !== null && capacidade !== null && scenario.leadsNecessarios > capacidade) {
    alerts.push({
      severity: 'critico',
      title: 'Sua meta exige mais leads do que sua operação consegue atender',
      detail: `A simulação aponta ${scenario.leadsNecessarios} leads/mês para chegar ao faturamento desejado, mas você informou capacidade de atender até ${capacidade}. Aumentar mídia sem resolver isso gera custo de aquisição para leads que não serão trabalhados. Antes da verba, o gargalo é operacional.`,
    });
  }

  // 2. Verba relevante sem instrumentação: dinheiro sem leitura.
  if (verba !== null && verba >= 5000 && by.mensuracao < 50) {
    alerts.push({
      severity: 'critico',
      title: 'Investimento planejado sem estrutura de mensuração',
      detail: `Você pretende investir cerca de ${money(verba, country)}/mês, mas a mensuração está em ${by.mensuracao}/100. Sem conversão configurada e origem de lead confiável, não haverá como distinguir a campanha que gerou receita da que apenas gastou. Na prática, é decidir no escuro sobre um valor relevante.`,
    });
  }

  // 3. Objetivo de venda/lead sem caminho de conversão observado.
  const querConverter = ['vendas', 'leads', 'orcamento', 'agendamento'].includes(objetivo);
  if (querConverter && signals && !signals.hasForm && !signals.hasWhatsAppLink && !signals.hasTelLink) {
    alerts.push({
      severity: 'critico',
      title: 'O objetivo é conversão, mas não há caminho de conversão no site',
      detail: `Seu objetivo é ${OBJETIVO_TEXTO[objetivo] ?? objetivo}, e a leitura automática do site não encontrou formulário, WhatsApp nem telefone clicável. Todo tráfego pago que chegar hoje se perde sem deixar contato.`,
    });
  }

  // 4. Quer venda direta mas o site não tem compra.
  if (acao === 'comprar' && Array.isArray(answers['site_caminho']) && !(answers['site_caminho'] as string[]).includes('compra')) {
    alerts.push({
      severity: 'atencao',
      title: 'Você espera que o visitante compre, mas não há compra direta no site',
      detail: 'A ação desejada é a compra, e os caminhos de conversão informados não incluem compra direta. Ou a jornada precisa de um passo intermediário claro, ou o site precisa suportar a transação.',
    });
  }

  // 5. Resposta lenta anula o investimento em geração de demanda.
  const tempo = String(answers['com_tempo_resposta'] ?? '');
  if ((tempo === 'mais1dia' || tempo === 'dia') && querConverter) {
    alerts.push({
      severity: 'critico',
      title: 'O tempo de resposta compromete o retorno da mídia',
      detail: `Você informou que a equipe responde ${tempo === 'mais1dia' ? 'em mais de 1 dia' : 'no mesmo dia'}. Em aquisição paga, a janela de interesse é curta: o lead segue procurando enquanto espera. É o ajuste de maior impacto e menor custo do seu diagnóstico.`,
    });
  }

  // 6. Nunca anunciou + verba alta: risco de queimar orçamento aprendendo.
  if (nuncaAnunciou && verba !== null && verba >= 10000) {
    alerts.push({
      severity: 'atencao',
      title: 'Primeira operação de mídia com orçamento alto',
      detail: `Você nunca anunciou e planeja cerca de ${money(verba, country)}/mês. O primeiro ciclo é sempre de aprendizado — canal, oferta, criativo e página ainda não têm histórico. Começar com uma fração do orçamento e escalar sobre o que se provou custa menos do que aprender no valor cheio.`,
    });
  }

  // 7. Marca invisível para IA numa ferramenta sobre anunciar em IA.
  if (by.discoverability < 45) {
    const nuncaTestou = answers['ia_aparece'] === 'nunca' || answers['ia_pesquisou'] === 'nunca';
    alerts.push({
      severity: 'atencao',
      title: 'Sua marca tem pouca presença nos sinais que sistemas de IA leem',
      detail: nuncaTestou
        ? 'Você indicou nunca ter testado se sua empresa aparece em respostas de IA. Esse teste custa alguns minutos e é o ponto de partida: sem saber o estado atual, não há como medir avanço. Discoverability orgânica e anúncio pago são coisas diferentes, mas uma marca ausente do contexto tende a converter pior mesmo quando o anúncio aparece.'
        : 'A combinação de conteúdo, estrutura e presença externa está abaixo do que costuma sustentar uma marca como resposta em sistemas de IA. Isso não impede anunciar, mas encarece: o anúncio precisa fazer sozinho o trabalho de apresentação que a presença orgânica faria.',
    });
  }

  // 8. Não sabe o que virou cliente: otimização fica cega.
  if (answers['track_lead_cliente'] === 'nao' && by.mensuracao < 70) {
    alerts.push({
      severity: 'atencao',
      title: 'Sem ligação entre lead e venda, a otimização persegue o alvo errado',
      detail: 'Você informou não conseguir identificar quais leads viraram clientes. Sem isso, as plataformas otimizam por volume de lead — e o canal mais barato em CPL costuma ser o mais caro em CAC.',
    });
  }

  // 9. Oferta indefinida: a mídia amplifica a indefinição.
  if (answers['oferta_status'] === 'varios' || answers['oferta_status'] === 'nao') {
    alerts.push({
      severity: 'atencao',
      title: 'A campanha começaria sem uma oferta delimitada',
      detail: 'Você indicou não ter uma oferta priorizada. Campanha sem oferta clara vira disputa por preço, porque é o único critério que sobra para o comparador. Escolher um produto-âncora costuma valer mais do que qualquer otimização de lance.',
    });
  }

  // 10. B2B de ciclo longo com verba curta.
  if ((answers['b2b_ciclo'] === 'longo' || answers['b2b_ciclo'] === 'muitolongo') && verba !== null && verba <= 3000) {
    alerts.push({
      severity: 'atencao',
      title: 'Ciclo de vendas longo com orçamento curto',
      detail: 'Seu ciclo passa de 90 dias e a verba prevista é enxuta. Nesse formato, o retorno não aparece dentro do mês — é preciso fôlego de caixa para atravessar o ciclo antes de julgar o canal, sob o risco de desligar uma campanha que estava funcionando.',
    });
  }

  const ordem = { critico: 0, atencao: 1 };
  return alerts.sort((a, b) => ordem[a.severity] - ordem[b.severity]).slice(0, 6);
}

// ---------------------------------------------------------------------------
// Sumário executivo
// ---------------------------------------------------------------------------

/**
 * Parágrafos que devolvem ao leitor a própria situação, com os números que ele
 * informou. É o que diferencia um relatório de um medidor: a pessoa reconhece
 * o próprio negócio na leitura.
 */
export function executiveSummary(
  identity: Identity,
  answers: Answers,
  diagnosis: Diagnosis,
  /** Precisa ser o MESMO valor passado a `strategicAlerts` na tela: com sinais
   *  do site nascem alertas críticos a mais, e o resumo contaria a menos. */
  signals: SiteSignals | null = null,
  country?: Country | null
): string[] {
  const out: string[] = [];
  const empresa = identity.empresa.trim() || 'Sua empresa';
  const modelo = MODELO_TEXTO[identity.modelo] ?? null;
  const segmento = identity.segmento.trim();
  const objetivo = OBJETIVO_TEXTO[String(answers['objetivo'] ?? '')] ?? null;
  const produto = String(answers['produto_principal'] ?? '').trim();

  // Parágrafo 1 — contexto declarado.
  const ctx: string[] = [`${empresa}`];
  if (modelo && segmento) ctx.push(`opera como ${modelo} em ${segmento}`);
  else if (modelo) ctx.push(`opera como ${modelo}`);
  else if (segmento) ctx.push(`atua em ${segmento}`);
  if (produto) ctx.push(`tendo ${produto.toLowerCase()} como principal produto ou serviço`);
  if (objetivo) ctx.push(`e busca ${objetivo} através de mídia em ambientes de IA`);
  out.push(ctx.join(', ').replace(/,([^,]*)$/, '$1') + '.');

  // Parágrafo 2 — o número e o que ele significa aqui.
  const ordenadas = [...diagnosis.dimensions].filter((d) => d.answered > 0).sort((a, b) => b.score - a.score);
  const melhor = ordenadas[0];
  const pior = ordenadas[ordenadas.length - 1];
  if (melhor && pior && melhor.id !== pior.id) {
    out.push(
      `O diagnóstico resultou em ${diagnosis.total}/100 — ${diagnosis.classification.label.toLowerCase()}. ` +
        `A dimensão mais sólida é ${melhor.label.toLowerCase()} (${melhor.score}/100), e a mais frágil é ` +
        `${pior.label.toLowerCase()} (${pior.score}/100). A distância entre as duas é o que define a ordem do plano: ` +
        `investir na frente forte rende pouco enquanto a fraca continuar limitando o resultado.`
    );
  }

  // Parágrafo 3 — economia, só com dado informado.
  const ticket = toNumber(answers['eco_ticket']);
  const meta = toNumber(answers['eco_meta']);
  const verba = INVEST_MID[String(answers['eco_investimento'] ?? '')] ?? null;
  if (ticket && meta) {
    const vendas = Math.ceil(meta / ticket);
    let frase =
      `Com ticket médio de ${money(ticket, country)} e meta de ${money(meta, country)} adicionais por mês, ` +
      `o objetivo equivale a aproximadamente ${vendas} venda${vendas > 1 ? 's' : ''} nova${vendas > 1 ? 's' : ''} por mês.`;
    if (verba) {
      const custoMax = Math.floor(verba / vendas);
      frase += ` Com a verba prevista de ${money(verba, country)}/mês, isso implica um custo de aquisição máximo de cerca de ${money(custoMax, country)} por cliente para a conta fechar apenas com mídia.`;
    }
    out.push(frase);
  } else if (verba) {
    out.push(
      `A verba prevista é de cerca de ${money(verba, country)}/mês. Sem ticket médio e meta informados, não é possível ` +
        `dimensionar quantas vendas esse investimento precisaria gerar — e é justamente essa conta que define se o canal faz sentido.`
    );
  }

  // Parágrafo 4 — a leitura de risco, quando houver.
  const criticos = strategicAlerts(answers, diagnosis, signals, country).filter((a) => a.severity === 'critico');
  if (criticos.length === 1) {
    out.push(
      `Foi identificado 1 ponto crítico no cruzamento das respostas — uma situação em que cada item isolado ` +
        `parece aceitável, mas a combinação compromete o resultado. Ele está detalhado na seção de alertas e ` +
        `deveria ser resolvido antes de qualquer aumento de investimento.`
    );
  } else if (criticos.length > 1) {
    out.push(
      `Foram identificados ${criticos.length} pontos críticos no cruzamento das respostas — situações em que cada ` +
        `item isolado parece aceitável, mas a combinação compromete o resultado. Eles estão detalhados na seção de ` +
        `alertas e deveriam ser resolvidos antes de qualquer aumento de investimento.`
    );
  }

  return out;
}

// ---------------------------------------------------------------------------
// Plano priorizado — impacto × esforço
// ---------------------------------------------------------------------------

export interface PriorityAction {
  action: string;
  impact: 'alto' | 'medio';
  effort: 'baixo' | 'medio' | 'alto';
  rationale: string;
}

/**
 * Ordena por retorno prático: impacto alto e esforço baixo primeiro. É a
 * diferença entre uma lista de boas intenções e um plano executável.
 */
export function priorityActions(answers: Answers, diagnosis: Diagnosis, signals: SiteSignals | null): PriorityAction[] {
  const by = Object.fromEntries(diagnosis.dimensions.map((d) => [d.id, d.score])) as Record<DimensionId, number>;
  const actions: PriorityAction[] = [];
  const tempo = String(answers['com_tempo_resposta'] ?? '');

  if (tempo === 'mais1dia' || tempo === 'dia' || tempo === '2h') {
    actions.push({
      action: 'Estabelecer SLA de primeira resposta abaixo de 30 minutos',
      impact: 'alto',
      effort: 'baixo',
      rationale: 'Depende de processo e notificação, não de tecnologia nova. Melhora a conversão de tudo que já entra hoje.',
    });
  }
  if (answers['track_conversoes'] !== 'sim') {
    actions.push({
      action: 'Configurar e validar as conversões do site',
      impact: 'alto',
      effort: 'baixo',
      rationale: 'Pré-requisito técnico de qualquer campanha. Sem isso, a plataforma não consegue otimizar e você não consegue avaliar.',
    });
  }
  if (signals && !signals.hasWhatsAppLink && !signals.hasTelLink) {
    actions.push({
      action: 'Publicar contato direto (WhatsApp ou telefone) acima da dobra',
      impact: 'alto',
      effort: 'baixo',
      rationale: 'Não foi encontrado na leitura do site. Recupera contatos que hoje se perdem por falta de caminho.',
    });
  }
  if (answers['oferta_status'] === 'varios' || answers['oferta_status'] === 'nao' || by.oferta < 55) {
    actions.push({
      action: 'Delimitar uma oferta-âncora com escopo e diferencial escritos',
      impact: 'alto',
      effort: 'medio',
      rationale: 'É o insumo de toda a comunicação. Sem ela, criativo e página competem só por preço.',
    });
  }
  if (answers['site_lp'] === 'home' || answers['site_lp'] === 'algumas') {
    actions.push({
      action: 'Criar página dedicada para o serviço prioritário',
      impact: 'alto',
      effort: 'medio',
      rationale: 'Tráfego pago em home dilui intenção. Uma página por oferta costuma mover conversão mais que otimização de lance.',
    });
  }
  if (by.mensuracao < 70) {
    actions.push({
      action: 'Ligar o lead ao resultado de venda (CRM ou planilha estruturada)',
      impact: 'alto',
      effort: 'medio',
      rationale: 'Permite otimizar por cliente, não por volume de lead — muda qual campanha parece boa.',
    });
  }
  if (by.discoverability < 65) {
    actions.push({
      action: 'Produzir conteúdo respondendo as dúvidas reais de pré-compra',
      impact: 'medio',
      effort: 'alto',
      rationale: 'Retorno mais lento, porém acumulativo: é o que sustenta a marca como resposta em sistemas de IA.',
    });
    actions.push({
      action: 'Ampliar presença em fontes externas do setor',
      impact: 'medio',
      effort: 'alto',
      rationale: 'Depende de terceiros e tempo, mas é o sinal mais difícil de um concorrente copiar.',
    });
  }

  const impactRank = { alto: 0, medio: 1 };
  const effortRank = { baixo: 0, medio: 1, alto: 2 };
  return actions
    .sort((a, b) => impactRank[a.impact] - impactRank[b.impact] || effortRank[a.effort] - effortRank[b.effort])
    .slice(0, 7);
}
