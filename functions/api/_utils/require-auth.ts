import type { Env } from './db';
import { getCookieSessionId, getSessionUser, SessionUser } from './auth';

export async function requireAuth(request: Request, env: Env): Promise<{ user: SessionUser } | Response> {
  const sessionId = getCookieSessionId(request);
  const user = await getSessionUser(env, sessionId);
  if (!user) {
    return Response.json({ error: 'Não autenticado' }, { status: 401 });
  }
  return { user };
}
