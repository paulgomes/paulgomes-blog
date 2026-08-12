/**
 * Campos com máscara.
 *
 * Regra que governa todos: o estado da verdade é o NÚMERO, não o texto
 * mascarado. O componente reformata a cada tecla e devolve o valor limpo para
 * cima — assim o score nunca precisa desfazer a formatação, e mudar de país
 * reformata o que já estava digitado sem perder o dado.
 *
 * O cursor é reposicionado contando dígitos, não caracteres: inserir um "1" no
 * meio de "1.234" muda o texto inteiro à direita, e uma posição baseada em
 * offset jogaria o cursor para o lugar errado.
 */

import { useLayoutEffect, useRef, useState } from 'react';
import {
  currencySymbol,
  formatPhone,
  groupDigits,
  parseMoney,
  phoneCapacity,
  phonePlaceholder,
  type Country,
} from '../../lib/readiness/locale';

/** Quantos dígitos existem até `pos` no texto. */
function digitsBefore(text: string, pos: number): number {
  let n = 0;
  for (let i = 0; i < pos && i < text.length; i++) {
    if (/\d/.test(text[i])) n++;
  }
  return n;
}

/** Posição no texto logo após o n-ésimo dígito. */
function posAfterDigits(text: string, count: number): number {
  if (count <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < text.length; i++) {
    if (/\d/.test(text[i])) {
      seen++;
      if (seen === count) return i + 1;
    }
  }
  return text.length;
}

/** Hook comum: aplica `format` no input e mantém o cursor sobre o mesmo dígito. */
function useMaskedField(formatted: string) {
  const ref = useRef<HTMLInputElement>(null);
  const caretDigits = useRef<number | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || caretDigits.current === null) return;
    const pos = posAfterDigits(el.value, caretDigits.current);
    el.setSelectionRange(pos, pos);
    caretDigits.current = null;
  }, [formatted]);

  return { ref, caretDigits };
}

// ---------------------------------------------------------------------------
// Dinheiro
// ---------------------------------------------------------------------------

interface MoneyProps {
  value: number | null;
  country: Country;
  onChange: (value: number | null) => void;
  placeholder?: string;
  id?: string;
  ariaLabel?: string;
}

export function MoneyInput({ value, country, onChange, placeholder, id, ariaLabel }: MoneyProps) {
  const text = value === null || value === undefined ? '' : groupDigits(String(value), country);
  const { ref, caretDigits } = useMaskedField(text);
  const symbol = currencySymbol(country);

  const handle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const el = e.target;
    caretDigits.current = digitsBefore(el.value, el.selectionStart ?? el.value.length);
    // Teto de 15 dígitos: acima disso Number perde precisão inteira.
    const digits = el.value.replace(/\D/g, '').slice(0, 15);
    onChange(digits ? parseMoney(digits) : null);
  };

  return (
    <div className="rd-money">
      <span className="rd-money-symbol" aria-hidden="true">
        {symbol}
      </span>
      <input
        ref={ref}
        id={id}
        className="rd-input rd-money-input"
        type="text"
        inputMode="numeric"
        autoComplete="off"
        aria-label={ariaLabel}
        value={text}
        placeholder={placeholder}
        onChange={handle}
      />
      <span className="rd-money-code" aria-hidden="true">
        {country.currency}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Porcentagem
// ---------------------------------------------------------------------------

interface PercentProps {
  value: number | null;
  onChange: (value: number | null) => void;
  placeholder?: string;
  id?: string;
  ariaLabel?: string;
}

export function PercentInput({ value, onChange, placeholder, id, ariaLabel }: PercentProps) {
  const text = value === null || value === undefined ? '' : String(value);

  const handle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 3);
    if (!digits) {
      onChange(null);
      return;
    }
    // Trava em 100: taxa de conversão acima disso é erro de digitação, e o
    // número entra na simulação de leads — deixar passar distorce o plano.
    onChange(Math.min(100, Number(digits)));
  };

  return (
    <div className="rd-money">
      <input
        id={id}
        className="rd-input rd-money-input rd-percent-input"
        type="text"
        inputMode="numeric"
        autoComplete="off"
        aria-label={ariaLabel}
        value={text}
        placeholder={placeholder}
        onChange={handle}
      />
      <span className="rd-money-code" aria-hidden="true">
        %
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Quantidade (leads/mês) — sem moeda, mas com separador de milhar
// ---------------------------------------------------------------------------

export function CountInput({
  value,
  country,
  onChange,
  placeholder,
  id,
  ariaLabel,
}: MoneyProps) {
  const text = value === null || value === undefined ? '' : groupDigits(String(value), country);
  const { ref, caretDigits } = useMaskedField(text);

  const handle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const el = e.target;
    caretDigits.current = digitsBefore(el.value, el.selectionStart ?? el.value.length);
    const digits = el.value.replace(/\D/g, '').slice(0, 9);
    onChange(digits ? Number(digits) : null);
  };

  return (
    <input
      ref={ref}
      id={id}
      className="rd-input"
      type="text"
      inputMode="numeric"
      autoComplete="off"
      aria-label={ariaLabel}
      value={text}
      placeholder={placeholder}
      onChange={handle}
    />
  );
}

// ---------------------------------------------------------------------------
// Telefone
// ---------------------------------------------------------------------------

interface PhoneProps {
  value: string;
  country: Country;
  onChange: (value: string) => void;
  id?: string;
  required?: boolean;
  ariaLabel?: string;
}

export function PhoneInput({ value, country, onChange, id, required, ariaLabel }: PhoneProps) {
  const formatted = formatPhone(value, country);
  const { ref, caretDigits } = useMaskedField(formatted);
  const max = phoneCapacity(country);

  const handle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const el = e.target;
    caretDigits.current = digitsBefore(el.value, el.selectionStart ?? el.value.length);
    onChange(el.value.replace(/\D/g, '').slice(0, max));
  };

  return (
    <div className="rd-phone">
      {country.dial && (
        <span className="rd-phone-dial" aria-hidden="true">
          +{country.dial}
        </span>
      )}
      <input
        ref={ref}
        id={id}
        className="rd-input rd-phone-input"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        required={required}
        aria-label={ariaLabel}
        value={formatted}
        placeholder={phonePlaceholder(country)}
        onChange={handle}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Site
// ---------------------------------------------------------------------------

interface UrlProps {
  value: string;
  onChange: (value: string) => void;
  id?: string;
}

/**
 * Aceita "empresa.com.br" sem esquema — exigir "https://" de um empresário é
 * fricção sem ganho. O prefixo aparece fixo à esquerda para deixar claro o que
 * será enviado, e a validação só avisa; não bloqueia, porque o campo é opcional.
 */
export function UrlInput({ value, onChange, id }: UrlProps) {
  const [touched, setTouched] = useState(false);
  const clean = value.replace(/^https?:\/\//i, '');
  const suspicious = touched && clean.length > 3 && !/\.[a-z]{2,}/i.test(clean);

  return (
    <>
      <div className="rd-url">
        <span className="rd-url-scheme" aria-hidden="true">
          https://
        </span>
        <input
          id={id}
          className="rd-input rd-url-input"
          type="text"
          inputMode="url"
          autoComplete="url"
          autoCapitalize="none"
          spellCheck={false}
          value={clean}
          placeholder="suaempresa.com.br"
          maxLength={300}
          onBlur={() => setTouched(true)}
          onChange={(e) => onChange(e.target.value.replace(/^https?:\/\//i, '').trim())}
        />
      </div>
      {suspicious && (
        <span className="rd-field-warn">
          Isso não parece um endereço de site. Sem um site válido, a análise automática é pulada — você ainda
          pode seguir.
        </span>
      )}
    </>
  );
}
