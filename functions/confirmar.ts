import type { Env } from './api/_utils/db';

// GET /confirmar?token=XXX
// Confirma o subscriber: status=pending -> confirmed + cria contato Resend Audiences.
// Renderiza HTML inline (sem template Astro — escopo enxuto).

function renderPage(title: string, body: string, success = false): string {
  const accent = success ? '#00b4d8' : '#666';
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex, nofollow">
  <title>${title} · Paul Gomes</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; margin: 0; padding: 64px 16px; background: #fafafa; color: #1a1a1a; }
    .card { max-width: 480px; margin: 0 auto; background: #fff; padding: 48px 32px; border-radius: 12px; box-shadow: 0 4px 24px rgba(0,0,0,0.06); text-align: center; }
    h1 { font-size: 24px; margin: 0 0 16px; color: ${accent}; }
    p { line-height: 1.6; color: #444; margin: 0; }
    a { color: ${accent}; }
    .home { display: inline-block; margin-top: 32px; color: #666; text-decoration: none; font-size: 14px; }
    .home:hover { color: #1a1a1a; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${title}</h1>
    <p>${body}</p>
    <a class="home" href="https://paulgomes.com.br">← Voltar pro site</a>
  </div>
</body>
</html>`;
}

function htmlResponse(html: string, status = 200): Response {
  return new Response(html, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  if (!token) {
    return htmlResponse(renderPage('Link inválido', 'Token não fornecido.'), 400);
  }

  const sub = await env.DB
    .prepare('SELECT id, email, status FROM newsletter_subscribers WHERE confirm_token = ?')
    .bind(token)
    .first<{ id: string; email: string; status: string }>();

  if (!sub) {
    return htmlResponse(renderPage('Link inválido', 'Este link expirou, já foi usado ou não existe.'), 404);
  }

  if (sub.status === 'confirmed') {
    return htmlResponse(renderPage('Já confirmado', 'Sua inscrição já estava confirmada. Obrigado por estar com a gente!', true));
  }

  if (sub.status === 'unsubscribed') {
    return htmlResponse(renderPage('Link expirado', 'Esta inscrição foi cancelada. Re-inscreva-se pelo site se quiser voltar.'), 400);
  }

  // status === 'pending' → adiciona no Resend Audiences + confirma no D1
  let resendContactId: string | null = null;
  try {
    const res = await fetch(
      `https://api.resend.com/audiences/${env.RESEND_AUDIENCE_ID}/contacts`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: sub.email, unsubscribed: false }),
      }
    );
    const data = await res.json().catch(() => ({})) as any;
    resendContactId = data?.id || null;
    if (!res.ok) {
      console.warn(`Resend add-contact ${res.status}:`, JSON.stringify(data).slice(0, 200));
    }
  } catch (err) {
    console.error('Resend audience add error:', err);
  }

  await env.DB.prepare(`
    UPDATE newsletter_subscribers
    SET status = 'confirmed', confirmed_at = ?, resend_contact_id = ?
    WHERE id = ?
  `).bind(Date.now(), resendContactId, sub.id).run();

  return htmlResponse(renderPage(
    '✓ Inscrição confirmada!',
    `Obrigado por se inscrever, <strong>${sub.email}</strong>.<br><br>Você receberá as próximas edições no seu email.`,
    true
  ));
};
