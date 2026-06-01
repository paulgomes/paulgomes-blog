import type { Env } from '../_utils/db';
import { requireAuth } from '../_utils/require-auth';

// GET /api/posts/featured
// Retorna TODOS os posts em destaque (is_featured=1 + status=published).
// Multiplos destaques sao suportados — o carrossel da home exibe todos.
// Roteamento literal vence o dinamico [slug].ts.

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  try {
    const { results } = await env.DB.prepare(`
      SELECT slug, title, hero_image_url, published_at
      FROM posts_meta
      WHERE is_featured = 1 AND status = 'published'
      ORDER BY published_at DESC
    `).all();

    const featured = results ?? [];

    return Response.json({
      ok: true,
      featured,
      count: featured.length,
    });
  } catch (err: any) {
    console.error('Featured fetch error:', err);
    return Response.json(
      { error: err.message || 'Erro ao buscar destaque' },
      { status: 500 }
    );
  }
};
