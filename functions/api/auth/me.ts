import type { Env } from '../_utils/db';
import { getCookieSessionId, getSessionUser } from '../_utils/auth';

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const sessionId = getCookieSessionId(request);
  const user = await getSessionUser(env, sessionId);

  if (!user) {
    return Response.json({ user: null }, { status: 200 });
  }

  return Response.json({ user });
};
