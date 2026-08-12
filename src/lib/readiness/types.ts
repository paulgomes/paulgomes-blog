/**
 * ChatGPT Ads Readiness — modelo de dados.
 *
 * Toda a lógica do diagnóstico (perguntas, score, roadmap) é pura e vive em
 * `src/lib/readiness/`. A ilha React só orquestra estado e renderiza. Isso
 * mantém o algoritmo testável sem DOM e permite reaproveitá-lo depois num
 * endpoint/CRM sem reescrever nada.
 */

// ---------------------------------------------------------------------------
// Dimensões do score
// ---------------------------------------------------------------------------

export type DimensionId =
  | 'oferta'
  | 'conversao'
  | 'mensuracao'
  | 'comercial'
  | 'ads'
  | 'discoverability'
  | 'escala';

export interface Dimension {
  id: DimensionId;
  label: string;
  /** Peso no score final. A soma de todos é exatamente 100. */
  weight: number;
  /** Frase curta usada no relatório para explicar o que a dimensão mede. */
  meaning: string;
}

/**
 * Pesos definidos no briefing do produto. A soma é validada em tempo de
 * execução por `assertWeights()` em scoring.ts — se alguém mexer aqui e a soma
 * deixar de dar 100, o teste quebra antes de ir pro ar.
 */
export const DIMENSIONS: readonly Dimension[] = [
  {
    id: 'discoverability',
    label: 'AI Discoverability',
    weight: 20,
    meaning: 'Quanto sua marca é encontrável e compreensível por sistemas de IA.',
  },
  {
    id: 'oferta',
    label: 'Oferta e posicionamento',
    weight: 15,
    meaning: 'Clareza do que você vende e por que alguém escolheria você.',
  },
  {
    id: 'conversao',
    label: 'Conversão e site',
    weight: 15,
    meaning: 'Capacidade do seu site de transformar visita em oportunidade.',
  },
  {
    id: 'mensuracao',
    label: 'Mensuração',
    weight: 15,
    meaning: 'Se você consegue saber o que funcionou e o que desperdiçou verba.',
  },
  {
    id: 'escala',
    label: 'Capacidade de escala',
    weight: 15,
    meaning: 'Se a operação aguenta o volume que a mídia pode gerar.',
  },
  {
    id: 'comercial',
    label: 'Estrutura comercial',
    weight: 10,
    meaning: 'Velocidade e consistência do time no atendimento ao lead.',
  },
  {
    id: 'ads',
    label: 'Maturidade de Ads',
    weight: 10,
    meaning: 'Experiência acumulada em mídia paga e domínio das próprias métricas.',
  },
] as const;

// ---------------------------------------------------------------------------
// Perguntas
// ---------------------------------------------------------------------------

export type BusinessModel =
  | 'b2b'
  | 'b2c'
  | 'b2b2c'
  | 'saas'
  | 'ecommerce'
  | 'marketplace'
  | 'servico'
  | 'outro';

export type QuestionKind = 'single' | 'multi' | 'text' | 'longtext' | 'number' | 'url';

export interface Option {
  value: string;
  label: string;
  /**
   * Contribuição da opção, de 0 a 1. Ausente = não pontua (pergunta apenas
   * informativa, usada para ramificação ou para o relatório).
   */
  score?: number;
  /** Texto auxiliar exibido abaixo do rótulo. */
  hint?: string;
}

export interface Question {
  id: string;
  /** Etapa do diagnóstico a que pertence (governa a barra de progresso). */
  step: StepId;
  kind: QuestionKind;
  title: string;
  help?: string;
  placeholder?: string;
  options?: Option[];
  /** Dimensão pontuada. Ausente = pergunta informativa. */
  dimension?: DimensionId;
  /** Peso relativo DENTRO da dimensão. Default 1. */
  weight?: number;
  /** Pergunta opcional não bloqueia o avanço. */
  optional?: boolean;
  /** Lógica adaptativa: só aparece quando o predicado é verdadeiro. */
  when?: (a: Answers) => boolean;
  /** Para `multi`: pontuação derivada da quantidade/qualidade das escolhas. */
  scoreMulti?: (values: string[]) => number;
  /** Para `number`: limites de sanidade da entrada. */
  min?: number;
  max?: number;
}

export type StepId =
  | 'identificacao'
  | 'objetivo'
  | 'oferta'
  | 'ia'
  | 'site'
  | 'tracking'
  | 'comercial'
  | 'economia'
  | 'ads'
  | 'perfil';

export interface Step {
  id: StepId;
  label: string;
  /** Título mostrado no cabeçalho do wizard. */
  title: string;
}

export const STEPS: readonly Step[] = [
  { id: 'identificacao', label: 'Identificação', title: 'Sobre a empresa' },
  { id: 'objetivo', label: 'Objetivo', title: 'O que você quer alcançar' },
  { id: 'oferta', label: 'Oferta', title: 'O que você vende' },
  { id: 'ia', label: 'Maturidade de IA', title: 'Sua marca diante da IA' },
  { id: 'site', label: 'Site', title: 'Site e conversão' },
  { id: 'tracking', label: 'Mensuração', title: 'O que você consegue medir' },
  { id: 'comercial', label: 'Comercial', title: 'Capacidade de atendimento' },
  { id: 'economia', label: 'Economia', title: 'Economia da aquisição' },
  { id: 'ads', label: 'Mídia', title: 'Experiência com anúncios' },
  { id: 'perfil', label: 'Perfil', title: 'Detalhes do seu modelo' },
] as const;

// ---------------------------------------------------------------------------
// Respostas
// ---------------------------------------------------------------------------

/** Valor bruto de uma resposta. `string[]` só em perguntas `multi`. */
export type AnswerValue = string | string[] | number | null;

export type Answers = Record<string, AnswerValue>;

export interface Identity {
  empresa: string;
  site: string;
  segmento: string;
  local: string;
  modelo: BusinessModel | '';
}

// ---------------------------------------------------------------------------
// Análise de site (endpoint /api/readiness/site-scan)
// ---------------------------------------------------------------------------

/**
 * Sinais OBSERVADOS no site. Tudo aqui vem de leitura real do HTML — nada é
 * inferido. O relatório separa isso das recomendações justamente para nunca
 * apresentar suposição como fato.
 */
export interface SiteSignals {
  url: string;
  finalUrl: string;
  status: number;
  title: string | null;
  metaDescription: string | null;
  h1: string[];
  h2Count: number;
  hasForm: boolean;
  hasWhatsAppLink: boolean;
  hasTelLink: boolean;
  hasMailtoLink: boolean;
  hasSchemaOrg: boolean;
  schemaTypes: string[];
  hasViewportMeta: boolean;
  hasOpenGraph: boolean;
  hasCanonical: boolean;
  htmlBytes: number;
  imgCount: number;
  imgWithoutAlt: number;
  /** Termos de prova social encontrados no texto visível. */
  trustSignals: string[];
  /** Termos de conversão encontrados em botões/links. */
  ctaTerms: string[];
  langAttr: string | null;
}

export type SiteScanResult =
  | { ok: true; signals: SiteSignals }
  | { ok: false; reason: string };

// ---------------------------------------------------------------------------
// Resultado do diagnóstico
// ---------------------------------------------------------------------------

export interface DimensionScore {
  id: DimensionId;
  label: string;
  /** 0-100. */
  score: number;
  weight: number;
  /** Quantas perguntas pontuadas foram efetivamente respondidas. */
  answered: number;
  meaning: string;
}

export type ReadinessBand = 'baixa' | 'desenvolvimento' | 'ajustes' | 'alta';

export interface Classification {
  band: ReadinessBand;
  label: string;
  message: string;
}

export interface Bottleneck {
  rank: number;
  dimension: DimensionId;
  label: string;
  message: string;
}

export interface Opportunity {
  title: string;
  detail: string;
}

export interface RoadmapPhase {
  window: '0-30' | '30-60' | '60-90';
  label: string;
  items: string[];
}

export interface ScenarioSimulation {
  /** Nulo quando o usuário não informou dados suficientes. */
  vendasNecessarias: number | null;
  leadsNecessarios: number | null;
  ticketMedio: number | null;
  faturamentoDesejado: number | null;
  investimentoMensal: number | null;
  /** Taxa de fechamento assumida (0-1) e sua origem. */
  taxaFechamento: number | null;
  taxaFechamentoOrigem: 'informada' | 'estimada' | null;
}

export interface Diagnosis {
  total: number;
  classification: Classification;
  dimensions: DimensionScore[];
  bottlenecks: Bottleneck[];
  opportunities: Opportunity[];
  roadmap: RoadmapPhase[];
  opportunityIndex: number;
  scenario: ScenarioSimulation;
  /** Score interno de qualificação comercial. Não é exibido ao usuário. */
  wysLeadScore: number;
  wysLeadTier: 'baixa' | 'oportunidade' | 'qualificado' | 'altamente-qualificado';
  /** Cobertura do diagnóstico: fração de perguntas pontuadas respondidas. */
  completude: number;
}

export interface LeadPayload {
  nome: string;
  email: string;
  whatsapp: string;
  empresa: string;
  /** Honeypot — precisa chegar vazio. */
  website?: string;
  identity: Identity;
  answers: Answers;
  diagnosis: Diagnosis;
  siteSignals: SiteSignals | null;
}
