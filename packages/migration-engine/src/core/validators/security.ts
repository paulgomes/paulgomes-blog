/**
 * Sanitizacao basica de seguranca (doc secao 2.8).
 * Remove <script>/<style>/handlers inline e protocolos perigosos.
 * NAO substitui um sanitizador completo (DOMPurify) — e o gate minimo do MVP.
 */
import type { Diagnostic } from '../types/canonical.js';

const SCRIPT_RE = /<script\b[^>]*>[\s\S]*?<\/script>/gi;
const STYLE_RE = /<style\b[^>]*>[\s\S]*?<\/style>/gi;
const ON_HANDLER_RE = /\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;
const JS_PROTO_RE = /(href|src)\s*=\s*("|')\s*javascript:[^"']*\2/gi;

export interface SanitizeResult {
  html: string;
  diagnostics: Diagnostic[];
}

export function sanitizeHtml(html: string): SanitizeResult {
  const diagnostics: Diagnostic[] = [];
  let out = html;

  const before = out;
  out = out.replace(SCRIPT_RE, '');
  if (out !== before) diagnostics.push(d('SANITIZE_SCRIPT', 'Removido bloco <script>.'));

  const b2 = out;
  out = out.replace(STYLE_RE, '');
  if (out !== b2) diagnostics.push(d('SANITIZE_STYLE', 'Removido bloco <style>.'));

  const b3 = out;
  out = out.replace(ON_HANDLER_RE, '');
  if (out !== b3) diagnostics.push(d('SANITIZE_HANDLER', 'Removido handler inline on*=.'));

  out = out.replace(JS_PROTO_RE, '$1=$2#$2');

  return { html: out, diagnostics };
}

function d(code: string, message: string): Diagnostic {
  return { level: 'warning', code, message };
}

/** Detecta MIME por magic numbers (espelha scripts/*.mjs:detectMime). */
export function detectMime(bytes: Uint8Array): string | null {
  if (bytes.length < 4) return null;
  const b = bytes;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return 'image/gif';
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46) return 'image/webp';
  return null;
}
