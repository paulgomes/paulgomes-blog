/**
 * Gargalos, oportunidades e roadmap.
 *
 * Nada aqui é texto fixo de relatório: as saídas derivam das dimensões mais
 * fracas E do perfil respondido (modelo de negócio, objetivo, maturidade de
 * mídia). Dois diagnósticos com o mesmo score total, mas perfis diferentes,
 * produzem roadmaps diferentes — que é exatamente o requisito do briefing.
 */

import type {
  Answers,
  Bottleneck,
  DimensionId,
  DimensionScore,
  Opportunity,
  RoadmapPhase,
  SiteSignals,
} from './types';

// --- Diagnóstico textual por dimensão --------------------------------------

const BOTTLENECK_COPY: Record<DimensionId, string> = {
  mensuracao:
    'Seu nível de mensuração está abaixo do recomendado. Sem conversões configuradas e origem de lead confiável, o investimento em mídia fica sem leitura — você não saberá o que cortar nem o que escalar.',
  discoverability:
    'Sua marca possui baixa presença nos sinais digitais analisados. Sistemas de IA precisam de conteúdo, contexto e referências externas para considerar uma empresa como resposta.',
  conversao:
    'Sua estrutura atual pode perder parte do tráfego antes que ele se transforme em oportunidade comercial. O custo desse vazamento cresce na mesma proporção do investimento.',
  oferta:
    'Sua oferta ainda não está suficientemente delimitada. Sem clareza sobre o que se compra e por que escolher você, a mídia amplifica uma mensagem que ainda não converte.',
  comercial:
    'A estrutura de atendimento é um gargalo. Lead gerado e não respondido a tempo é verba convertida em custo, não em receita.',
  ads: 'Sua maturidade em mídia paga ainda é inicial. Sem domínio das próprias métricas, fica difícil distinguir campanha ruim de operação despreparada.',
  escala:
    'Sua capacidade de absorver volume é limitada. Escalar investimento sem folga operacional degrada a experiência e o retorno ao mesmo tempo.',
};

/** Os 3 piores desempenhos, priorizando dimensões de maior peso no empate. */
export function bottlenecks(dimensions: DimensionScore[]): Bottleneck[] {
  return dimensions
    .filter((d) => d.answered > 0)
    .slice()
    .sort((a, b) => a.score - b.score || b.weight - a.weight)
    .slice(0, 3)
    .map((d, i) => ({
      rank: i + 1,
      dimension: d.id,
      label: d.label,
      message: BOTTLENECK_COPY[d.id],
    }));
}

// --- Oportunidades ----------------------------------------------------------

interface Rule {
  /** Só entra quando o predicado é verdadeiro. */
  when: (ctx: Ctx) => boolean;
  title: string;
  detail: string;
  /** Maior = mais prioritário. */
  priority: number;
}

interface Ctx {
  answers: Answers;
  byId: Record<DimensionId, number>;
  signals: SiteSignals | null;
  modelo: string;
  objetivo: string;
}

const OPPORTUNITY_RULES: Rule[] = [
  {
    when: (c) => c.byId.mensuracao < 60,
    title: 'Implementar mensuração completa das conversões',
    detail:
      'Configurar GA4 e Tag Manager, marcar cada caminho de conversão como evento e ligar o resultado ao CRM. É o que transforma investimento em decisão baseada em dado.',
    priority: 100,
  },
  {
    when: (c) => c.byId.discoverability < 65,
    title: 'Aumentar a presença da marca em fontes relevantes para descoberta por IA',
    detail:
      'Trabalhar conteúdo que responda dúvidas reais de pré-compra, estruturar dados no site e ampliar menções em portais, avaliações e diretórios do seu setor.',
    priority: 95,
  },
  {
    when: (c) => c.answers['site_lp'] === 'home' || c.answers['site_lp'] === 'algumas',
    title: 'Estruturar páginas específicas para intenção de compra',
    detail:
      'Cada serviço ou campanha com sua própria página, com headline, oferta, prova e um caminho único de conversão. Tráfego pago na home dilui intenção.',
    priority: 90,
  },
  {
    when: (c) => c.byId.conversao < 60,
    title: 'Corrigir os vazamentos do caminho de conversão',
    detail:
      'Revisar clareza da proposta, hierarquia de CTA e experiência mobile antes de aumentar verba — o mesmo tráfego passa a render mais sem custar mais.',
    priority: 85,
  },
  {
    when: (c) => c.byId.oferta < 60,
    title: 'Delimitar uma oferta principal e seu diferencial',
    detail:
      'Escolher um produto-âncora, definir o que está incluso e articular por que escolher sua empresa. Campanha sem oferta clara vira disputa por preço.',
    priority: 88,
  },
  {
    when: (c) => c.answers['com_tempo_resposta'] === 'mais1dia' || c.answers['com_tempo_resposta'] === 'dia',
    title: 'Reduzir o tempo de primeira resposta ao lead',
    detail:
      'Criar um fluxo de contato imediato — notificação, distribuição e SLA. É o ajuste de maior impacto por menor esforço em quase toda operação.',
    priority: 92,
  },
  {
    when: () => true,
    title: 'Criar uma jornada específica para tráfego proveniente de IA',
    detail:
      'Quem chega por uma recomendação de IA já vem com contexto e comparação feitos. Essa audiência precisa de uma página que confirme a escolha, não de uma que apresente a empresa do zero.',
    priority: 70,
  },
  {
    when: (c) => c.modelo === 'ecommerce' || c.modelo === 'marketplace',
    title: 'Estruturar catálogo e recuperação de carrinho',
    detail:
      'Dados de produto completos alimentam feeds e sistemas de IA; recuperação de carrinho devolve receita que a mídia já pagou para trazer.',
    priority: 80,
  },
  {
    when: (c) => c.modelo === 'b2b' || c.modelo === 'b2b2c',
    title: 'Formalizar qualificação de leads antes de vendas',
    detail:
      'Com ciclo longo e múltiplos decisores, separar lead de oportunidade evita que o time comercial gaste tempo com volume que nunca fecharia.',
    priority: 80,
  },
  {
    when: (c) => c.modelo === 'saas',
    title: 'Ligar aquisição a LTV e churn',
    detail:
      'Em SaaS, CAC só faz sentido contra o valor do ciclo de vida. Sem essa leitura, campanhas boas em CPL podem estar comprando o cliente errado.',
    priority: 80,
  },
  {
    when: (c) => !!c.signals && !c.signals.hasSchemaOrg,
    title: 'Adicionar dados estruturados ao site',
    detail:
      'Não foram encontrados dados estruturados nas páginas analisadas. Marcação semântica ajuda sistemas automatizados a entender o que a empresa faz e oferece.',
    priority: 75,
  },
  {
    when: (c) => !!c.signals && !c.signals.hasForm && !c.signals.hasWhatsAppLink && !c.signals.hasTelLink,
    title: 'Criar um caminho de contato visível na página inicial',
    detail:
      'A análise não encontrou formulário, link de WhatsApp nem telefone clicável. Tráfego que chega sem caminho de contato se perde inteiro.',
    priority: 98,
  },
  {
    when: (c) => c.answers['ads_canais'] === undefined || (Array.isArray(c.answers['ads_canais']) && (c.answers['ads_canais'] as string[]).includes('nenhum')),
    title: 'Validar canal e oferta antes de escalar verba',
    detail:
      'Sem histórico de mídia, o primeiro ciclo é de aprendizado: orçamento controlado, hipóteses claras e leitura de dados desde o primeiro dia.',
    priority: 78,
  },
];

export function opportunities(
  answers: Answers,
  dimensions: DimensionScore[],
  signals: SiteSignals | null
): Opportunity[] {
  const byId = Object.fromEntries(dimensions.map((d) => [d.id, d.score])) as Record<DimensionId, number>;
  const ctx: Ctx = {
    answers,
    byId,
    signals,
    modelo: String(answers['modelo'] ?? ''),
    objetivo: String(answers['objetivo'] ?? ''),
  };

  return OPPORTUNITY_RULES.filter((r) => r.when(ctx))
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 5)
    .map(({ title, detail }) => ({ title, detail }));
}

// --- Roadmap ----------------------------------------------------------------

/**
 * Monta as três janelas a partir do que de fato está fraco. Cada item entra com
 * uma condição; se a empresa já resolveu aquele ponto, o item não aparece e a
 * janela recebe o próximo da fila — evitando roadmap genérico.
 */
export function roadmap(
  answers: Answers,
  dimensions: DimensionScore[],
  signals: SiteSignals | null
): RoadmapPhase[] {
  const byId = Object.fromEntries(dimensions.map((d) => [d.id, d.score])) as Record<DimensionId, number>;
  const modelo = String(answers['modelo'] ?? '');
  const nuncaAnunciou =
    Array.isArray(answers['ads_canais']) && (answers['ads_canais'] as string[]).includes('nenhum');

  const first: string[] = [];
  const second: string[] = [];
  const third: string[] = [];

  // --- 0-30: fundamentos que impedem qualquer leitura ---
  if (byId.mensuracao < 70) {
    first.push('Corrigir tracking: GA4 e Tag Manager instalados e validados.');
    first.push('Definir e marcar cada conversão do site como evento.');
  }
  if (byId.oferta < 65) first.push('Revisar a oferta principal: escopo, preço-âncora e diferencial.');
  if (byId.conversao < 65) first.push('Otimizar a página de destino principal: headline, prova e CTA único.');
  if (answers['com_tempo_resposta'] === 'mais1dia' || answers['com_tempo_resposta'] === 'dia') {
    first.push('Estabelecer SLA de primeira resposta e fluxo de notificação de lead.');
  }
  if (signals && !signals.hasForm && !signals.hasWhatsAppLink) {
    first.push('Publicar um caminho de contato visível acima da dobra.');
  }
  if (first.length === 0) {
    first.push('Auditar a instrumentação atual e documentar a linha de base das métricas.');
    first.push('Definir a hipótese de campanha e os critérios de sucesso do primeiro ciclo.');
  }

  // --- 30-60: construir a estrutura de aquisição ---
  if (byId.conversao < 80) second.push('Criar páginas de intenção para os serviços prioritários.');
  if (byId.discoverability < 75) {
    second.push('Produzir conteúdo que responda as dúvidas de pré-compra do seu cliente.');
    second.push('Estruturar dados do site e ampliar presença em fontes externas relevantes.');
  }
  second.push(
    nuncaAnunciou
      ? 'Estruturar a primeira campanha com orçamento controlado e leitura diária.'
      : 'Reestruturar campanhas por intenção e separar verba de teste e de escala.'
  );
  if (modelo === 'ecommerce' || modelo === 'marketplace') {
    second.push('Completar dados de catálogo e ativar recuperação de carrinho.');
  }
  if (modelo === 'b2b' || modelo === 'b2b2c') {
    second.push('Implementar qualificação de leads e integração com o CRM.');
  }
  if (modelo === 'saas') second.push('Instrumentar trial/demo até ativação e ligar a origem da mídia.');

  // --- 60-90: otimizar e escalar ---
  third.push('Iniciar testes controlados de criativo, oferta e página.');
  third.push('Comparar canais por CPL e por qualidade de lead, não só por volume.');
  if (byId.mensuracao >= 60) third.push('Otimizar CAC com base no que virou cliente, não no que virou lead.');
  third.push('Escalar apenas o que se provou rentável, mantendo a folga operacional.');
  if (byId.escala < 60) {
    third.push('Preparar a operação para o volume adicional antes de aumentar a verba.');
  }

  const trim = (items: string[]) => items.slice(0, 5);

  return [
    { window: '0-30', label: 'Primeiros 30 dias', items: trim(first) },
    { window: '30-60', label: '30 a 60 dias', items: trim(second) },
    { window: '60-90', label: '60 a 90 dias', items: trim(third) },
  ];
}
