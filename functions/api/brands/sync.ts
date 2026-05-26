import type { Env } from '../_utils/db';
import { requireAuth } from '../_utils/require-auth';
import { commitFile } from '../_utils/github';

// POST /api/brands/sync
// Le marcas + titulo do D1 e regenera src/data/brands.json via Contents API.
// Triggers CF rebuild (~1-2 min).

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const [brands, titleRow] = await Promise.all([
    env.DB.prepare('SELECT name, url FROM brands ORDER BY position ASC, created_at ASC').all<{ name: string; url: string | null }>(),
    env.DB.prepare("SELECT value FROM site_config WHERE key = 'brands_marquee_title'").first<{ value: string }>(),
  ]);

  const synced_at = Date.now();
  const json = JSON.stringify({
    title: titleRow?.value || 'Marcas que passaram por aqui',
    synced_at,
    items: (brands.results || []).map((b) => ({ name: b.name, url: b.url || null })),
  }, null, 2) + '\n';

  try {
    const result = await commitFile(env, {
      path: 'src/data/brands.json',
      content: json,
      message: 'sync(brands): atualiza marquee de marcas',
    });
    return Response.json({
      ok: true,
      synced_at,
      sha: result.sha,
      commit_url: result.html_url,
      message: 'Marcas sincronizadas. Cloudflare vai rebuildar em ~1-2 min.',
    });
  } catch (err: any) {
    console.error('Sync brands error:', err);
    return Response.json({ error: err.message || 'Erro ao sincronizar marcas' }, { status: 500 });
  }
};
