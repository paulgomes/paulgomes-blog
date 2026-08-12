/**
 * Ponto de entrada do diagnóstico: junta score, classificação, gargalos,
 * oportunidades, roadmap e os dois índices num único objeto.
 *
 * Puro e síncrono — a UI chama e renderiza; um endpoint pode chamar o mesmo
 * código para recalcular no servidor sem duplicar regra de negócio.
 */

import type { Answers, Diagnosis, SiteSignals } from './types';
import {
  classify,
  completude,
  opportunityIndex,
  scoreDimensions,
  simulateScenario,
  totalScore,
  wysLeadScore,
  wysTier,
} from './scoring';
import { bottlenecks, opportunities, roadmap } from './roadmap';

export function diagnose(answers: Answers, signals: SiteSignals | null): Diagnosis {
  const dimensions = scoreDimensions(answers, signals);
  const total = totalScore(dimensions);
  const hasSite = !!String(answers['site'] ?? '').trim();
  const wys = wysLeadScore(answers, dimensions, hasSite);

  return {
    total,
    classification: classify(total),
    dimensions,
    bottlenecks: bottlenecks(dimensions),
    opportunities: opportunities(answers, dimensions, signals),
    roadmap: roadmap(answers, dimensions, signals),
    opportunityIndex: opportunityIndex(answers, dimensions),
    scenario: simulateScenario(answers),
    wysLeadScore: wys,
    wysLeadTier: wysTier(wys),
    completude: completude(answers),
  };
}
