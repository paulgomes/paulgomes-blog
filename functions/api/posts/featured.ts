import type { Env } from '../_utils/db';
import { requireAuth } from '../_utils/require-auth';

// GET /api/posts/featured
// Retorna o post atualmente em destaque (is_featured=1 + status=published) ou null.
// Roteamento literal vence o dinamico [slug].ts.

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  try {
    const result = await env.DB.prepare(`
      SELECT slug, title, hero_image_url, published_at
      FROM posts_meta
      WHERE is_featured = 1 AND status = 'published'
      LIMIT 1
    `).first();

    return Response.json({
      ok: true,
      featured: result || null,
    });
  } catch (err: any) {
    console.error('Featured fetch error:', err);
    return Response.json(
      { error: err.message || 'Erro ao buscar destaque' },
      { status: 500 }
    );
  }
};
