/**
 * Peças visuais do relatório — SVG puro, sem biblioteca de gráficos.
 *
 * Motivo de não usar Recharts/Chart.js: são ~50-100 KB de JS para desenhar um
 * anel e sete barras. Numa ferramenta de topo de funil, esse peso custa
 * conversão. Tudo aqui é SVG estático + CSS, e herda os tokens de cor do site
 * (`--color-accent`, `--color-ink`…), então funciona em dark mode sem trabalho
 * extra.
 */

import { useEffect, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// Contador que anima de 0 até o valor final
// ---------------------------------------------------------------------------

function useCountUp(target: number, durationMs = 1100): number {
  const [value, setValue] = useState(0);
  const raf = useRef<number>(0);

  useEffect(() => {
    // Respeita quem pediu menos movimento: mostra o número final direto.
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      setValue(target);
      return;
    }

    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      // easeOutCubic — desacelera no fim, dá sensação de "assentar".
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(target * eased));
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, durationMs]);

  return value;
}

// ---------------------------------------------------------------------------
// Score circular
// ---------------------------------------------------------------------------

interface ScoreRingProps {
  score: number;
  label: string;
  size?: number;
  caption?: string;
}

export function ScoreRing({ score, label, size = 220, caption }: ScoreRingProps) {
  const animated = useCountUp(score);
  const stroke = size * 0.055;
  const radius = (size - stroke * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - animated / 100);

  return (
    <div className="rd-ring" style={{ width: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${label}: ${score} de 100`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 60ms linear' }}
        />
      </svg>
      <div className="rd-ring-center">
        <div className="rd-ring-value">
          {animated}
          <span className="rd-ring-max">/100</span>
        </div>
        <div className="rd-ring-label">{label}</div>
      </div>
      {/* Legenda fora do círculo: dentro dele, três linhas encostam no traço. */}
      {caption && <p className="rd-ring-caption">{caption}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Barra por dimensão
// ---------------------------------------------------------------------------

interface BarProps {
  label: string;
  score: number;
  weight?: number;
  meaning?: string;
  delayMs?: number;
}

export function DimensionBar({ label, score, weight, meaning, delayMs = 0 }: BarProps) {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const id = setTimeout(() => setWidth(score), 80 + delayMs);
    return () => clearTimeout(id);
  }, [score, delayMs]);

  // Faixa cromática discreta: só o suficiente para orientar leitura.
  const tone = score >= 80 ? 'alta' : score >= 60 ? 'ok' : score >= 40 ? 'media' : 'baixa';

  return (
    <div className="rd-bar">
      <div className="rd-bar-head">
        <span className="rd-bar-label">
          {label}
          {typeof weight === 'number' && <span className="rd-bar-weight">{weight}%</span>}
        </span>
        <span className="rd-bar-value">{score}</span>
      </div>
      <div className="rd-bar-track">
        <div className={`rd-bar-fill rd-tone-${tone}`} style={{ width: `${width}%` }} />
      </div>
      {meaning && <p className="rd-bar-meaning">{meaning}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Barra de progresso do wizard
// ---------------------------------------------------------------------------

export function ProgressBar({ current, total, stepLabel }: { current: number; total: number; stepLabel: string }) {
  const percent = total > 0 ? Math.round((current / total) * 100) : 0;
  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <div className="rd-progress">
      <div className="rd-progress-meta">
        <span className="rd-progress-count">
          Diagnóstico {pad(current)}/{pad(total)}
        </span>
        <span className="rd-progress-step">{stepLabel}</span>
      </div>
      <div
        className="rd-progress-track"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Progresso do diagnóstico"
      >
        <div className="rd-progress-fill" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
