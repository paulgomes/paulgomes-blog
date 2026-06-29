import type { Env } from './db';
import type { SessionUser } from './auth';
import { requireAuth } from './require-auth';

export type Role = 'admin' | 'editor' | 'author';

const RANK: Record<Role, number> = { author: 1, editor: 2, admin: 3 };

/**
 * Garante autenticacao + papel MINIMO. Retorna { user } ou uma Response (401/403).
 * Hierarquia: admin > editor > author. Ex: requireRole(req, env, 'editor') passa
 * para editor e admin, bloqueia author.
 */
export async function requireRole(
  request: Request,
  env: Env,
  min: Role,
): Promise<{ user: SessionUser } | Response> {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;
  const rank = RANK[auth.user.role] ?? 0;
  if (rank < RANK[min]) {
    return Response.json(
      { error: `Permissão insuficiente (requer ${min})` },
      { status: 403 },
    );
  }
  return auth;
}
