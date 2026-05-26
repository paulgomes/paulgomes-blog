import type { Env } from './api/_utils/db';

// GET /confirmar?token=XXX
// Confirma o subscriber: status=pending -> confirmed + cria contato Resend Audiences.
// Renderiza HTML inline (sem template Astro — escopo enxuto).

// Manter URLs em sync com src/consts.ts (functions/ e src/ tem bundlers separados)
const SOCIAL_URLS = {
  linkedin: 'https://www.linkedin.com/in/inpaulgomes/',
  instagram: 'https://www.instagram.com/paulgomes/',
  youtube: 'https://www.youtube.com/@paulgomesx',
};

const SOCIAL_BLOCK = `
    <div class="social-block">
      <p class="social-prompt">Enquanto isso, me siga por aí:</p>
      <div class="social-icons">
        <a href="${SOCIAL_URLS.linkedin}" target="_blank" rel="noopener" aria-label="LinkedIn">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>
        </a>
        <a href="${SOCIAL_URLS.instagram}" target="_blank" rel="noopener" aria-label="Instagram">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
        </a>
        <a href="${SOCIAL_URLS.youtube}" target="_blank" rel="noopener" aria-label="YouTube">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/></svg>
        </a>
      </div>
    </div>`;

function renderPage(title: string, body: string, success = false): string {
  const accent = success ? '#0103F9' : '#666';
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
    .social-block { margin-top: 32px; padding-top: 24px; border-top: 1px solid #f0f0f0; }
    .social-prompt { font-size: 14px; color: #888; margin: 0 0 16px; }
    .social-icons { display: flex; justify-content: center; gap: 20px; }
    .social-icons a {
      color: #999;
      transition: color .2s, transform .2s, background .2s;
      display: inline-flex;
      width: 40px;
      height: 40px;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      background: #f5f5f5;
    }
    .social-icons a:hover {
      color: #0103F9;
      background: #e8e9ff;
      transform: translateY(-2px);
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>${title}</h1>
    <p>${body}</p>
    ${success ? SOCIAL_BLOCK : ''}
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
