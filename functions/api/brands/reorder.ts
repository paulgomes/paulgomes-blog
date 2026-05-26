import type { Env } from '../_utils/db';
import { requireAuth } from '../_utils/require-auth';

// POST /api/brands/reorder
// Body: { ids: string[] } — array de ids na nova ordem.
// Atualiza position = index do array pra cada id.

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const body = await request.json() as any;
  const ids = Array.isArray(body.ids) ? body.ids : null;
  if (!ids || ids.length === 0) {
    return Response.json({ error: 'ids deve ser array não-vazio' }, { status: 400 });
  }

  // Valida que todos sao strings e existem
  for (const id of ids) {
    if (typeof id !== 'string') return Response.json({ error: 'ids deve conter apenas strings' }, { status: 400 });
  }

  const now = Date.now();
  const stmts = ids.map((id: string, idx: number) =>
    env.DB.prepare('UPDATE brands SET position = ?, updated_at = ? WHERE id = ?').bind(idx, now, id)
  );

  await env.DB.batch(stmts);
  return Response.json({ ok: true });
};
