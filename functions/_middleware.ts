import type { Env } from './api/_utils/db';
import { getCookieSessionId, getSessionUser } from './api/_utils/auth';

export const onRequest: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);

  // Proteger rotas /painel (exceto /painel/login)
  const isPainelRoute = url.pathname.startsWith('/painel') && !url.pathname.startsWith('/painel/login');
  // Proteger rotas /api (exceto auth + newsletter publica)
  const isProtectedApi = url.pathname.startsWith('/api/') &&
    !url.pathname.startsWith('/api/auth/login') &&
    !url.pathname.startsWith('/api/auth/me') &&
    !url.pathname.startsWith('/api/newsletter/');

  if (isPainelRoute || isProtectedApi) {
    const sessionId = getCookieSessionId(context.request);
    const user = await getSessionUser(context.env, sessionId);

    if (!user) {
      if (isProtectedApi) {
        return Response.json({ error: 'Não autenticado' }, { status: 401 });
      }
      // Redireciona pra login mantendo URL original
      const loginUrl = new URL('/painel/login', url);
      loginUrl.searchParams.set('next', url.pathname);
      return Response.redirect(loginUrl.toString(), 302);
    }

    // Injeta usuário no context pra Pages Functions seguintes
    (context.data as any).user = user;
  }

  return context.next();
};
