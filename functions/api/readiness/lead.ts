import type { Env } from '../_utils/db';

// POST /api/readiness/lead
// Body: { nome, email, whatsapp, empresa, website?, identity, answers, diagnosis, siteSignals }
// Captura o lead da ferramenta ChatGPT Ads Readiness. Endpoint PUBLICO
// (liberado em functions/_middleware.ts).
//
// Camadas de seguranca herdadas do padrao de /api/contact:
//  1. Honeypot (`website`): preenchido -> finge sucesso e nao grava nada.
//  2. Sanitizacao de campos de 1 linha -> impede injecao de cabecalho de e-mail.
//  3. Escape de HTML na renderizacao do e-mail -> anti-XSS no inbox.
//  4. Validacao de formato/tamanho server-side.
//
// Persistencia: grava em D1 (`readiness_leads`, migration 0015) E envia e-mail.
// As duas sao independentes de proposito — se o D1 falhar (tabela ainda nao
// migrada, por exemplo), o e-mail garante que o lead nao se perde, e vice-versa.
// So devolve erro se AMBAS falharem.

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HAS_LETTER = /\p{L}/u;
const CONTROL_ALL = new RegExp('[\\x00-\\x1F\\x7F]+', 'g');

const TO = 'paulgomes@wys.com.br';
const FROM = { email: 'no-reply@paulgomes.com.br', name: 'ChatGPT Ads Readiness' };

const LIMITS = {
  nome: { min: 2, max: 100 },
  email: { max: 254 },
  whatsapp: { min: 8, max: 25 },
  empresa: { min: 2, max: 140 },
  json: { max: 200_000 },
} as const;

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function cleanLine(s: string): string {
  return s.replace(CONTROL_ALL, ' ').replace(/\s+/g, ' ').trim();
}

function num(v: unknown): number | null {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Serializa com teto de tamanho — payload gigante nao derruba o insert. */
function safeJson(value: unknown): string | null {
  try {
    const s = JSON.stringify(value ?? null);
    if (!s || s.length > LIMITS.json.max) return null;
    return s;
  } catch {
    return null;
  }
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    if (!/application\/json/i.test(request.headers.get('content-type') || '')) {
      return Response.json({ error: 'Formato inválido.' }, { status: 415 });
    }

    const body = (await request.json().catch(() => null)) as any;
    if (!body || typeof body !== 'object') {
      return Response.json({ error: 'Requisição inválida.' }, { status: 400 });
    }

    // Honeypot: bot preencheu campo oculto -> responde OK sem gravar nada.
    if (String(body.website || '').trim()) {
      return Response.json({ message: 'ok' });
    }

    const nome = cleanLine(String(body.nome || ''));
    const email = cleanLine(String(body.email || '')).toLowerCase();
    const whatsapp = cleanLine(String(body.whatsapp || ''));
    const empresa = cleanLine(String(body.empresa || ''));

    if (nome.length < LIMITS.nome.min || nome.length > LIMITS.nome.max || !HAS_LETTER.test(nome)) {
      return Response.json({ error: 'Informe um nome válido.' }, { status: 400 });
    }
    if (email.length > LIMITS.email.max || !EMAIL_REGEX.test(email)) {
      return Response.json({ error: 'E-mail inválido.' }, { status: 400 });
    }
    const digits = whatsapp.replace(/\D/g, '');
    if (digits.length < LIMITS.whatsapp.min || whatsapp.length > LIMITS.whatsapp.max) {
      return Response.json({ error: 'Informe um WhatsApp válido com DDD.' }, { status: 400 });
    }
    if (empresa.length < LIMITS.empresa.min || empresa.length > LIMITS.empresa.max) {
      return Response.json({ error: 'Informe o nome da empresa.' }, { status: 400 });
    }

    const identity = (body.identity || {}) as Record<string, unknown>;
    const answers = (body.answers || {}) as Record<string, unknown>;
    const diagnosis = (body.diagnosis || {}) as Record<string, unknown>;
    const siteSignals = body.siteSignals ?? null;

    const readinessScore = num(diagnosis.total) ?? 0;
    const band = cleanLine(String((diagnosis as any)?.classification?.band || 'baixa'));
    const wysScore = num(diagnosis.wysLeadScore) ?? 0;
    const wysTier = cleanLine(String(diagnosis.wysLeadTier || 'baixa'));
    const oppIndex = num(diagnosis.opportunityIndex);

    const id = crypto.randomUUID();
    const now = Date.now();
    const ip = request.headers.get('CF-Connecting-IP') || '';
    const ua = cleanLine(request.headers.get('user-agent') || '').slice(0, 300);

    // --- 1. Persistir em D1 -------------------------------------------------
    let dbOk = false;
    if (env.DB) {
      try {
        await env.DB.prepare(
          `INSERT INTO readiness_leads (
             id, nome, email, whatsapp, empresa,
             site, segmento, local, pais, moeda, modelo, objetivo, investimento_faixa, ticket_medio,
             readiness_score, readiness_band, opportunity_index, wys_lead_score, wys_lead_tier,
             answers_json, diagnosis_json, site_signals_json,
             user_agent, ip, created_at
           ) VALUES (?,?,?,?,?, ?,?,?,?,?,?,?,?,?, ?,?,?,?,?, ?,?,?, ?,?,?)`
        )
          .bind(
            id,
            nome,
            email,
            whatsapp,
            empresa,
            cleanLine(String(identity.site || '')).slice(0, 500) || null,
            cleanLine(String(identity.segmento || '')).slice(0, 200) || null,
            cleanLine(String(identity.local || '')).slice(0, 200) || null,
            cleanLine(String(identity.pais || '')).slice(0, 4) || null,
            cleanLine(String(identity.moeda || '')).slice(0, 8) || null,
            cleanLine(String(identity.modelo || '')).slice(0, 40) || null,
            cleanLine(String(answers.objetivo || '')).slice(0, 60) || null,
            cleanLine(String(answers.eco_investimento || '')).slice(0, 40) || null,
            num(answers.eco_ticket),
            readinessScore,
            band,
            oppIndex,
            wysScore,
            wysTier,
            safeJson(answers),
            safeJson(diagnosis),
            safeJson(siteSignals),
            ua || null,
            ip || null,
            now
          )
          .run();
        dbOk = true;
      } catch (err: any) {
        // Tabela ainda nao migrada e o caso esperado — nao derruba a captura.
        console.error('readiness lead D1 insert falhou:', err?.message || err);
      }
    }

    // --- 2. Notificar por e-mail -------------------------------------------
    let mailOk = false;
    if (env.EMAIL_API_TOKEN && env.CLOUDFLARE_ACCOUNT_ID) {
      const dims = Array.isArray((diagnosis as any).dimensions) ? (diagnosis as any).dimensions : [];
      const dimRows = dims
        .map(
          (d: any) =>
            `<tr><td style="padding:4px 0;color:#666;">${esc(String(d.label))}</td><td style="padding:4px 0;text-align:right;font-weight:600;">${esc(String(d.score))}</td></tr>`
        )
        .join('');

      const html = `
        <div style="font-family:system-ui,-apple-system,sans-serif;max-width:600px;margin:0 auto;padding:32px 16px;color:#1a1a1a;">
          <p style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#666;margin:0 0 8px;">ChatGPT Ads Readiness</p>
          <h1 style="font-size:20px;margin:0 0 4px;">${esc(empresa)}</h1>
          <p style="margin:0 0 24px;font-size:14px;color:#666;">${esc(nome)} · <a href="mailto:${esc(email)}" style="color:#0103F9;">${esc(email)}</a> · ${esc(whatsapp)}</p>

          <div style="display:flex;gap:12px;margin:0 0 24px;">
            <div style="flex:1;padding:14px;background:#f5f5f5;border-radius:8px;">
              <div style="font-size:11px;color:#666;text-transform:uppercase;letter-spacing:.1em;">Readiness</div>
              <div style="font-size:26px;font-weight:800;">${esc(String(readinessScore))}<span style="font-size:14px;color:#999;">/100</span></div>
              <div style="font-size:12px;color:#666;">${esc(band)}</div>
            </div>
            <div style="flex:1;padding:14px;background:#0103F9;border-radius:8px;color:#fff;">
              <div style="font-size:11px;opacity:.75;text-transform:uppercase;letter-spacing:.1em;">WYS Lead Score</div>
              <div style="font-size:26px;font-weight:800;">${esc(String(wysScore))}<span style="font-size:14px;opacity:.7;">/100</span></div>
              <div style="font-size:12px;opacity:.85;">${esc(wysTier)}</div>
            </div>
          </div>

          <table style="width:100%;border-collapse:collapse;font-size:13px;line-height:1.5;">
            <tr><td style="padding:4px 0;color:#666;width:150px;">Site</td><td style="padding:4px 0;">${esc(String(identity.site || '—'))}</td></tr>
            <tr><td style="padding:4px 0;color:#666;">Segmento</td><td style="padding:4px 0;">${esc(String(identity.segmento || '—'))}</td></tr>
            <tr><td style="padding:4px 0;color:#666;">Local</td><td style="padding:4px 0;">${esc(String(identity.local || '—'))}</td></tr>
            <tr><td style="padding:4px 0;color:#666;">Modelo</td><td style="padding:4px 0;">${esc(String(identity.modelo || '—'))}</td></tr>
            <tr><td style="padding:4px 0;color:#666;">Objetivo</td><td style="padding:4px 0;">${esc(String(answers.objetivo || '—'))}</td></tr>
            <tr><td style="padding:4px 0;color:#666;">Investimento</td><td style="padding:4px 0;">${esc(String(answers.eco_investimento || '—'))}</td></tr>
            <tr><td style="padding:4px 0;color:#666;">Ticket médio</td><td style="padding:4px 0;">${esc(String(answers.eco_ticket ?? '—'))}</td></tr>
          </table>

          <h2 style="font-size:14px;margin:24px 0 8px;">Dimensões</h2>
          <table style="width:100%;border-collapse:collapse;font-size:13px;">${dimRows}</table>

          <p style="font-size:12px;color:#999;margin:24px 0 0;">
            ${dbOk ? 'Salvo no D1 (readiness_leads).' : 'ATENÇÃO: não foi salvo no D1 — verifique a migration 0015.'}
            ${ip ? ` · IP: ${esc(ip)}` : ''}
          </p>
        </div>`;

      const text =
        `ChatGPT Ads Readiness — novo lead\n\n` +
        `Empresa: ${empresa}\nNome: ${nome}\nEmail: ${email}\nWhatsApp: ${whatsapp}\n\n` +
        `Readiness: ${readinessScore}/100 (${band})\nWYS Lead Score: ${wysScore}/100 (${wysTier})\n`;

      try {
        const endpoint = `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/email/sending/send`;
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { Authorization: `Bearer ${env.EMAIL_API_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: TO,
            from: { address: FROM.email, name: FROM.name },
            reply_to: email,
            subject: `[Readiness ${readinessScore}/100 · WYS ${wysScore}] ${empresa}`,
            html,
            text,
          }),
        });
        mailOk = res.ok;
        if (!res.ok) {
          console.error(`Email Service ${res.status}:`, (await res.text().catch(() => '')).slice(0, 500));
        }
      } catch (err: any) {
        console.error('readiness lead email falhou:', err?.message || err);
      }
    }

    if (!dbOk && !mailOk) {
      return Response.json(
        { error: 'Não consegui registrar seus dados agora. Tente novamente em instantes.' },
        { status: 503 }
      );
    }

    return Response.json({ message: 'ok', id });
  } catch (err: any) {
    console.error('readiness lead error:', err?.message || err);
    return Response.json({ error: 'Erro ao processar. Tente novamente.' }, { status: 500 });
  }
};
