import type { Env } from '../_utils/db';
import { requireAuth } from '../_utils/require-auth';

// PUT /api/brands/title — Body: { title: string }
// Atualiza o titulo da secao na tabela site_config (key='brands_marquee_title')

export const onRequestPut: PagesFunction<Env> = async ({ request, env }) => {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const body = await request.json() as any;
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  if (!title) {
    return Response.json({ error: 'title obrigatório' }, { status: 400 });
  }
  if (title.length > 120) {
    return Response.json({ error: 'title muito longo (máx 120)' }, { status: 400 });
  }

  const now = Date.now();
  await env.DB
    .prepare(`INSERT INTO site_config (key, value, updated_at) VALUES ('brands_marquee_title', ?, ?)
              ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`)
    .bind(title, now)
    .run();

  return Response.json({ ok: true, title, updated_at: now });
};
