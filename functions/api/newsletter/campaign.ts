import type { Env } from '../_utils/db';
import { requireRole } from '../_utils/require-role';
import { audit } from '../_utils/audit';

// POST /api/newsletter/campaign
// Body: { subject, html, testTo? }
// Envia uma campanha de newsletter via Resend.
//
//  - testTo (um email): envia SO para esse endereço (modo teste) via
//    POST https://api.resend.com/emails. Retorna { sent: 'test', to }.
//  - sem testTo: cria um broadcast pra audiência (env.RESEND_AUDIENCE_ID)
//    via POST https://api.resend.com/broadcasts e dispara o envio com
//    POST https://api.resend.com/broadcasts/<id>/send. Retorna { sent: 'broadcast', id }.
//
// SEGURANÇA: nunca envia sem subject E html preenchidos. Erros do Resend
// propagam o status retornado pela API.

// Mesmo remetente usado em subscribe.ts (domínio verificado no Resend).
const FROM = 'Paul Gomes <no-reply@paulgomes.com.br>';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Extrai a mensagem de erro do corpo do Resend (JSON { message } ou texto cru).
async function resendError(res: Response): Promise<string> {
  const raw = await res.text().catch(() => '');
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.message === 'string') return parsed.message;
  } catch {
    /* corpo não é JSON */
  }
  return raw.slice(0, 300) || `Resend retornou ${res.status}`;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  // Admin (envio em massa é alto risco). _middleware já protege /api/*, reforçamos aqui.
  const auth = await requireRole(request, env, 'admin');
  if (auth instanceof Response) return auth;

  if (!env.RESEND_API_KEY) {
    console.error('Campaign: RESEND_API_KEY ausente.');
    return Response.json({ error: 'Envio indisponível: RESEND_API_KEY não configurada.' }, { status: 503 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Requisição inválida.' }, { status: 400 });
  }
  if (!body || typeof body !== 'object') {
    return Response.json({ error: 'Requisição inválida.' }, { status: 400 });
  }

  const subject = String(body.subject || '').trim();
  const html = String(body.html || '').trim();
  const testTo = body.testTo != null ? String(body.testTo).trim().toLowerCase() : '';

  // SEGURANÇA: assunto e corpo são obrigatórios em qualquer modo.
  if (!subject) {
    return Response.json({ error: 'Informe o assunto.' }, { status: 400 });
  }
  if (!html) {
    return Response.json({ error: 'Informe o corpo (HTML) da campanha.' }, { status: 400 });
  }

  const authHeaders = {
    'Authorization': `Bearer ${env.RESEND_API_KEY}`,
    'Content-Type': 'application/json',
  };

  // === MODO TESTE: envia só pro email informado ===
  if (testTo) {
    if (!EMAIL_REGEX.test(testTo)) {
      return Response.json({ error: 'Email de teste inválido.' }, { status: 400 });
    }
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ from: FROM, to: testTo, subject, html }),
      });
      if (!res.ok) {
        const detail = await resendError(res);
        console.error(`Resend emails ${res.status}:`, detail);
        return Response.json({ error: detail }, { status: res.status });
      }
      await audit(env, { userId: auth.user.id, action: 'newsletter.test', entity: 'newsletter', after: { to: testTo, subject } });
      return Response.json({ sent: 'test', to: testTo });
    } catch (err: any) {
      console.error('Campaign test error:', err?.message || err);
      return Response.json({ error: 'Erro ao enviar email de teste.' }, { status: 502 });
    }
  }

  // === MODO BROADCAST: envia pra audiência inteira ===
  if (!env.RESEND_AUDIENCE_ID) {
    console.error('Campaign: RESEND_AUDIENCE_ID ausente.');
    return Response.json({ error: 'Envio indisponível: RESEND_AUDIENCE_ID não configurada.' }, { status: 503 });
  }

  try {
    // 1) Cria o broadcast.
    const createRes = await fetch('https://api.resend.com/broadcasts', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        audience_id: env.RESEND_AUDIENCE_ID,
        from: FROM,
        subject,
        html,
      }),
    });
    if (!createRes.ok) {
      const detail = await resendError(createRes);
      console.error(`Resend broadcasts create ${createRes.status}:`, detail);
      return Response.json({ error: detail }, { status: createRes.status });
    }

    const created = (await createRes.json().catch(() => null)) as { id?: string } | null;
    const id = created?.id;
    if (!id) {
      console.error('Resend broadcasts create: resposta sem id.', created);
      return Response.json({ error: 'Resend não retornou o id do broadcast.' }, { status: 502 });
    }

    // 2) Dispara o envio do broadcast criado.
    const sendRes = await fetch(`https://api.resend.com/broadcasts/${encodeURIComponent(id)}/send`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({}),
    });
    if (!sendRes.ok) {
      const detail = await resendError(sendRes);
      console.error(`Resend broadcasts send ${sendRes.status}:`, detail);
      // Broadcast foi criado, mas o disparo falhou — informa o id pra retentativa manual.
      return Response.json({ error: detail, id }, { status: sendRes.status });
    }

    await audit(env, { userId: auth.user.id, action: 'newsletter.broadcast', entity: 'newsletter', entityId: id, after: { subject } });
    return Response.json({ sent: 'broadcast', id });
  } catch (err: any) {
    console.error('Campaign broadcast error:', err?.message || err);
    return Response.json({ error: 'Erro ao enviar a campanha.' }, { status: 502 });
  }
};
