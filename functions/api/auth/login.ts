import type { Env } from '../_utils/db';
import { verifyPassword } from '../_utils/crypto';
import { createSession, buildSessionCookie } from '../_utils/auth';

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const body = await request.json() as { email?: string; password?: string };
    const email = (body.email || '').trim().toLowerCase();
    const password = body.password || '';

    if (!email || !password) {
      return Response.json({ error: 'Email e senha obrigatórios' }, { status: 400 });
    }

    const user = await env.DB.prepare(
      'SELECT id, email, password_hash, name, role FROM users WHERE email = ?'
    ).bind(email).first();

    if (!user) {
      // Mesma mensagem que senha errada (não vazar enumeração)
      return Response.json({ error: 'Email ou senha inválidos' }, { status: 401 });
    }

    const valid = await verifyPassword(password, user.password_hash as string);
    if (!valid) {
      return Response.json({ error: 'Email ou senha inválidos' }, { status: 401 });
    }

    // Atualiza last_login_at
    await env.DB.prepare('UPDATE users SET last_login_at = ? WHERE id = ?')
      .bind(Date.now(), user.id).run();

    // Cria sessão
    const sessionId = await createSession(env, user.id as string, request);

    return new Response(JSON.stringify({
      success: true,
      user: { id: user.id, email: user.email, name: user.name, role: user.role }
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': buildSessionCookie(sessionId, 7 * 24 * 60 * 60),
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    return Response.json({ error: 'Erro interno' }, { status: 500 });
  }
};
