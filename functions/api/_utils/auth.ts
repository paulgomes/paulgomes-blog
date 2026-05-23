import type { Env } from './db';
import { generateToken } from './crypto';

const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'editor' | 'author';
  avatar_url: string | null;
};

export async function createSession(env: Env, userId: string, request: Request): Promise<string> {
  const sessionId = generateToken();
  const now = Date.now();
  const expiresAt = now + SESSION_DURATION_MS;
  const userAgent = request.headers.get('user-agent') || '';
  const ip = request.headers.get('cf-connecting-ip') || '';

  await env.DB.prepare(
    'INSERT INTO sessions (id, user_id, expires_at, created_at, user_agent, ip) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(sessionId, userId, expiresAt, now, userAgent, ip).run();

  return sessionId;
}

export async function getSessionUser(env: Env, sessionId: string | null): Promise<SessionUser | null> {
  if (!sessionId) return null;

  const row = await env.DB.prepare(
    `SELECT u.id, u.email, u.name, u.role, u.avatar_url, s.expires_at
     FROM sessions s
     INNER JOIN users u ON u.id = s.user_id
     WHERE s.id = ? AND s.expires_at > ?`
  ).bind(sessionId, Date.now()).first();

  if (!row) return null;

  return {
    id: row.id as string,
    email: row.email as string,
    name: row.name as string,
    role: row.role as any,
    avatar_url: row.avatar_url as string | null,
  };
}

export async function deleteSession(env: Env, sessionId: string): Promise<void> {
  await env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run();
}

export function getCookieSessionId(request: Request): string | null {
  const cookie = request.headers.get('cookie') || '';
  const match = cookie.match(/(?:^|;\s*)session=([^;]+)/);
  return match ? match[1] : null;
}

export function buildSessionCookie(sessionId: string, maxAgeSeconds: number): string {
  return [
    `session=${sessionId}`,
    `Max-Age=${maxAgeSeconds}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
  ].join('; ');
}

export function buildLogoutCookie(): string {
  return 'session=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax';
}
