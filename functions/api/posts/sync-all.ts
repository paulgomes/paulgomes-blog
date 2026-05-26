import type { Env } from '../_utils/db';
import { requireAuth } from '../_utils/require-auth';

// POST /api/posts/sync-all
// Bulk-mark: synced_at = updated_at em todos os posts publicados onde difere.
// Usado quando .md no Git ja foi atualizado manualmente (push direto) ou
// quando scripts antigos esqueceram de bumpar synced_at.
//
// Idempotente: nao toca posts ja em sync.

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const result = await env.DB.prepare(`
    UPDATE posts_meta
    SET synced_at = updated_at
    WHERE status = 'published'
      AND (synced_at IS NULL OR synced_at < updated_at)
  `).run();

  const changes = (result.meta as any)?.changes ?? 0;
  return Response.json({
    ok: true,
    updated: changes,
    message: changes === 0
      ? 'Já estava tudo sincronizado'
      : `${changes} post${changes === 1 ? '' : 's'} marcado${changes === 1 ? '' : 's'} como sincronizado${changes === 1 ? '' : 's'}`,
  });
};
