import type { Env } from '../_utils/db';
import { requireAuth } from '../_utils/require-auth';

// PUT /api/brands/visibility — Body: { hidden: boolean }
// Define se a seção de Marcas aparece no site (site_config key='brands_marquee_hidden').
// Aplica no site após "Publicar no site" (sync regenera brands.json + rebuild).
export const onRequestPut: PagesFunction<Env> = async ({ request, env }) => {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const body = (await request.json().catch(() => null)) as { hidden?: unknown } | null;
  const hidden = body?.hidden === true;

  const now = Date.now();
  await env.DB
    .prepare(`INSERT INTO site_config (key, value, updated_at) VALUES ('brands_marquee_hidden', ?, ?)
              ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`)
    .bind(hidden ? '1' : '0', now)
    .run();

  return Response.json({ ok: true, hidden, updated_at: now });
};
