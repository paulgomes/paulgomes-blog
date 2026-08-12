/**
 * Banco de perguntas do diagnóstico.
 *
 * Cada pergunta declara a dimensão que alimenta e o peso relativo dentro dela.
 * As opções carregam `score` de 0 a 1 — a normalização por dimensão acontece em
 * scoring.ts, então acrescentar/remover perguntas não desbalanceia o total.
 *
 * `when` implementa a lógica adaptativa: quem nunca anunciou não recebe pergunta
 * de CPL atual, e-commerce recebe pergunta de checkout, B2B recebe ciclo de
 * vendas, e assim por diante.
 */

import type { Answers, Question } from './types';

// --- helpers de predicado ---------------------------------------------------

const is = (id: string, ...values: string[]) => (a: Answers) => values.includes(String(a[id] ?? ''));

const modelo = (...values: string[]) => (a: Answers) => values.includes(String(a['modelo'] ?? ''));

/** Verdadeiro quando o usuário marcou ao menos um canal de mídia (≠ nunca anunciou). */
const jaAnuncia = (a: Answers) => {
  const v = a['ads_canais'];
  return Array.isArray(v) && v.length > 0 && !v.includes('nenhum');
};

// --- escalas reutilizáveis --------------------------------------------------

const SIM_PARCIAL_NAO = [
  { value: 'sim', label: 'Sim', score: 1 },
  { value: 'parcial', label: 'Parcialmente', score: 0.5 },
  { value: 'nao', label: 'Não', score: 0 },
];

const SIM_NAO_NAOSEI = [
  { value: 'sim', label: 'Sim', score: 1 },
  { value: 'nao', label: 'Não', score: 0 },
  { value: 'naosei', label: 'Não sei', score: 0.1, hint: 'Não saber já é um diagnóstico.' },
];

export const QUESTIONS: readonly Question[] = [
  // =========================================================================
  // 2 · OBJETIVO
  // =========================================================================
  {
    id: 'objetivo',
    step: 'objetivo',
    kind: 'single',
    title: 'Qual é seu principal objetivo ao anunciar no ChatGPT?',
    help: 'Isso define como o restante do diagnóstico é interpretado.',
    options: [
      { value: 'vendas', label: 'Gerar vendas' },
      { value: 'leads', label: 'Gerar leads' },
      { value: 'orcamento', label: 'Receber pedidos de orçamento' },
      { value: 'agendamento', label: 'Gerar agendamentos' },
      { value: 'marca', label: 'Aumentar reconhecimento de marca' },
      { value: 'trafego', label: 'Levar usuários para o site' },
      { value: 'produto', label: 'Divulgar um produto específico' },
      { value: 'outro', label: 'Outro' },
    ],
  },
  {
    id: 'acao_desejada',
    step: 'objetivo',
    kind: 'single',
    title: 'O que você gostaria que uma pessoa fizesse depois de conhecer sua empresa?',
    options: [
      { value: 'comprar', label: 'Comprar' },
      { value: 'orcamento', label: 'Solicitar orçamento' },
      { value: 'whatsapp', label: 'Chamar no WhatsApp' },
      { value: 'agendar', label: 'Agendar' },
      { value: 'formulario', label: 'Preencher formulário' },
      { value: 'telefone', label: 'Telefonar' },
      { value: 'loja', label: 'Conhecer a loja física' },
      { value: 'cadastro', label: 'Fazer cadastro' },
      { value: 'outro', label: 'Outro' },
    ],
  },
  {
    id: 'produto_principal',
    step: 'objetivo',
    kind: 'text',
    title: 'Qual é o seu principal produto ou serviço?',
    placeholder: 'Ex.: implante dentário, ERP para indústrias, consultoria tributária…',
    dimension: 'oferta',
    weight: 1,
  },

  // =========================================================================
  // 3 · OFERTA
  // =========================================================================
  {
    id: 'oferta_status',
    step: 'oferta',
    kind: 'single',
    title: 'Você possui uma oferta específica que gostaria de promover?',
    dimension: 'oferta',
    weight: 2,
    options: [
      { value: 'definida', label: 'Sim, está claramente definida.', score: 1 },
      { value: 'estruturar', label: 'Sim, mas ainda preciso estruturá-la.', score: 0.55 },
      { value: 'varios', label: 'Tenho vários produtos/serviços e não sei qual priorizar.', score: 0.3 },
      { value: 'nao', label: 'Não.', score: 0 },
    ],
  },
  {
    id: 'oferta_descricao',
    step: 'oferta',
    kind: 'longtext',
    title: 'Descreva a oferta que você quer promover.',
    placeholder: 'O que está incluso, para quem é, qual o compromisso comercial.',
    when: is('oferta_status', 'definida', 'estruturar'),
    optional: true,
  },
  {
    id: 'diferencial',
    step: 'oferta',
    kind: 'longtext',
    title: 'Por que alguém deveria escolher sua empresa em vez de um concorrente?',
    help: 'Essa resposta costuma ser o insumo mais importante de uma campanha.',
    dimension: 'oferta',
    weight: 2,
    placeholder: 'Seja concreto: prazo, garantia, especialização, tecnologia, atendimento…',
  },
  {
    id: 'provas',
    step: 'oferta',
    kind: 'multi',
    title: 'Você possui provas de resultado?',
    help: 'Marque tudo que sua empresa já tem documentado hoje.',
    dimension: 'oferta',
    weight: 2,
    options: [
      { value: 'avaliacoes', label: 'Avaliações' },
      { value: 'depoimentos', label: 'Depoimentos' },
      { value: 'cases', label: 'Cases' },
      { value: 'clientes', label: 'Clientes conhecidos' },
      { value: 'numeros', label: 'Números/resultados' },
      { value: 'premios', label: 'Prêmios/certificações' },
      { value: 'nenhuma', label: 'Nenhuma' },
    ],
    // Prova social tem retorno decrescente: 3 tipos já sinalizam maturidade.
    scoreMulti: (v) => {
      if (v.includes('nenhuma') || v.length === 0) return 0;
      return Math.min(1, v.filter((x) => x !== 'nenhuma').length / 3);
    },
  },

  // =========================================================================
  // 4 · MATURIDADE DE IA  →  AI Discoverability
  // =========================================================================
  {
    id: 'ia_aparece',
    step: 'ia',
    kind: 'single',
    title: 'Quando alguém pergunta ao ChatGPT por uma empresa como a sua, você sabe se sua marca aparece?',
    dimension: 'discoverability',
    weight: 2,
    options: [
      { value: 'sim', label: 'Sim', score: 1 },
      { value: 'asvezes', label: 'Algumas vezes', score: 0.6 },
      { value: 'nao', label: 'Não', score: 0.15 },
      { value: 'nunca', label: 'Nunca testei', score: 0 },
    ],
  },
  {
    id: 'ia_pesquisou',
    step: 'ia',
    kind: 'single',
    title: 'Você já pesquisou no ChatGPT perguntas relacionadas ao seu produto ou serviço?',
    dimension: 'discoverability',
    weight: 2,
    options: [
      { value: 'aparece', label: 'Sim, e minha empresa aparece.', score: 1 },
      { value: 'inconsistente', label: 'Sim, mas aparece de forma inconsistente.', score: 0.55 },
      { value: 'naoaparece', label: 'Sim, mas minha empresa não aparece.', score: 0.2 },
      { value: 'nunca', label: 'Nunca testei.', score: 0 },
    ],
  },
  {
    id: 'ia_conteudo',
    step: 'ia',
    kind: 'single',
    title: 'Sua empresa possui conteúdo respondendo às principais dúvidas que seus clientes fazem antes de comprar?',
    help: 'Conteúdo de intenção é o que sistemas de IA conseguem citar como resposta.',
    dimension: 'discoverability',
    weight: 2,
    options: [
      { value: 'sim', label: 'Sim', score: 1 },
      { value: 'parcial', label: 'Parcialmente', score: 0.5 },
      { value: 'nao', label: 'Não', score: 0 },
      { value: 'naosei', label: 'Não sei', score: 0.1 },
    ],
  },
  {
    id: 'ia_presenca_externa',
    step: 'ia',
    kind: 'single',
    title: 'Sua empresa possui presença em fontes externas relevantes?',
    help: 'Notícias, portais, avaliações, diretórios, sites especializados, associações, publicações, parceiros.',
    dimension: 'discoverability',
    weight: 2,
    options: [
      { value: 'forte', label: 'Forte', score: 1 },
      { value: 'moderada', label: 'Moderada', score: 0.6 },
      { value: 'baixa', label: 'Baixa', score: 0.2 },
      { value: 'naosei', label: 'Não sei', score: 0.1 },
    ],
  },

  // =========================================================================
  // 5 · SITE E CONVERSÃO (auto-relato; o scan complementa)
  // =========================================================================
  {
    id: 'site_clareza',
    step: 'site',
    kind: 'single',
    title: 'Um visitante entende em poucos segundos o que sua empresa oferece?',
    dimension: 'conversao',
    weight: 2,
    options: SIM_PARCIAL_NAO,
  },
  {
    id: 'site_caminho',
    step: 'site',
    kind: 'multi',
    title: 'Quais caminhos de conversão existem hoje no seu site?',
    dimension: 'conversao',
    weight: 2,
    options: [
      { value: 'formulario', label: 'Formulário' },
      { value: 'whatsapp', label: 'WhatsApp' },
      { value: 'telefone', label: 'Telefone' },
      { value: 'agendamento', label: 'Agendamento online' },
      { value: 'compra', label: 'Compra direta' },
      { value: 'chat', label: 'Chat' },
      { value: 'nenhum', label: 'Nenhum' },
    ],
    scoreMulti: (v) => {
      if (v.includes('nenhum') || v.length === 0) return 0;
      return Math.min(1, v.filter((x) => x !== 'nenhum').length / 3);
    },
  },
  {
    id: 'site_lp',
    step: 'site',
    kind: 'single',
    title: 'Você tem páginas específicas para cada serviço ou campanha?',
    help: 'Mandar tráfego pago para a home costuma ser o vazamento mais caro de uma operação.',
    dimension: 'conversao',
    weight: 2,
    options: [
      { value: 'sim', label: 'Sim, tenho páginas dedicadas.', score: 1 },
      { value: 'algumas', label: 'Algumas.', score: 0.55 },
      { value: 'home', label: 'Não, mando tudo para a home.', score: 0.1 },
      { value: 'sem_site', label: 'Não tenho site.', score: 0 },
    ],
  },
  {
    id: 'site_mobile',
    step: 'site',
    kind: 'single',
    title: 'Seu site funciona bem no celular?',
    dimension: 'conversao',
    weight: 1,
    options: [
      { value: 'sim', label: 'Sim, é rápido e fácil de usar.', score: 1 },
      { value: 'razoavel', label: 'Funciona, mas dá para melhorar.', score: 0.5 },
      { value: 'nao', label: 'Não, tem problemas claros.', score: 0 },
      { value: 'naosei', label: 'Não sei.', score: 0.15 },
    ],
  },

  // =========================================================================
  // 6 · TRACKING  →  Mensuração
  // =========================================================================
  {
    id: 'track_origem',
    step: 'tracking',
    kind: 'single',
    title: 'Você sabe exatamente de onde vêm seus leads?',
    dimension: 'mensuracao',
    weight: 2,
    options: SIM_PARCIAL_NAO,
  },
  {
    id: 'track_ga',
    step: 'tracking',
    kind: 'single',
    title: 'Você possui Google Analytics?',
    dimension: 'mensuracao',
    weight: 1,
    options: SIM_NAO_NAOSEI,
  },
  {
    id: 'track_gtm',
    step: 'tracking',
    kind: 'single',
    title: 'Você utiliza Google Tag Manager?',
    dimension: 'mensuracao',
    weight: 1,
    options: SIM_NAO_NAOSEI,
  },
  {
    id: 'track_conversoes',
    step: 'tracking',
    kind: 'single',
    title: 'Suas conversões estão configuradas?',
    help: 'Sem conversão configurada, nenhuma plataforma de mídia consegue otimizar.',
    dimension: 'mensuracao',
    weight: 2,
    options: SIM_NAO_NAOSEI,
  },
  {
    id: 'track_lead_cliente',
    step: 'tracking',
    kind: 'single',
    title: 'Você consegue saber quais leads se transformaram em clientes?',
    dimension: 'mensuracao',
    weight: 2,
    options: SIM_PARCIAL_NAO,
  },
  {
    id: 'track_crm',
    step: 'tracking',
    kind: 'single',
    title: 'Existe integração entre marketing, vendas e CRM?',
    dimension: 'mensuracao',
    weight: 1,
    options: SIM_PARCIAL_NAO,
  },

  // =========================================================================
  // 7 · CAPACIDADE COMERCIAL
  // =========================================================================
  {
    id: 'com_volume',
    step: 'comercial',
    kind: 'single',
    title: 'Quantos leads sua empresa consegue atender por mês?',
    dimension: 'escala',
    weight: 2,
    options: [
      { value: 'ate20', label: 'Até 20', score: 0.2 },
      { value: '20a50', label: '20–50', score: 0.45 },
      { value: '50a100', label: '50–100', score: 0.7 },
      { value: '100a500', label: '100–500', score: 0.9 },
      { value: '500mais', label: '500+', score: 1 },
      { value: 'naosei', label: 'Não sei', score: 0.1 },
    ],
  },
  {
    id: 'com_tempo_resposta',
    step: 'comercial',
    kind: 'single',
    title: 'Quanto tempo sua equipe leva para responder um novo lead?',
    help: 'Velocidade de resposta é um dos fatores mais determinantes de conversão em mídia paga.',
    dimension: 'comercial',
    weight: 3,
    options: [
      { value: '5min', label: 'Menos de 5 minutos', score: 1 },
      { value: '30min', label: '5–30 minutos', score: 0.85 },
      { value: '2h', label: 'Até 2 horas', score: 0.6 },
      { value: 'dia', label: 'Mesmo dia', score: 0.4 },
      { value: 'mais1dia', label: 'Mais de 1 dia', score: 0.1 },
      { value: 'naosei', label: 'Não sei', score: 0.1 },
    ],
  },
  {
    id: 'com_equipe',
    step: 'comercial',
    kind: 'single',
    title: 'Você possui equipe comercial?',
    dimension: 'comercial',
    weight: 2,
    options: [
      { value: 'sim', label: 'Sim', score: 1 },
      { value: 'terceirizada', label: 'Terceirizada', score: 0.7 },
      { value: 'proprietario', label: 'Apenas o proprietário', score: 0.35 },
      { value: 'nao', label: 'Não', score: 0 },
    ],
  },
  {
    id: 'com_taxa',
    step: 'comercial',
    kind: 'single',
    title: 'Você acompanha a taxa de conversão de lead para cliente?',
    dimension: 'mensuracao',
    weight: 1,
    options: [
      { value: 'sim', label: 'Sim', score: 1 },
      { value: 'nao', label: 'Não', score: 0 },
    ],
  },
  {
    id: 'com_taxa_valor',
    step: 'comercial',
    kind: 'number',
    title: 'Aproximadamente, quantos % dos seus leads viram clientes?',
    help: 'Usado na simulação de cenário. Se não souber, pule.',
    when: is('com_taxa', 'sim'),
    optional: true,
    min: 0,
    max: 100,
    placeholder: 'Ex.: 20',
  },

  // =========================================================================
  // 8 · ECONOMIA DA AQUISIÇÃO
  // =========================================================================
  {
    id: 'eco_ticket',
    step: 'economia',
    kind: 'number',
    title: 'Qual é o seu ticket médio?',
    help: 'Valor médio de uma venda, em reais.',
    placeholder: 'Ex.: 3500',
    min: 0,
    optional: true,
  },
  {
    id: 'eco_meta',
    step: 'economia',
    kind: 'number',
    title: 'Qual faturamento adicional você gostaria de gerar por mês?',
    placeholder: 'Ex.: 100000',
    min: 0,
    optional: true,
  },
  {
    id: 'eco_investimento',
    step: 'economia',
    kind: 'single',
    title: 'Quanto você pretende investir mensalmente em mídia?',
    dimension: 'escala',
    weight: 2,
    options: [
      { value: 'ate1k', label: 'Até R$ 1.000', score: 0.15 },
      { value: '1a3k', label: 'R$ 1.000 – R$ 3.000', score: 0.4 },
      { value: '3a5k', label: 'R$ 3.000 – R$ 5.000', score: 0.6 },
      { value: '5a10k', label: 'R$ 5.000 – R$ 10.000', score: 0.8 },
      { value: '10a30k', label: 'R$ 10.000 – R$ 30.000', score: 0.95 },
      { value: 'mais30k', label: 'Acima de R$ 30.000', score: 1 },
    ],
  },
  {
    id: 'eco_cac',
    step: 'economia',
    kind: 'single',
    title: 'Você sabe seu CAC (custo de aquisição de cliente)?',
    dimension: 'mensuracao',
    weight: 1,
    options: [
      { value: 'sim', label: 'Sim', score: 1 },
      { value: 'nao', label: 'Não', score: 0 },
    ],
  },
  {
    id: 'eco_cpl',
    step: 'economia',
    kind: 'single',
    title: 'Você sabe seu CPL (custo por lead)?',
    dimension: 'mensuracao',
    weight: 1,
    options: [
      { value: 'sim', label: 'Sim', score: 1 },
      { value: 'nao', label: 'Não', score: 0 },
    ],
  },

  // =========================================================================
  // 9 · EXPERIÊNCIA COM ADS
  // =========================================================================
  {
    id: 'ads_canais',
    step: 'ads',
    kind: 'multi',
    title: 'Sua empresa já anuncia?',
    help: 'Marque todos os canais em que já investiu.',
    dimension: 'ads',
    weight: 3,
    options: [
      { value: 'google', label: 'Google Ads' },
      { value: 'meta', label: 'Meta Ads' },
      { value: 'linkedin', label: 'LinkedIn Ads' },
      { value: 'tiktok', label: 'TikTok Ads' },
      { value: 'chatgpt', label: 'ChatGPT Ads' },
      { value: 'nenhum', label: 'Nunca anunciei' },
    ],
    scoreMulti: (v) => {
      if (v.includes('nenhum') || v.length === 0) return 0;
      return Math.min(1, 0.5 + v.filter((x) => x !== 'nenhum').length * 0.2);
    },
  },
  // Métricas só para quem já anuncia — lógica adaptativa do briefing.
  {
    id: 'ads_satisfacao',
    step: 'ads',
    kind: 'single',
    title: 'Você está satisfeito com os resultados atuais?',
    when: jaAnuncia,
    dimension: 'ads',
    weight: 2,
    options: [
      { value: 'sim', label: 'Sim, os resultados são consistentes.', score: 1 },
      { value: 'parcial', label: 'Parcialmente — funciona, mas oscila.', score: 0.6 },
      { value: 'nao', label: 'Não, os resultados ficam abaixo do esperado.', score: 0.25 },
      { value: 'naosei', label: 'Não consigo avaliar por falta de dados.', score: 0.1 },
    ],
  },
  {
    id: 'ads_investimento_atual',
    step: 'ads',
    kind: 'number',
    title: 'Quanto você investe por mês hoje, somando todos os canais?',
    help: 'Em reais. Pule se preferir não informar.',
    when: jaAnuncia,
    optional: true,
    min: 0,
    placeholder: 'Ex.: 8000',
  },
  {
    id: 'ads_leads_mes',
    step: 'ads',
    kind: 'number',
    title: 'Quantos leads por mês esse investimento gera?',
    when: jaAnuncia,
    optional: true,
    min: 0,
    placeholder: 'Ex.: 120',
  },
  {
    id: 'ads_metricas_dominio',
    step: 'ads',
    kind: 'single',
    title: 'Você conhece o CPL e o ROAS das suas campanhas?',
    when: jaAnuncia,
    dimension: 'ads',
    weight: 2,
    options: [
      { value: 'ambos', label: 'Sim, acompanho os dois.', score: 1 },
      { value: 'um', label: 'Acompanho um dos dois.', score: 0.55 },
      { value: 'nenhum', label: 'Não acompanho nenhum dos dois.', score: 0.1 },
    ],
  },

  // =========================================================================
  // 10 · PERFIL — blocos adaptativos por modelo de negócio
  // =========================================================================

  // --- E-commerce / Marketplace ---
  {
    id: 'ecom_checkout',
    step: 'perfil',
    kind: 'single',
    title: 'Como está a experiência de checkout da sua loja?',
    when: modelo('ecommerce', 'marketplace'),
    dimension: 'conversao',
    weight: 2,
    options: [
      { value: 'otimizado', label: 'Otimizado, poucos passos, testado.', score: 1 },
      { value: 'padrao', label: 'Padrão da plataforma, sem otimização.', score: 0.5 },
      { value: 'problemas', label: 'Tem problemas conhecidos.', score: 0.15 },
      { value: 'naosei', label: 'Não sei avaliar.', score: 0.1 },
    ],
  },
  {
    id: 'ecom_abandono',
    step: 'perfil',
    kind: 'single',
    title: 'Você trabalha recuperação de carrinho abandonado?',
    when: modelo('ecommerce', 'marketplace'),
    dimension: 'conversao',
    weight: 1,
    options: SIM_PARCIAL_NAO,
  },
  {
    id: 'ecom_catalogo',
    step: 'perfil',
    kind: 'single',
    title: 'Seu catálogo está estruturado com dados de produto completos?',
    help: 'Títulos, descrições, imagens, preço e disponibilidade — o que alimenta feeds e sistemas de IA.',
    when: modelo('ecommerce', 'marketplace'),
    dimension: 'discoverability',
    weight: 1,
    options: SIM_PARCIAL_NAO,
  },

  // --- B2B ---
  {
    id: 'b2b_ciclo',
    step: 'perfil',
    kind: 'single',
    title: 'Qual é o ciclo médio de vendas da sua empresa?',
    when: modelo('b2b', 'b2b2c'),
    dimension: 'comercial',
    weight: 1,
    options: [
      { value: 'curto', label: 'Menos de 30 dias', score: 1 },
      { value: 'medio', label: '30–90 dias', score: 0.75 },
      { value: 'longo', label: '90–180 dias', score: 0.5 },
      { value: 'muitolongo', label: 'Mais de 180 dias', score: 0.3 },
      { value: 'naosei', label: 'Não sei', score: 0.1 },
    ],
  },
  {
    id: 'b2b_decisores',
    step: 'perfil',
    kind: 'single',
    title: 'Quantas pessoas participam da decisão de compra?',
    when: modelo('b2b', 'b2b2c'),
    optional: true,
    options: [
      { value: '1', label: 'Uma' },
      { value: '2a3', label: 'Duas ou três' },
      { value: 'comite', label: 'Comitê / múltiplas áreas' },
      { value: 'naosei', label: 'Não sei' },
    ],
  },
  {
    id: 'b2b_qualificacao',
    step: 'perfil',
    kind: 'single',
    title: 'Existe um processo de qualificação de leads antes de passar para vendas?',
    when: modelo('b2b', 'b2b2c'),
    dimension: 'comercial',
    weight: 2,
    options: SIM_PARCIAL_NAO,
  },

  // --- SaaS ---
  {
    id: 'saas_entrada',
    step: 'perfil',
    kind: 'single',
    title: 'Qual é a porta de entrada do seu produto?',
    when: modelo('saas'),
    dimension: 'conversao',
    weight: 2,
    options: [
      { value: 'trial', label: 'Trial self-service', score: 1 },
      { value: 'demo', label: 'Demo agendada', score: 0.8 },
      { value: 'freemium', label: 'Plano gratuito', score: 0.9 },
      { value: 'contato', label: 'Só formulário de contato', score: 0.4 },
    ],
  },
  {
    id: 'saas_ltv',
    step: 'perfil',
    kind: 'single',
    title: 'Você conhece o LTV e o churn do seu produto?',
    when: modelo('saas'),
    dimension: 'mensuracao',
    weight: 2,
    options: [
      { value: 'ambos', label: 'Sim, acompanho os dois.', score: 1 },
      { value: 'um', label: 'Acompanho um dos dois.', score: 0.55 },
      { value: 'nenhum', label: 'Não acompanho.', score: 0.1 },
    ],
  },

  // --- Serviço / negócio local ---
  {
    id: 'local_atendimento',
    step: 'perfil',
    kind: 'multi',
    title: 'Por onde sua empresa atende hoje?',
    when: modelo('servico', 'b2c'),
    dimension: 'comercial',
    weight: 1,
    options: [
      { value: 'whatsapp', label: 'WhatsApp' },
      { value: 'telefone', label: 'Telefone' },
      { value: 'presencial', label: 'Presencial' },
      { value: 'agendamento', label: 'Agendamento online' },
      { value: 'email', label: 'E-mail' },
    ],
    scoreMulti: (v) => Math.min(1, v.length / 3),
  },
  {
    id: 'local_gmb',
    step: 'perfil',
    kind: 'single',
    title: 'Seu perfil no Google Empresas está completo e com avaliações recentes?',
    help: 'Perfis locais são uma das fontes externas mais consultadas por sistemas de IA.',
    when: modelo('servico', 'b2c'),
    dimension: 'discoverability',
    weight: 2,
    options: [
      { value: 'sim', label: 'Sim, completo e ativo.', score: 1 },
      { value: 'parcial', label: 'Existe, mas está desatualizado.', score: 0.45 },
      { value: 'nao', label: 'Não tenho.', score: 0 },
      { value: 'naosei', label: 'Não sei.', score: 0.1 },
    ],
  },
] as const;

/** Perguntas visíveis para o conjunto de respostas atual (lógica adaptativa). */
export function visibleQuestions(answers: Answers): Question[] {
  return QUESTIONS.filter((q) => !q.when || q.when(answers));
}

/** Etapas que têm ao menos uma pergunta visível — governa a barra de progresso. */
export function visibleSteps(answers: Answers): string[] {
  const visible = visibleQuestions(answers);
  const ids: string[] = ['identificacao'];
  for (const q of visible) if (!ids.includes(q.step)) ids.push(q.step);
  return ids;
}
