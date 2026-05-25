import type { Env } from './api/_utils/db';

// GET /cancelar?token=XXX
// Unsubscribe LGPD: status=confirmed -> unsubscribed + remove contato Resend.
// Link DEVE estar em todo broadcast futuro (footer).

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
    .prepare('SELECT id, email, status, resend_contact_id FROM newsletter_subscribers WHERE unsubscribe_token = ?')
    .bind(token)
    .first<{ id: string; email: string; status: string; resend_contact_id: string | null }>();

  if (!sub) {
    return htmlResponse(renderPage('Link inválido', 'Token não encontrado.'), 404);
  }

  if (sub.status === 'unsubscribed') {
    return htmlResponse(renderPage('Já cancelado', 'Sua inscrição já estava cancelada.'));
  }

  // Remove do Resend Audience (se contact_id conhecido)
  if (sub.resend_contact_id) {
    try {
      const res = await fetch(
        `https://api.resend.com/audiences/${env.RESEND_AUDIENCE_ID}/contacts/${sub.resend_contact_id}`,
        {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}` },
        }
      );
      if (!res.ok) {
        console.warn(`Resend delete-contact ${res.status}:`, (await res.text()).slice(0, 200));
      }
    } catch (err) {
      console.error('Resend audience delete error:', err);
    }
  }

  await env.DB.prepare(`
    UPDATE newsletter_subscribers
    SET status = 'unsubscribed', unsubscribed_at = ?
    WHERE id = ?
  `).bind(Date.now(), sub.id).run();

  return htmlResponse(renderPage(
    'Inscrição cancelada',
    `<strong>${sub.email}</strong> foi removido da lista.<br><br>Você pode se re-inscrever a qualquer momento pelo site.`,
    true
  ));
};
