import type { Env } from '../_utils/db';
import { getCookieSessionId, deleteSession, buildLogoutCookie } from '../_utils/auth';

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const sessionId = getCookieSessionId(request);
  if (sessionId) {
    await deleteSession(env, sessionId);
  }
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': buildLogoutCookie(),
    },
  });
};
