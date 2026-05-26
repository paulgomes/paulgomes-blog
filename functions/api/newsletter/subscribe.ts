import type { Env } from '../_utils/db';

// POST /api/newsletter/subscribe
// Body: { email }
// Cria/atualiza subscriber em pending + dispara email de confirmacao via Resend.
// Rate limit: 1 reenvio por minuto pro mesmo email.

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function siteUrl(env: Env, request: Request): string {
  return (env.SITE_URL || new URL(request.url).origin).replace(/\/$/, '');
}

async function sendConfirmEmail(env: Env, to: string, confirmUrl: string): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Paul Gomes <no-reply@paulgomes.com.br>',
      to,
      subject: 'Confirme sua inscrição na newsletter',
      html: `
        <div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:32px 16px;color:#1a1a1a;">
          <h1 style="font-size:20px;margin:0 0 16px;">Quase lá! Confirme sua inscrição</h1>
          <p style="line-height:1.6;margin:0 0 24px;">
            Você se inscreveu na newsletter do Paul Gomes — Thinking Forward.
          </p>
          <p style="line-height:1.6;margin:0 0 24px;">Para confirmar, clique no botão abaixo:</p>
          <p style="margin:0 0 32px;">
            <a href="${confirmUrl}" style="background:#0103F9;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block;">
              Confirmar inscrição
            </a>
          </p>
          <p style="font-size:13px;color:#666;line-height:1.6;margin:0 0 8px;">
            Se você não solicitou esta inscrição, ignore este email.
          </p>
          <p style="font-size:13px;color:#666;line-height:1.6;margin:0;word-break:break-all;">
            Link: <a href="${confirmUrl}" style="color:#666;">${confirmUrl}</a>
          </p>
        </div>
      `,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Resend ${res.status}: ${body.slice(0, 200)}`);
  }
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const body = await request.json().catch(() => null) as any;
    const email = String(body?.email || '').toLowerCase().trim();
    if (!email || !EMAIL_REGEX.test(email)) {
      return Response.json({ error: 'Email inválido' }, { status: 400 });
    }

    const existing = await env.DB.prepare(
      'SELECT id, status, confirm_token, created_at FROM newsletter_subscribers WHERE email = ?'
    ).bind(email).first<{ id: string; status: string; confirm_token: string; created_at: number }>();

    const now = Date.now();
    const base = siteUrl(env, request);

    if (existing) {
      if (existing.status === 'confirmed') {
        return Response.json({ message: 'Você já está inscrito ✓' });
      }
      if (existing.status === 'pending') {
        const elapsed = now - existing.created_at;
        if (elapsed < 60_000) {
          return Response.json({ message: 'Email de confirmação já enviado. Confira sua caixa (e spam).' });
        }
        // Reenvia confirmação reaproveitando token + atualiza created_at pra rate limit reset
        await env.DB.prepare(
          'UPDATE newsletter_subscribers SET created_at = ? WHERE id = ?'
        ).bind(now, existing.id).run();
        try {
          await sendConfirmEmail(env, email, `${base}/confirmar?token=${existing.confirm_token}`);
        } catch (err) {
          console.error('Resend resend error:', err);
        }
        return Response.json({ message: 'Confirme seu email — link reenviado.' });
      }
      // status === 'unsubscribed' → permite re-inscrição, novo token + novo email
    }

    const id = crypto.randomUUID();
    const confirmToken = crypto.randomUUID();
    const unsubToken = crypto.randomUUID();
    const ip = request.headers.get('CF-Connecting-IP') || '';
    const ua = request.headers.get('User-Agent') || '';

    await env.DB.prepare(`
      INSERT INTO newsletter_subscribers
        (id, email, status, confirm_token, unsubscribe_token, created_at, consent_ip, consent_user_agent)
      VALUES (?, ?, 'pending', ?, ?, ?, ?, ?)
      ON CONFLICT(email) DO UPDATE SET
        confirm_token = excluded.confirm_token,
        unsubscribe_token = excluded.unsubscribe_token,
        status = 'pending',
        created_at = excluded.created_at,
        confirmed_at = NULL,
        unsubscribed_at = NULL,
        consent_ip = excluded.consent_ip,
        consent_user_agent = excluded.consent_user_agent
    `).bind(id, email, confirmToken, unsubToken, now, ip, ua).run();

    try {
      await sendConfirmEmail(env, email, `${base}/confirmar?token=${confirmToken}`);
    } catch (err) {
      console.error('Resend send error:', err);
      // Nao bloqueia — usuario pode tentar subscribe de novo (rate limit decide reenvio)
    }

    return Response.json({ message: 'Quase lá! Confira seu email pra confirmar.' });
  } catch (err: any) {
    console.error('Subscribe error:', err);
    return Response.json({ error: 'Erro ao processar inscrição' }, { status: 500 });
  }
};
