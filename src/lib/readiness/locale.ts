/**
 * Localização do diagnóstico: país → moeda, formato numérico e telefone.
 *
 * A ferramenta é brasileira e o Brasil é o padrão, mas o público declarado
 * inclui empresas fora do país. Formatar euro com "R$" seria pior do que não
 * formatar nada — então a moeda acompanha o país informado, e o relatório
 * inteiro usa a mesma escolha.
 *
 * Sem dependências: `Intl` do próprio browser cuida de símbolo, separador e
 * posição. Manter uma tabela de símbolos à mão é o caminho curto para exibir
 * "R$1.000" para um argentino.
 */

export interface Country {
  /** ISO 3166-1 alpha-2. */
  code: string;
  name: string;
  /** ISO 4217. */
  currency: string;
  /** BCP-47, usado por Intl para separador decimal e de milhar. */
  locale: string;
  /** DDI sem o "+". */
  dial: string;
  /**
   * Máscara de telefone nacional. `#` = dígito. Quando há mais de um formato
   * (celular e fixo no Brasil), a máscara mais longa vence assim que o número
   * cresce — ver `formatPhone`.
   */
  phoneMasks: string[];
  /** Exemplo realista para o placeholder. Digitos gerados por algoritmo saem
   *  como "(91) 23456-7890", que nao se parece com telefone nenhum. */
  phoneExample: string;
}

/**
 * Lista curada, não exaustiva: os mercados plausíveis para uma agência
 * brasileira. Qualquer outro país cai em `INTERNATIONAL`, que aceita E.164 e
 * evita inventar um formato nacional que talvez não exista.
 */
export const COUNTRIES: readonly Country[] = [
  { code: 'BR', name: 'Brasil', currency: 'BRL', locale: 'pt-BR', dial: '55', phoneMasks: ['(##) ####-####', '(##) #####-####'], phoneExample: '(11) 91234-5678' },
  { code: 'PT', name: 'Portugal', currency: 'EUR', locale: 'pt-PT', dial: '351', phoneMasks: ['### ### ###'], phoneExample: '912 345 678' },
  { code: 'US', name: 'Estados Unidos', currency: 'USD', locale: 'en-US', dial: '1', phoneMasks: ['(###) ###-####'], phoneExample: '(415) 555-0123' },
  { code: 'AR', name: 'Argentina', currency: 'ARS', locale: 'es-AR', dial: '54', phoneMasks: ['(##) ####-####', '(###) ###-####'], phoneExample: '(11) 4321-5678' },
  { code: 'CL', name: 'Chile', currency: 'CLP', locale: 'es-CL', dial: '56', phoneMasks: ['# #### ####'], phoneExample: '9 6123 4567' },
  { code: 'CO', name: 'Colômbia', currency: 'COP', locale: 'es-CO', dial: '57', phoneMasks: ['### ### ####'], phoneExample: '320 123 4567' },
  { code: 'MX', name: 'México', currency: 'MXN', locale: 'es-MX', dial: '52', phoneMasks: ['## #### ####'], phoneExample: '55 1234 5678' },
  { code: 'PY', name: 'Paraguai', currency: 'PYG', locale: 'es-PY', dial: '595', phoneMasks: ['### ######'], phoneExample: '981 123456' },
  { code: 'UY', name: 'Uruguai', currency: 'UYU', locale: 'es-UY', dial: '598', phoneMasks: ['#### ####'], phoneExample: '9123 4567' },
  { code: 'ES', name: 'Espanha', currency: 'EUR', locale: 'es-ES', dial: '34', phoneMasks: ['### ### ###'], phoneExample: '612 345 678' },
  { code: 'GB', name: 'Reino Unido', currency: 'GBP', locale: 'en-GB', dial: '44', phoneMasks: ['##### ######'], phoneExample: '07700 123456' },
  { code: 'AO', name: 'Angola', currency: 'AOA', locale: 'pt-AO', dial: '244', phoneMasks: ['### ### ###'], phoneExample: '923 123 456' },
  { code: 'MZ', name: 'Moçambique', currency: 'MZN', locale: 'pt-MZ', dial: '258', phoneMasks: ['## ### ####'], phoneExample: '82 123 4567' },
] as const;

/** Fallback para país fora da lista: sem máscara nacional, E.164 puro. */
export const INTERNATIONAL: Country = {
  code: 'XX',
  name: 'Outro país',
  currency: 'USD',
  locale: 'en-US',
  dial: '',
  phoneMasks: [],
  phoneExample: '999 999 9999',
};

export const DEFAULT_COUNTRY = 'BR';

export function getCountry(code: string | undefined | null): Country {
  if (!code) return COUNTRIES.find((c) => c.code === DEFAULT_COUNTRY)!;
  return COUNTRIES.find((c) => c.code === code) ?? INTERNATIONAL;
}

// ---------------------------------------------------------------------------
// Dinheiro
// ---------------------------------------------------------------------------

/**
 * Formatador de moeda para o país. Sem casas decimais: os valores do
 * diagnóstico (ticket, meta, verba) são grandes e centavos só poluem.
 *
 * `Intl` erra para o lado seguro — se a runtime não conhecer a moeda, ela cai
 * no código ISO em vez de lançar.
 */
export function moneyFormatter(country: Country): Intl.NumberFormat {
  try {
    return new Intl.NumberFormat(country.locale, {
      style: 'currency',
      currency: country.currency,
      maximumFractionDigits: 0,
    });
  } catch {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  }
}

/** Formata um valor já numérico. Devolve string vazia para nulo/NaN. */
export function formatMoney(value: number | null | undefined, country: Country): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '';
  return moneyFormatter(country).format(value);
}

/** Só o símbolo (R$, €, US$…), para usar como prefixo visual do campo. */
export function currencySymbol(country: Country): string {
  const parts = moneyFormatter(country).formatToParts(0);
  return parts.find((p) => p.type === 'currency')?.value ?? country.currency;
}

/**
 * Agrupa milhares no padrão do país, SEM símbolo. É o que aparece enquanto a
 * pessoa digita: o símbolo fica fixo à esquerda do input, então repeti-lo no
 * texto faria o cursor pular.
 */
export function groupDigits(digits: string, country: Country): string {
  const clean = digits.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  if (!clean) return '';
  try {
    return new Intl.NumberFormat(country.locale, { maximumFractionDigits: 0 }).format(Number(clean));
  } catch {
    return clean;
  }
}

/** Extrai o número de um texto mascarado. */
export function parseMoney(text: string): number | null {
  const digits = String(text).replace(/\D/g, '');
  if (!digits) return null;
  const n = Number(digits);
  return Number.isFinite(n) ? n : null;
}

// ---------------------------------------------------------------------------
// Faixas de investimento
// ---------------------------------------------------------------------------

/**
 * Limites das faixas de verba, em unidades da moeda local.
 *
 * ATENÇÃO ao que isto é e ao que não é: as faixas são BANDAS ORDINAIS usadas
 * para pontuar capacidade relativa, e os mesmos números são reaproveitados em
 * qualquer moeda. Não há conversão cambial nem equivalência de poder de compra
 * — €3.000 e R$3.000 não são o mesmo investimento. Converter exigiria uma taxa
 * de câmbio ao vivo, e uma taxa desatualizada mentiria com mais convicção do
 * que a banda ordinal. Comparações de ticket/verba entre países precisam ser
 * normalizadas fora daqui.
 */
export const INVEST_BRACKETS: Record<string, { min: number | null; max: number | null }> = {
  ate1k: { min: null, max: 1000 },
  '1a3k': { min: 1000, max: 3000 },
  '3a5k': { min: 3000, max: 5000 },
  '5a10k': { min: 5000, max: 10000 },
  '10a30k': { min: 10000, max: 30000 },
  mais30k: { min: 30000, max: null },
};

/** Rótulo da faixa na moeda do país. `null` se o valor não for uma faixa. */
export function bracketLabel(value: string, country: Country): string | null {
  const b = INVEST_BRACKETS[value];
  if (!b) return null;
  const fmt = (n: number) => formatMoney(n, country);
  if (b.min === null && b.max !== null) return `Até ${fmt(b.max)}`;
  if (b.min !== null && b.max === null) return `Acima de ${fmt(b.min)}`;
  if (b.min !== null && b.max !== null) return `${fmt(b.min)} – ${fmt(b.max)}`;
  return null;
}

// ---------------------------------------------------------------------------
// Telefone
// ---------------------------------------------------------------------------

/**
 * Aplica a máscara nacional aos dígitos informados.
 *
 * Quando o país tem mais de um formato (Brasil: fixo com 10 dígitos, celular
 * com 11), escolhe a menor máscara que ainda comporta o que foi digitado —
 * assim o número se reformata sozinho no 11º dígito, sem obrigar o usuário a
 * declarar o tipo de linha.
 */
export function formatPhone(raw: string, country: Country): string {
  const digits = String(raw).replace(/\D/g, '');
  if (!digits) return '';

  if (country.phoneMasks.length === 0) {
    // Internacional: agrupa de 3 em 3 só para dar respiro à leitura.
    return digits.replace(/(\d{1,3})(?=(\d{3})+$)/g, '$1 ');
  }

  const capacity = (m: string) => (m.match(/#/g) || []).length;
  const ordered = [...country.phoneMasks].sort((a, b) => capacity(a) - capacity(b));
  const mask = ordered.find((m) => digits.length <= capacity(m)) ?? ordered[ordered.length - 1];
  const max = capacity(mask);
  const use = digits.slice(0, max);

  let out = '';
  let i = 0;
  for (const ch of mask) {
    if (i >= use.length) break;
    if (ch === '#') {
      out += use[i++];
    } else {
      out += ch;
    }
  }
  return out;
}

/** Quantidade de dígitos que a maior máscara do país comporta. */
export function phoneCapacity(country: Country): number {
  if (country.phoneMasks.length === 0) return 15; // E.164
  return Math.max(...country.phoneMasks.map((m) => (m.match(/#/g) || []).length));
}

/** Validação de sanidade — não pretende provar que a linha existe. */
export function isPhonePlausible(raw: string, country: Country): boolean {
  const digits = String(raw).replace(/\D/g, '');
  if (country.phoneMasks.length === 0) return digits.length >= 6 && digits.length <= 15;
  const sizes = country.phoneMasks.map((m) => (m.match(/#/g) || []).length);
  return sizes.includes(digits.length);
}

/** Número em E.164 (+DDI + dígitos) para gravar no CRM. */
export function toE164(raw: string, country: Country): string {
  const digits = String(raw).replace(/\D/g, '');
  if (!digits) return '';
  if (!country.dial) return `+${digits}`;
  return `+${country.dial}${digits}`;
}

/** Exemplo de preenchimento, usado como placeholder do campo. */
export function phonePlaceholder(country: Country): string {
  return country.phoneExample;
}

// ---------------------------------------------------------------------------
// URL
// ---------------------------------------------------------------------------

/**
 * Normaliza o que a pessoa digitou no campo de site. Aceita "empresa.com.br",
 * "www.empresa.com.br" e URL completa; devolve `null` quando não dá para
 * formar um host plausível — o campo é opcional, então o certo é não enviar
 * lixo ao scanner em vez de bloquear o avanço.
 */
export function normalizeUrl(raw: string): string | null {
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withScheme);
    if (!/\.[a-z]{2,}$/i.test(url.hostname)) return null;
    return url.toString();
  } catch {
    return null;
  }
}
