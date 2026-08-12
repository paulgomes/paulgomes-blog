/**
 * Relatório do diagnóstico.
 *
 * O gate de lead é deliberadamente honesto: o score, a classificação e o
 * primeiro gargalo aparecem ANTES do formulário. O usuário sabe o que já
 * recebeu e o que ganha ao continuar — sem contagem regressiva, sem score
 * borrado, sem "seu resultado expira". O briefing pede explicitamente para não
 * usar dark patterns, e um gate que esconde tudo seria um.
 */

import { useMemo, useState } from 'react';
import type { Answers, Diagnosis, Identity, SiteSignals } from '../../lib/readiness/types';
import { track } from '../../lib/readiness/analytics';
import {
  evidenceByDimension,
  executiveSummary,
  priorityActions,
  strategicAlerts,
  type Alert,
  type DimensionEvidence,
  type PriorityAction,
} from '../../lib/readiness/insights';
import { DimensionBar, ScoreRing } from './Visuals';

const WYS_URL = 'https://agenciawys.com.br/';
const PAUL_URL = 'https://paulgomes.com.br/';

interface Props {
  diagnosis: Diagnosis;
  identity: Identity;
  answers: Answers;
  signals: SiteSignals | null;
  scanReason: string | null;
  unlocked: boolean;
  onUnlock: () => void;
}

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

export default function Report({ diagnosis, identity, answers, signals, scanReason, unlocked, onUnlock }: Props) {
  const { total, classification, dimensions, bottlenecks, opportunities, roadmap, opportunityIndex, scenario } =
    diagnosis;

  // Derivações caras o suficiente para não repetir a cada render de input do gate.
  const summary = useMemo(
    () => executiveSummary(identity, answers, diagnosis, signals),
    [identity, answers, diagnosis, signals]
  );
  const alerts = useMemo(() => strategicAlerts(answers, diagnosis, signals), [answers, diagnosis, signals]);
  const evidence = useMemo(() => evidenceByDimension(answers, signals), [answers, signals]);
  const priority = useMemo(() => priorityActions(answers, diagnosis, signals), [answers, diagnosis, signals]);

  const evidenceFor = (id: string) => evidence.find((e) => e.dimension === id);

  const hoje = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

  return (
    <div className="rd-shell">
      <div className="rd-report">
        {/* Cabeçalho que só aparece na impressão — dá identidade ao PDF. */}
        <div className="rd-print-head" aria-hidden="true">
          <strong>ChatGPT Ads Readiness</strong>
          <span>
            {identity.empresa || '—'} · {hoje}
          </span>
        </div>
        {/* ---------------- Cabeçalho ---------------- */}
        <header className="rd-report-head">
          <p className="rd-eyebrow">ChatGPT Ads Readiness · {identity.empresa || 'Seu diagnóstico'}</p>
          <div className="rd-report-hero">
            <ScoreRing score={total} label={classification.label} caption="ChatGPT Ads Readiness Score" />
            <div className="rd-report-hero-text">
              <h2 className="rd-report-title">{classification.label}</h2>
              <p className="rd-report-message">{classification.message}</p>
              <div className="rd-chip-row">
                <span className="rd-chip">
                  AI Acquisition Opportunity <strong>{opportunityIndex}</strong>
                </span>
                <span className="rd-chip rd-chip-quiet">
                  Cobertura do diagnóstico <strong>{Math.round(diagnosis.completude * 100)}%</strong>
                </span>
              </div>
              <p className="rd-footnote">
                O AI Acquisition Opportunity é um indicador interno desta ferramenta: combina o porte da
                operação com a lacuna ainda aberta. Não representa potencial de faturamento.
              </p>
            </div>
          </div>
        </header>

        {/* ---------------- Leitura executiva ---------------- */}
        <section className="rd-section">
          <h3 className="rd-section-title">Leitura executiva</h3>
          <div className="rd-summary">
            {summary.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </section>

        {/* ---------------- Dimensões + evidência ---------------- */}
        <section className="rd-section">
          <h3 className="rd-section-title">Prontidão por dimensão</h3>
          <p className="rd-section-note">
            Cada nota abaixo é sustentada pelas suas próprias respostas. O que aparece marcado como
            <em> observado</em> veio da leitura automática do site, não do questionário.
          </p>
          <div className="rd-bars">
            {dimensions.map((d, i) => (
              <div key={d.id} className="rd-dim">
                <DimensionBar
                  label={d.label}
                  score={d.score}
                  weight={d.weight}
                  meaning={d.meaning}
                  delayMs={i * 70}
                />
                {unlocked && <EvidenceList data={evidenceFor(d.id)} />}
              </div>
            ))}
          </div>
        </section>

        {/* ---------------- Gargalo 1 (prévia) ---------------- */}
        {bottlenecks.length > 0 && (
          <section className="rd-section">
            <h3 className="rd-section-title">Principais gargalos</h3>
            <BottleneckCard item={bottlenecks[0]} />

            {!unlocked && bottlenecks.length > 1 && (
              <p className="rd-locked-note">
                Mais {bottlenecks.length - 1} gargalo{bottlenecks.length > 2 ? 's' : ''}, {opportunities.length}{' '}
                oportunidades e o roadmap de 90 dias fazem parte do relatório completo.
              </p>
            )}

            {unlocked && bottlenecks.slice(1).map((b) => <BottleneckCard key={b.rank} item={b} />)}
          </section>
        )}

        {/* ---------------- Gate ---------------- */}
        {!unlocked && <LeadGate identity={identity} answers={answers} diagnosis={diagnosis} signals={signals} onUnlock={onUnlock} />}

        {/* ---------------- Conteúdo completo ---------------- */}
        {unlocked && (
          <>
            {alerts.length > 0 && (
              <section className="rd-section">
                <h3 className="rd-section-title">Alertas estratégicos</h3>
                <p className="rd-section-note">
                  Pontos que só aparecem no cruzamento das respostas: cada item isolado pode parecer aceitável,
                  mas a combinação compromete o resultado.
                </p>
                <div className="rd-alerts">
                  {alerts.map((a) => (
                    <AlertCard key={a.title} alert={a} />
                  ))}
                </div>
              </section>
            )}

            {priority.length > 0 && (
              <section className="rd-section">
                <h3 className="rd-section-title">Plano priorizado</h3>
                <p className="rd-section-note">
                  Ordenado por retorno prático — impacto alto e esforço baixo primeiro.
                </p>
                <div className="rd-priority">
                  {priority.map((p, i) => (
                    <PriorityRow key={p.action} item={p} rank={i + 1} />
                  ))}
                </div>
              </section>
            )}

            <section className="rd-section">
              <h3 className="rd-section-title">Oportunidades identificadas</h3>
              <div className="rd-opps">
                {opportunities.map((o, i) => (
                  <article className="rd-opp" key={o.title}>
                    <span className="rd-opp-num">{String(i + 1).padStart(2, '0')}</span>
                    <div>
                      <h4 className="rd-opp-title">{o.title}</h4>
                      <p className="rd-opp-text">{o.detail}</p>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <SiteSection signals={signals} scanReason={scanReason} />

            <ScenarioSection scenario={scenario} />

            <section className="rd-section">
              <h3 className="rd-section-title">Roadmap sugerido</h3>
              <div className="rd-roadmap">
                {roadmap.map((p) => (
                  <div className="rd-phase" key={p.window}>
                    <h4 className="rd-phase-title">{p.label}</h4>
                    <ul className="rd-phase-list">
                      {p.items.map((it) => (
                        <li key={it}>{it}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>

            <PrintBar empresa={identity.empresa} />
            <FinalCta />
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function EvidenceList({ data }: { data?: DimensionEvidence }) {
  if (!data || (data.strengths.length === 0 && data.gaps.length === 0)) return null;

  return (
    <div className="rd-evidence">
      {data.gaps.length > 0 && (
        <div className="rd-evidence-col">
          <span className="rd-evidence-head is-gap">O que puxa para baixo</span>
          <ul>
            {data.gaps.slice(0, 4).map((e) => (
              <li key={e.label}>
                <span className="rd-evidence-label">{e.label}</span>
                <span className="rd-evidence-answer">{e.answer}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {data.strengths.length > 0 && (
        <div className="rd-evidence-col">
          <span className="rd-evidence-head is-strength">O que sustenta</span>
          <ul>
            {data.strengths.slice(0, 4).map((e) => (
              <li key={e.label}>
                <span className="rd-evidence-label">{e.label}</span>
                <span className="rd-evidence-answer">{e.answer}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function AlertCard({ alert }: { alert: Alert }) {
  return (
    <article className={`rd-alert is-${alert.severity}`}>
      <span className="rd-alert-tag">{alert.severity === 'critico' ? 'Crítico' : 'Atenção'}</span>
      <h4 className="rd-alert-title">{alert.title}</h4>
      <p className="rd-alert-text">{alert.detail}</p>
    </article>
  );
}

function PriorityRow({ item, rank }: { item: PriorityAction; rank: number }) {
  return (
    <article className="rd-priority-row">
      <span className="rd-priority-rank">{String(rank).padStart(2, '0')}</span>
      <div className="rd-priority-body">
        <h4 className="rd-priority-title">{item.action}</h4>
        <p className="rd-priority-text">{item.rationale}</p>
      </div>
      <div className="rd-priority-tags">
        <span className={`rd-tag rd-impact-${item.impact}`}>Impacto {item.impact}</span>
        <span className={`rd-tag rd-effort-${item.effort}`}>Esforço {item.effort}</span>
      </div>
    </article>
  );
}

/** Impressão via diálogo nativo — cobre "salvar como PDF" sem embarcar uma lib. */
function PrintBar({ empresa }: { empresa: string }) {
  const print = () => {
    track('wys_cta_clicked', { where: 'print' });
    window.print();
  };

  return (
    <section className="rd-printbar">
      <div>
        <h4 className="rd-printbar-title">Levar este diagnóstico adiante</h4>
        <p className="rd-printbar-text">
          Imprima ou salve como PDF para compartilhar com sua equipe
          {empresa ? ` da ${empresa}` : ''}. No diálogo de impressão, escolha “Salvar como PDF”.
        </p>
      </div>
      <button type="button" className="rd-btn rd-btn-outline" onClick={print}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="6 9 6 2 18 2 18 9" />
          <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
          <rect x="6" y="14" width="12" height="8" />
        </svg>
        Imprimir / Salvar PDF
      </button>
    </section>
  );
}

// ---------------------------------------------------------------------------

function BottleneckCard({ item }: { item: Diagnosis['bottlenecks'][number] }) {
  return (
    <article className="rd-bottleneck">
      <span className="rd-bottleneck-num">{String(item.rank).padStart(2, '0')}</span>
      <div>
        <h4 className="rd-bottleneck-title">{item.label}</h4>
        <p className="rd-bottleneck-text">{item.message}</p>
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Dados observados no site — separados das recomendações, por princípio.
// ---------------------------------------------------------------------------

function SiteSection({ signals, scanReason }: { signals: SiteSignals | null; scanReason: string | null }) {
  if (!signals) {
    return (
      <section className="rd-section">
        <h3 className="rd-section-title">Dados observados no site</h3>
        <p className="rd-empty">
          {scanReason
            ? `Não foi possível analisar o site automaticamente: ${scanReason}`
            : 'Nenhum site foi informado, então esta seção ficou sem dados observados.'}{' '}
          As demais seções usam apenas as suas respostas.
        </p>
      </section>
    );
  }

  const rows: Array<{ label: string; value: string; ok: boolean }> = [
    { label: 'Título da página', value: signals.title || 'não encontrado', ok: !!signals.title },
    {
      label: 'Meta description',
      value: signals.metaDescription ? `${signals.metaDescription.length} caracteres` : 'não encontrada',
      ok: !!signals.metaDescription,
    },
    { label: 'H1', value: signals.h1.length ? signals.h1[0] : 'não encontrado', ok: signals.h1.length > 0 },
    { label: 'Subtítulos (H2)', value: String(signals.h2Count), ok: signals.h2Count >= 2 },
    { label: 'Formulário', value: signals.hasForm ? 'encontrado' : 'não encontrado', ok: signals.hasForm },
    {
      label: 'WhatsApp',
      value: signals.hasWhatsAppLink ? 'encontrado' : 'não encontrado',
      ok: signals.hasWhatsAppLink,
    },
    { label: 'Telefone clicável', value: signals.hasTelLink ? 'encontrado' : 'não encontrado', ok: signals.hasTelLink },
    {
      label: 'Dados estruturados',
      value: signals.hasSchemaOrg ? signals.schemaTypes.join(', ') : 'não encontrados',
      ok: signals.hasSchemaOrg,
    },
    { label: 'Open Graph', value: signals.hasOpenGraph ? 'presente' : 'ausente', ok: signals.hasOpenGraph },
    { label: 'Canonical', value: signals.hasCanonical ? 'presente' : 'ausente', ok: signals.hasCanonical },
    { label: 'Meta viewport', value: signals.hasViewportMeta ? 'presente' : 'ausente', ok: signals.hasViewportMeta },
    {
      label: 'Imagens sem alt',
      value: `${signals.imgWithoutAlt} de ${signals.imgCount}`,
      ok: signals.imgCount === 0 || signals.imgWithoutAlt / signals.imgCount < 0.3,
    },
    {
      label: 'Termos de conversão',
      value: signals.ctaTerms.length ? signals.ctaTerms.slice(0, 5).join(', ') : 'nenhum encontrado',
      ok: signals.ctaTerms.length > 0,
    },
    {
      label: 'Sinais de confiança',
      value: signals.trustSignals.length ? signals.trustSignals.slice(0, 5).join(', ') : 'nenhum encontrado',
      ok: signals.trustSignals.length > 0,
    },
  ];

  return (
    <section className="rd-section">
      <h3 className="rd-section-title">Dados observados no site</h3>
      <p className="rd-section-note">
        Leitura automática de <code>{signals.finalUrl}</code>. São fatos extraídos do HTML público — não
        interpretações. As recomendações aparecem nas seções de oportunidades e roadmap.
      </p>
      <div className="rd-obs">
        {rows.map((r) => (
          <div className="rd-obs-row" key={r.label}>
            <span className={`rd-obs-flag ${r.ok ? 'is-ok' : 'is-off'}`} aria-hidden="true" />
            <span className="rd-obs-label">{r.label}</span>
            <span className="rd-obs-value">{r.value}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

function ScenarioSection({ scenario }: { scenario: Diagnosis['scenario'] }) {
  const { vendasNecessarias, leadsNecessarios, ticketMedio, faturamentoDesejado, taxaFechamento } = scenario;
  if (!vendasNecessarias && !leadsNecessarios) return null;

  return (
    <section className="rd-section">
      <h3 className="rd-section-title">Simulação de cenário</h3>
      <p className="rd-section-note">
        Aritmética simples a partir do que você informou. É uma simulação para dimensionar esforço — não é
        previsão, projeção de resultado nem garantia.
      </p>
      <div className="rd-scenario">
        {faturamentoDesejado !== null && ticketMedio !== null && (
          <div className="rd-scenario-item">
            <span className="rd-scenario-label">Meta ÷ ticket médio</span>
            <span className="rd-scenario-value">
              {BRL.format(faturamentoDesejado)} ÷ {BRL.format(ticketMedio)}
            </span>
          </div>
        )}
        {vendasNecessarias !== null && (
          <div className="rd-scenario-item is-highlight">
            <span className="rd-scenario-label">Vendas necessárias por mês</span>
            <span className="rd-scenario-value">{vendasNecessarias}</span>
          </div>
        )}
        {leadsNecessarios !== null ? (
          <div className="rd-scenario-item is-highlight">
            <span className="rd-scenario-label">
              Leads necessários {taxaFechamento ? `(a ${Math.round(taxaFechamento * 100)}% de fechamento)` : ''}
            </span>
            <span className="rd-scenario-value">{leadsNecessarios}</span>
          </div>
        ) : (
          <p className="rd-empty">
            Para estimar o volume de leads necessário, seria preciso a sua taxa de conversão de lead para
            cliente. Sem esse dado, não estimamos — um número inventado aqui distorceria todo o planejamento.
          </p>
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Captura
// ---------------------------------------------------------------------------

interface GateProps {
  identity: Identity;
  answers: Answers;
  diagnosis: Diagnosis;
  signals: SiteSignals | null;
  onUnlock: () => void;
}

function LeadGate({ identity, answers, diagnosis, signals, onUnlock }: GateProps) {
  const [form, setForm] = useState({ nome: '', email: '', whatsapp: '', empresa: identity.empresa, website: '' });
  const [status, setStatus] = useState<'idle' | 'sending' | 'error'>('idle');
  const [error, setError] = useState('');
  const [touched, setTouched] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!touched) {
      setTouched(true);
      track('lead_form_started');
    }
    setForm({ ...form, [k]: e.target.value });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('sending');
    setError('');

    try {
      const res = await fetch('/api/readiness/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, identity, answers, diagnosis, siteSignals: signals }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setStatus('error');
        setError(data?.error || 'Não consegui registrar agora. Tente novamente.');
        return;
      }

      track('lead_submitted', {
        readiness_score: diagnosis.total,
        readiness_band: diagnosis.classification.band,
      });
      onUnlock();
    } catch {
      setStatus('error');
      setError('Falha de conexão. Verifique sua internet e tente novamente.');
    }
  };

  return (
    <section className="rd-gate">
      <h3 className="rd-gate-title">Seu diagnóstico está pronto</h3>
      <p className="rd-gate-text">
        Informe seus dados para receber seu relatório completo, com todos os gargalos, as oportunidades
        identificadas e o roadmap de 90 dias.
      </p>

      <form className="rd-gate-form" onSubmit={submit}>
        {/* Honeypot: invisível para humanos, irresistível para bots. */}
        <input
          type="text"
          name="website"
          value={form.website}
          onChange={set('website')}
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          className="rd-honeypot"
        />

        <div className="rd-fields rd-fields-2">
          <label className="rd-field">
            <span className="rd-field-label">Nome *</span>
            <input className="rd-input" value={form.nome} onChange={set('nome')} required maxLength={100} />
          </label>
          <label className="rd-field">
            <span className="rd-field-label">Empresa *</span>
            <input className="rd-input" value={form.empresa} onChange={set('empresa')} required maxLength={140} />
          </label>
          <label className="rd-field">
            <span className="rd-field-label">E-mail *</span>
            <input
              className="rd-input"
              type="email"
              value={form.email}
              onChange={set('email')}
              required
              maxLength={254}
            />
          </label>
          <label className="rd-field">
            <span className="rd-field-label">WhatsApp *</span>
            <input
              className="rd-input"
              type="tel"
              value={form.whatsapp}
              onChange={set('whatsapp')}
              required
              placeholder="(11) 90000-0000"
              maxLength={25}
            />
          </label>
        </div>

        {status === 'error' && <p className="rd-error">{error}</p>}

        <button type="submit" className="rd-btn rd-btn-lg" disabled={status === 'sending'}>
          {status === 'sending' ? 'Enviando…' : 'Ver relatório completo'}
        </button>
        <p className="rd-microcopy">
          Usamos seus dados apenas para enviar este diagnóstico e eventual contato da WYS. Sem spam.
        </p>
      </form>
    </section>
  );
}

// ---------------------------------------------------------------------------

function FinalCta() {
  const onClick = (where: string) => () => track('wys_cta_clicked', { where });

  return (
    <>
      <section className="rd-cta">
        <h3 className="rd-cta-title">Seu próximo passo</h3>
        <p className="rd-cta-text">
          Seu diagnóstico identificou oportunidades que podem ser transformadas em uma estratégia de aquisição.
          A WYS pode ajudar sua empresa a estruturar:
        </p>
        <ul className="rd-cta-list">
          {['Estratégia de Ads', 'ChatGPT Ads', 'Google Ads', 'Tracking', 'Landing pages', 'CRO', 'SEO', 'GEO', 'AEO', 'Aquisição através de IA'].map(
            (s) => (
              <li key={s}>{s}</li>
            )
          )}
        </ul>
        <a className="rd-btn rd-btn-lg" href={WYS_URL} target="_blank" rel="noopener noreferrer" onClick={onClick('primary')}>
          Falar com a WYS
        </a>
      </section>

      <section className="rd-authority">
        <h4 className="rd-authority-title">Seu diagnóstico pode ser aprofundado por um especialista</h4>
        <p className="rd-authority-text">
          Paul Gomes, fundador da WYS, atua na interseção entre estratégia de marca, marketing, tecnologia,
          mídia e inteligência artificial.
        </p>
        <a className="rd-link" href={PAUL_URL} target="_blank" rel="noopener noreferrer" onClick={onClick('authority')}>
          paulgomes.com.br
        </a>
      </section>

      <section className="rd-cta rd-cta-alt">
        <h3 className="rd-cta-title">Quer transformar este diagnóstico em um plano de aquisição?</h3>
        <p className="rd-cta-text">
          Fale com a WYS e receba uma avaliação estratégica dos principais pontos identificados no seu
          diagnóstico.
        </p>
        <a className="rd-btn rd-btn-lg" href={WYS_URL} target="_blank" rel="noopener noreferrer" onClick={onClick('alt')}>
          Quero falar com um especialista
        </a>
      </section>
    </>
  );
}
