import type { Env } from '../_utils/db';

// POST /api/readiness/site-scan
// Body: { url }
// Le o HTML da URL informada e extrai SINAIS OBSERVAVEIS para o diagnostico
// ChatGPT Ads Readiness. Endpoint PUBLICO (liberado em functions/_middleware.ts).
//
// Este endpoint faz fetch de uma URL fornecida pelo usuario, entao e uma
// superficie de SSRF por natureza. Mitigacoes aplicadas aqui:
//  1. Apenas http/https. Bloqueia file:, gopher:, data:, etc.
//  2. Hostname em blocklist: localhost, *.local, IPs privados/loopback/
//     link-local literais e IPv6 equivalente.
//  3. redirect: 'manual' — um 3xx nao e seguido automaticamente; validamos o
//     Location e so seguimos ate MAX_REDIRECTS, revalidando o host a cada salto.
//  4. Timeout de 8s (AbortSignal) e leitura limitada a MAX_BYTES.
//  5. Resposta devolve SOMENTE sinais derivados — nunca o HTML bruto, que
//     poderia transformar o endpoint num proxy de conteudo arbitrario.
//
// NAO ha rate limiting: depende de um KV namespace que ainda nao existe
// (FILA-HUMANA item 4). Ate la o custo de abuso e limitado pelo timeout e pelo
// cap de bytes, mas o ideal e adicionar quando o KV estiver disponivel.

const MAX_BYTES = 512 * 1024; // 512 KB de HTML ja cobre qualquer home page util
const TIMEOUT_MS = 8000;
const MAX_REDIRECTS = 3;
const UA = 'Mozilla/5.0 (compatible; WYS-ReadinessBot/1.0; +https://paulgomes.com.br/chatgpt-ads-readiness)';

// IPv4 privado/loopback/link-local + metadata de cloud (169.254.169.254).
const PRIVATE_IPV4 =
  /^(10\.|127\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/;

function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal')) return true;
  if (h === '::1' || h === '0.0.0.0') return true;
  // IPv6 unique-local (fc00::/7) e link-local (fe80::/10).
  if (/^f[cd][0-9a-f]{2}:/.test(h) || /^fe[89ab][0-9a-f]:/.test(h)) return true;
  if (PRIVATE_IPV4.test(h)) return true;
  return false;
}

function parseTarget(raw: string): URL | null {
  let candidate = raw.trim();
  if (!candidate) return null;
  // Usuario costuma digitar "empresa.com.br" sem esquema.
  if (!/^https?:\/\//i.test(candidate)) candidate = `https://${candidate}`;

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (isBlockedHost(url.hostname)) return null;
  // Exige um TLD plausivel — evita hosts internos de rede corporativa.
  if (!/\.[a-z]{2,}$/i.test(url.hostname)) return null;
  return url;
}

/** Busca seguindo redirects manualmente, revalidando o destino a cada salto. */
async function safeFetch(start: URL): Promise<{ res: Response; finalUrl: string } | null> {
  let current = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const res = await fetch(current.toString(), {
      method: 'GET',
      redirect: 'manual',
      headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (!location) return { res, finalUrl: current.toString() };
      let next: URL;
      try {
        next = new URL(location, current);
      } catch {
        return null;
      }
      // Revalida: um redirect e justamente o vetor classico de SSRF.
      if (next.protocol !== 'http:' && next.protocol !== 'https:') return null;
      if (isBlockedHost(next.hostname)) return null;
      current = next;
      continue;
    }

    return { res, finalUrl: current.toString() };
  }
  return null;
}

/** Le no maximo MAX_BYTES do corpo, abortando o resto. */
async function readCapped(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      total += value.length;
    }
  }
  await reader.cancel().catch(() => {});
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    if (offset + c.length > total) {
      merged.set(c.subarray(0, total - offset), offset);
      break;
    }
    merged.set(c, offset);
    offset += c.length;
  }
  return new TextDecoder('utf-8', { fatal: false }).decode(merged);
}

// --- extracao de sinais -----------------------------------------------------

const TRUST_TERMS = [
  'depoimento', 'avaliação', 'avaliacao', 'testemunho', 'case', 'cliente',
  'certificado', 'certificação', 'certificacao', 'prêmio', 'premio',
  'garantia', 'cnpj', 'anos de', 'selo',
];
const CTA_TERMS = [
  'orçamento', 'orcamento', 'fale conosco', 'entre em contato', 'agendar',
  'agende', 'comprar', 'assine', 'solicitar', 'peça', 'peca', 'quero',
  'demonstração', 'demonstracao', 'teste grátis', 'teste gratis', 'whatsapp',
];

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function attr(tag: string, name: string): string | null {
  const m = new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, 'i').exec(tag);
  return m ? m[1] : null;
}

function extractSignals(html: string, url: string, finalUrl: string, status: number) {
  const head = html.slice(0, 200_000);
  const text = stripTags(html);

  const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(head);
  const title = titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() : null;

  const metaTags = head.match(/<meta\b[^>]*>/gi) || [];
  let metaDescription: string | null = null;
  let hasOpenGraph = false;
  let hasViewportMeta = false;
  for (const tag of metaTags) {
    const name = (attr(tag, 'name') || '').toLowerCase();
    const prop = (attr(tag, 'property') || '').toLowerCase();
    if (name === 'description') metaDescription = (attr(tag, 'content') || '').trim() || null;
    if (name === 'viewport') hasViewportMeta = true;
    if (prop.startsWith('og:')) hasOpenGraph = true;
  }

  const h1 = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)]
    .map((m) => m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .slice(0, 5);
  const h2Count = (html.match(/<h2[\s>]/gi) || []).length;

  const schemaBlocks = [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)];
  const schemaTypes: string[] = [];
  for (const block of schemaBlocks) {
    for (const m of block[1].matchAll(/"@type"\s*:\s*"([^"]+)"/g)) {
      if (!schemaTypes.includes(m[1])) schemaTypes.push(m[1]);
    }
  }

  const imgTags = html.match(/<img\b[^>]*>/gi) || [];
  const imgWithoutAlt = imgTags.filter((t) => !/\balt\s*=\s*["'][^"']+["']/i.test(t)).length;

  const langMatch = /<html[^>]*\blang\s*=\s*["']([^"']+)["']/i.exec(head);

  return {
    url,
    finalUrl,
    status,
    title,
    metaDescription,
    h1,
    h2Count,
    hasForm: /<form\b/i.test(html),
    hasWhatsAppLink: /(wa\.me\/|api\.whatsapp\.com|whatsapp:\/\/)/i.test(html),
    hasTelLink: /href\s*=\s*["']tel:/i.test(html),
    hasMailtoLink: /href\s*=\s*["']mailto:/i.test(html),
    hasSchemaOrg: schemaTypes.length > 0,
    schemaTypes: schemaTypes.slice(0, 12),
    hasViewportMeta,
    hasOpenGraph,
    hasCanonical: /<link[^>]+rel\s*=\s*["']canonical["']/i.test(head),
    htmlBytes: html.length,
    imgCount: imgTags.length,
    imgWithoutAlt,
    trustSignals: TRUST_TERMS.filter((t) => text.includes(t)).slice(0, 12),
    ctaTerms: CTA_TERMS.filter((t) => text.includes(t)).slice(0, 12),
    langAttr: langMatch ? langMatch[1] : null,
  };
}

export const onRequestPost: PagesFunction<Env> = async ({ request }) => {
  try {
    if (!/application\/json/i.test(request.headers.get('content-type') || '')) {
      return Response.json({ ok: false, reason: 'Formato inválido.' }, { status: 415 });
    }

    const body = (await request.json().catch(() => null)) as any;
    const target = parseTarget(String(body?.url || ''));
    if (!target) {
      return Response.json(
        { ok: false, reason: 'URL inválida ou não permitida.' },
        { status: 400 }
      );
    }

    const fetched = await safeFetch(target).catch(() => null);
    if (!fetched) {
      return Response.json({ ok: false, reason: 'Não foi possível acessar o site.' });
    }

    const { res, finalUrl } = fetched;
    if (!res.ok) {
      return Response.json({ ok: false, reason: `O site respondeu com status ${res.status}.` });
    }

    const contentType = res.headers.get('content-type') || '';
    if (!/text\/html|application\/xhtml/i.test(contentType)) {
      return Response.json({ ok: false, reason: 'A URL não retornou uma página HTML.' });
    }

    const html = await readCapped(res);
    if (!html.trim()) {
      return Response.json({ ok: false, reason: 'A página veio vazia.' });
    }

    const signals = extractSignals(html, target.toString(), finalUrl, res.status);
    return Response.json({ ok: true, signals });
  } catch (err: any) {
    // Timeout do AbortSignal chega como TimeoutError.
    const reason =
      err?.name === 'TimeoutError'
        ? 'O site demorou demais para responder.'
        : 'Não foi possível analisar o site.';
    console.error('site-scan error:', err?.name, err?.message);
    return Response.json({ ok: false, reason });
  }
};
