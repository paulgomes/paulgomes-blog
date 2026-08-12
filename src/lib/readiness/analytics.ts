/**
 * Eventos de analytics do diagnóstico.
 *
 * Empurra para `window.dataLayer` (GTM) e, se existir, para `gtag` direto.
 * Nenhuma das duas precisa estar presente: sem GTM/GA a função vira no-op
 * silenciosa, então a ferramenta funciona igual em ambiente sem tag.
 *
 * Nada de PII vai para o dataLayer — nome, e-mail e WhatsApp ficam apenas no
 * POST para o endpoint de lead.
 */

export type ReadinessEvent =
  | 'diagnostic_started'
  | 'company_identified'
  | 'website_submitted'
  | 'diagnosis_progress_25'
  | 'diagnosis_progress_50'
  | 'diagnosis_progress_75'
  | 'diagnosis_completed'
  | 'lead_form_started'
  | 'lead_submitted'
  | 'report_viewed'
  | 'wys_cta_clicked';

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

/** Eventos de progresso disparam uma única vez por sessão de diagnóstico. */
const fired = new Set<ReadinessEvent>();

export function track(event: ReadinessEvent, params: Record<string, unknown> = {}): void {
  if (typeof window === 'undefined') return;

  const once: ReadinessEvent[] = [
    'diagnostic_started',
    'diagnosis_progress_25',
    'diagnosis_progress_50',
    'diagnosis_progress_75',
    'diagnosis_completed',
    'lead_form_started',
    'report_viewed',
  ];
  if (once.includes(event)) {
    if (fired.has(event)) return;
    fired.add(event);
  }

  const payload = { event, tool: 'chatgpt_ads_readiness', ...params };

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(payload);

  if (typeof window.gtag === 'function') {
    window.gtag('event', event, { tool: 'chatgpt_ads_readiness', ...params });
  }
}

/** Dispara os marcos de 25/50/75% conforme o usuário avança. */
export function trackProgress(percent: number): void {
  if (percent >= 75) track('diagnosis_progress_75');
  else if (percent >= 50) track('diagnosis_progress_50');
  else if (percent >= 25) track('diagnosis_progress_25');
}
