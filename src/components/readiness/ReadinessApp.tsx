/**
 * ChatGPT Ads Readiness — orquestrador da experiência.
 *
 * Fases: landing → identificação → perguntas → análise → prévia + captura →
 * relatório completo.
 *
 * A ilha carrega com `client:load` porque a landing É a aplicação: renderizar
 * uma landing estática e só então hidratar causaria um salto visível no
 * primeiro clique, que é justamente o momento mais sensível do funil.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Answers, Identity, Question, SiteSignals } from '../../lib/readiness/types';
import { STEPS } from '../../lib/readiness/types';
import { visibleQuestions } from '../../lib/readiness/questions';
import { diagnose } from '../../lib/readiness/diagnose';
import { track, trackProgress } from '../../lib/readiness/analytics';
import { ProgressBar } from './Visuals';
import { CountInput, MoneyInput, PercentInput, UrlInput } from './MaskedInputs';
import { bracketLabel, COUNTRIES, DEFAULT_COUNTRY, getCountry, normalizeUrl, type Country } from '../../lib/readiness/locale';
import Report from './Report';

type Phase = 'landing' | 'identity' | 'questions' | 'analyzing' | 'report';

const MODELOS = [
  { value: 'b2b', label: 'B2B' },
  { value: 'b2c', label: 'B2C' },
  { value: 'b2b2c', label: 'B2B2C' },
  { value: 'saas', label: 'SaaS' },
  { value: 'ecommerce', label: 'E-commerce' },
  { value: 'marketplace', label: 'Marketplace' },
  { value: 'servico', label: 'Serviço profissional' },
  { value: 'outro', label: 'Outro' },
];

const EMPTY_IDENTITY: Identity = {
  empresa: '',
  site: '',
  segmento: '',
  local: '',
  pais: DEFAULT_COUNTRY,
  modelo: '',
};

export default function ReadinessApp() {
  const [phase, setPhase] = useState<Phase>('landing');
  const [identity, setIdentity] = useState<Identity>(EMPTY_IDENTITY);
  const [answers, setAnswers] = useState<Answers>({});
  const [index, setIndex] = useState(0);
  const [signals, setSignals] = useState<SiteSignals | null>(null);
  const [scanReason, setScanReason] = useState<string | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const headingRef = useRef<HTMLDivElement>(null);

  // A lista se recalcula a cada resposta — é isso que torna o fluxo adaptativo.
  const questions = useMemo(() => visibleQuestions(answers), [answers]);
  const current: Question | undefined = questions[index];
  const country = useMemo(() => getCountry(identity.pais), [identity.pais]);

  const diagnosis = useMemo(
    () => (phase === 'report' ? diagnose(answers, signals) : null),
    [phase, answers, signals]
  );

  // Move o foco para o topo da pergunta a cada avanço (teclado e leitor de tela).
  useEffect(() => {
    if (phase === 'questions') headingRef.current?.focus();
  }, [index, phase]);

  useEffect(() => {
    if (phase === 'questions' && questions.length > 0) {
      trackProgress(Math.round((index / questions.length) * 100));
    }
  }, [index, phase, questions.length]);

  const setAnswer = useCallback((id: string, value: Answers[string]) => {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  }, []);

  // --- navegação ------------------------------------------------------------

  const startDiagnostic = () => {
    track('diagnostic_started');
    setPhase('identity');
  };

  const submitIdentity = (e: React.FormEvent) => {
    e.preventDefault();
    track('company_identified', { modelo: identity.modelo, segmento: identity.segmento });
    if (identity.site.trim()) track('website_submitted');
    // O modelo entra em `answers` porque é o que dispara a lógica adaptativa.
    setAnswers((prev) => ({ ...prev, modelo: identity.modelo, site: identity.site }));
    setPhase('questions');
  };

  const isAnswered = (q: Question): boolean => {
    const v = answers[q.id];
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === 'number') return Number.isFinite(v);
    return v !== null && v !== undefined && String(v).trim() !== '';
  };

  const canAdvance = current ? current.optional === true || isAnswered(current) : false;

  const next = () => {
    if (index + 1 < questions.length) {
      setIndex((i) => i + 1);
    } else {
      runAnalysis();
    }
  };

  const back = () => {
    if (index > 0) setIndex((i) => i - 1);
    else setPhase('identity');
  };

  // --- análise do site ------------------------------------------------------

  const runAnalysis = async () => {
    setPhase('analyzing');
    // Normaliza aqui e não no envio: se o que a pessoa digitou não forma um host
    // plausível, o scanner receberia lixo e responderia com um erro genérico.
    const url = normalizeUrl(identity.site);

    if (!url) {
      setScanReason(
        identity.site.trim()
          ? 'O endereço informado não é um site válido.'
          : 'Nenhuma URL informada.'
      );
      finishAnalysis();
      return;
    }

    try {
      const res = await fetch('/api/readiness/site-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (data?.ok && data.signals) {
        setSignals(data.signals as SiteSignals);
        setScanReason(null);
      } else {
        setSignals(null);
        setScanReason(String(data?.reason || 'Não foi possível analisar o site.'));
      }
    } catch {
      setSignals(null);
      setScanReason('Não foi possível acessar o site a partir do servidor.');
    }
    finishAnalysis();
  };

  // Segura a tela de análise por um instante mesmo quando a resposta é rápida:
  // um diagnóstico que "termina" em 200ms parece que não analisou nada.
  const analysisStart = useRef(0);
  useEffect(() => {
    if (phase === 'analyzing') analysisStart.current = Date.now();
  }, [phase]);

  const finishAnalysis = () => {
    const elapsed = Date.now() - analysisStart.current;
    const wait = Math.max(0, 2200 - elapsed);
    setTimeout(() => {
      track('diagnosis_completed');
      setPhase('report');
      track('report_viewed');
    }, wait);
  };

  // =========================================================================
  // Render
  // =========================================================================

  if (phase === 'landing') return <Landing onStart={startDiagnostic} />;

  if (phase === 'identity') {
    return (
      <IdentityForm
        identity={identity}
        setIdentity={setIdentity}
        onSubmit={submitIdentity}
        onBack={() => setPhase('landing')}
      />
    );
  }

  if (phase === 'analyzing') return <Analyzing site={identity.site} />;

  if (phase === 'report' && diagnosis) {
    return (
      <Report
        diagnosis={diagnosis}
        identity={identity}
        answers={answers}
        signals={signals}
        scanReason={scanReason}
        unlocked={unlocked}
        onUnlock={() => setUnlocked(true)}
        country={country}
      />
    );
  }

  if (!current) return null;

  const stepLabel = STEPS.find((s) => s.id === current.step)?.title ?? '';

  return (
    <div className="rd-shell">
      <div className="rd-wizard">
        <ProgressBar current={index + 1} total={questions.length} stepLabel={stepLabel} />

        <div className="rd-question" key={current.id}>
          <div ref={headingRef} tabIndex={-1} className="rd-question-head">
            <h2 className="rd-question-title">{current.title}</h2>
            {current.help && <p className="rd-question-help">{current.help}</p>}
          </div>

          <QuestionInput
            question={current}
            value={answers[current.id]}
            onChange={setAnswer}
            onAdvance={next}
            country={country}
          />
        </div>

        <div className="rd-actions">
          <button type="button" className="rd-btn-ghost" onClick={back}>
            ← Voltar
          </button>
          <button type="button" className="rd-btn" onClick={next} disabled={!canAdvance}>
            {index + 1 === questions.length ? 'Concluir diagnóstico' : 'Continuar'}
          </button>
        </div>

        {current.optional && !isAnswered(current) && (
          <p className="rd-optional-note">Esta pergunta é opcional — você pode seguir sem responder.</p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Landing
// ---------------------------------------------------------------------------

function Landing({ onStart }: { onStart: () => void }) {
  return (
    <div className="rd-shell">
      <div className="rd-landing">
        <p className="rd-eyebrow">Ferramenta de diagnóstico · WYS</p>
        <h1 className="rd-landing-title">Sua empresa está pronta para anunciar no ChatGPT?</h1>
        <p className="rd-landing-sub">
          Faça um diagnóstico gratuito e descubra se sua estrutura comercial, digital e de mensuração está
          preparada para transformar tráfego vindo de IA em oportunidades reais de negócio.
        </p>

        <button type="button" className="rd-btn rd-btn-lg" onClick={onStart}>
          Começar diagnóstico
        </button>
        <p className="rd-microcopy">Leva aproximadamente 3 minutos. Sem compromisso.</p>

        <div className="rd-landing-grid">
          {[
            {
              t: 'AI Discoverability',
              d: 'Se sua marca tem sinais suficientes para ser encontrada e considerada por sistemas de IA.',
            },
            {
              t: 'Conversion Readiness',
              d: 'Se o seu site transforma a visita em oportunidade comercial — ou perde no caminho.',
            },
            {
              t: 'Measurement Readiness',
              d: 'Se você consegue distinguir o que gerou receita do que apenas gastou verba.',
            },
          ].map((c) => (
            <div className="rd-card" key={c.t}>
              <h3 className="rd-card-title">{c.t}</h3>
              <p className="rd-card-text">{c.d}</p>
            </div>
          ))}
        </div>

        <p className="rd-disclaimer">
          Este diagnóstico avalia <strong>preparação estratégica</strong> para aquisição via IA e mídia paga.
          Não determina aprovação de anúncios em nenhuma plataforma, não possui acesso a sistemas internos da
          OpenAI e não prevê resultado de campanha.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Identificação
// ---------------------------------------------------------------------------

interface IdentityProps {
  identity: Identity;
  setIdentity: (i: Identity) => void;
  onSubmit: (e: React.FormEvent) => void;
  onBack: () => void;
}

function IdentityForm({ identity, setIdentity, onSubmit, onBack }: IdentityProps) {
  const set = (k: keyof Identity) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setIdentity({ ...identity, [k]: e.target.value });

  const valid = identity.empresa.trim().length >= 2 && identity.modelo !== '';

  return (
    <div className="rd-shell">
      <form className="rd-wizard" onSubmit={onSubmit}>
        <p className="rd-eyebrow">Etapa 1 · Identificação</p>
        <h2 className="rd-question-title">Sobre a empresa</h2>
        <p className="rd-question-help">
          Se você informar o site, ele será analisado automaticamente para complementar o diagnóstico com
          dados observados.
        </p>

        <div className="rd-fields">
          <label className="rd-field">
            <span className="rd-field-label">Nome da empresa *</span>
            <input className="rd-input" value={identity.empresa} onChange={set('empresa')} required maxLength={140} />
          </label>

          <label className="rd-field">
            <span className="rd-field-label">Site</span>
            <UrlInput value={identity.site} onChange={(v) => setIdentity({ ...identity, site: v })} />
          </label>

          <label className="rd-field">
            <span className="rd-field-label">Segmento</span>
            <input
              className="rd-input"
              value={identity.segmento}
              onChange={set('segmento')}
              placeholder="Ex.: odontologia, indústria metalúrgica, software jurídico"
              maxLength={200}
            />
          </label>

          <div className="rd-field-pair">
            <label className="rd-field">
              <span className="rd-field-label">Cidade</span>
              <input
                className="rd-input"
                value={identity.local}
                onChange={set('local')}
                placeholder="Ex.: Sorocaba"
                maxLength={200}
              />
            </label>

            <label className="rd-field">
              <span className="rd-field-label">País</span>
              <select className="rd-input" value={identity.pais} onChange={set('pais')}>
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
                <option value="XX">Outro país</option>
              </select>
              <span className="rd-field-hint">
                Define a moeda ({getCountry(identity.pais).currency}) e o formato de telefone do diagnóstico.
              </span>
            </label>
          </div>

          <label className="rd-field">
            <span className="rd-field-label">Modelo de negócio *</span>
            <select className="rd-input" value={identity.modelo} onChange={set('modelo')} required>
              <option value="">Selecione…</option>
              {MODELOS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="rd-actions">
          <button type="button" className="rd-btn-ghost" onClick={onBack}>
            ← Voltar
          </button>
          <button type="submit" className="rd-btn" disabled={!valid}>
            Iniciar diagnóstico
          </button>
        </div>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Entrada de resposta
// ---------------------------------------------------------------------------

interface InputProps {
  question: Question;
  value: Answers[string];
  onChange: (id: string, value: Answers[string]) => void;
  onAdvance: () => void;
  country: Country;
}

/**
 * Campos numéricos que representam DINHEIRO ganham símbolo e separador da moeda
 * do país. Os demais (percentual, contagem) usam a máscara própria — um leads/mês
 * exibido como "R$ 120" seria pior do que campo cru.
 */
const MONEY_FIELDS = new Set(['eco_ticket', 'eco_meta', 'ads_investimento_atual']);
const PERCENT_FIELDS = new Set(['com_taxa_valor']);

function QuestionInput({ question, value, onChange, country }: InputProps) {
  if (question.kind === 'single') {
    return (
      <div className="rd-options" role="radiogroup" aria-label={question.title}>
        {question.options?.map((o) => {
          const selected = value === o.value;
          // Faixas de verba são escritas na moeda do país; o rótulo estático em
          // questions.ts está em BRL e serve só de fallback.
          const label = bracketLabel(o.value, country) ?? o.label;
          return (
            <button
              type="button"
              key={o.value}
              role="radio"
              aria-checked={selected}
              className={`rd-option ${selected ? 'is-selected' : ''}`}
              onClick={() => onChange(question.id, o.value)}
            >
              <span className="rd-option-mark" aria-hidden="true" />
              <span className="rd-option-body">
                <span className="rd-option-label">{label}</span>
                {o.hint && <span className="rd-option-hint">{o.hint}</span>}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  if (question.kind === 'multi') {
    const arr = Array.isArray(value) ? value : [];
    const toggle = (v: string) => {
      // Opções excludentes ("Nenhuma", "Nunca anunciei") limpam o resto.
      const exclusive = ['nenhuma', 'nenhum'];
      if (exclusive.includes(v)) {
        onChange(question.id, arr.includes(v) ? [] : [v]);
        return;
      }
      const cleaned = arr.filter((x) => !exclusive.includes(x));
      onChange(question.id, cleaned.includes(v) ? cleaned.filter((x) => x !== v) : [...cleaned, v]);
    };

    return (
      <div className="rd-options">
        {question.options?.map((o) => {
          const selected = arr.includes(o.value);
          return (
            <button
              type="button"
              key={o.value}
              aria-pressed={selected}
              className={`rd-option rd-option-multi ${selected ? 'is-selected' : ''}`}
              onClick={() => toggle(o.value)}
            >
              <span className="rd-option-box" aria-hidden="true" />
              <span className="rd-option-body">
                <span className="rd-option-label">{o.label}</span>
                {o.hint && <span className="rd-option-hint">{o.hint}</span>}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  if (question.kind === 'longtext') {
    return (
      <textarea
        className="rd-input rd-textarea"
        rows={5}
        value={String(value ?? '')}
        placeholder={question.placeholder}
        maxLength={2000}
        onChange={(e) => onChange(question.id, e.target.value)}
      />
    );
  }

  if (question.kind === 'number') {
    const num = typeof value === 'number' ? value : null;
    const set = (v: number | null) => onChange(question.id, v);

    if (MONEY_FIELDS.has(question.id)) {
      return <MoneyInput value={num} country={country} onChange={set} ariaLabel={question.title} />;
    }
    if (PERCENT_FIELDS.has(question.id)) {
      return <PercentInput value={num} onChange={set} placeholder="20" ariaLabel={question.title} />;
    }
    return (
      <CountInput
        value={num}
        country={country}
        onChange={set}
        placeholder={question.placeholder}
        ariaLabel={question.title}
      />
    );
  }

  return (
    <input
      className="rd-input"
      type="text"
      value={String(value ?? '')}
      placeholder={question.placeholder}
      maxLength={500}
      onChange={(e) => onChange(question.id, e.target.value)}
    />
  );
}

// ---------------------------------------------------------------------------
// Tela de análise
// ---------------------------------------------------------------------------

const ANALYSIS_STEPS = [
  'Consolidando respostas do diagnóstico',
  'Lendo sinais públicos do site informado',
  'Avaliando estrutura de conversão',
  'Calculando prontidão por dimensão',
  'Montando roadmap personalizado',
];

function Analyzing({ site }: { site: string }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setStep((s) => Math.min(s + 1, ANALYSIS_STEPS.length - 1)), 480);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="rd-shell">
      <div className="rd-analyzing">
        <div className="rd-pulse" aria-hidden="true" />
        <h2 className="rd-analyzing-title">Analisando</h2>
        <p className="rd-analyzing-sub">
          {site ? `Processando o diagnóstico e lendo ${site}` : 'Processando o diagnóstico'}
        </p>
        <ul className="rd-analyzing-list">
          {ANALYSIS_STEPS.map((s, i) => (
            <li key={s} className={i <= step ? 'is-done' : ''}>
              <span className="rd-analyzing-dot" aria-hidden="true" />
              {s}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
