/**
 * Relatório do diagnóstico.
 *
 * O gate de lead é deliberadamente honesto: o score, a classificação e o
 * primeiro gargalo aparecem ANTES do formulário. O usuário sabe o que já
 * recebeu e o que ganha ao continuar — sem contagem regressiva, sem score
 * borrado, sem "seu resultado expira". O briefing pede explicitamente para não
 * usar dark patterns, e um gate que esconde tudo seria um.
 */

import { useState } from 'react';
import type { Answers, Diagnosis, Identity, SiteSignals } from '../../lib/readiness/types';
import { track } from '../../lib/readiness/analytics';
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

  return (
    <div className="rd-shell">
      <div className="rd-report">
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

        {/* ---------------- Dimensões ---------------- */}
        <section className="rd-section">
          <h3 className="rd-section-title">Prontidão por dimensão</h3>
          <div className="rd-bars">
            {dimensions.map((d, i) => (
              <DimensionBar
                key={d.id}
                label={d.label}
                score={d.score}
                weight={d.weight}
                meaning={d.meaning}
                delayMs={i * 70}
              />
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

            <FinalCta />
          </>
        )}
      </div>
    </div>
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
