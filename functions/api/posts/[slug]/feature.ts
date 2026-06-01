import type { Env } from '../../_utils/db';
import { requireAuth } from '../../_utils/require-auth';

// POST /api/posts/:slug/feature
// Body: { is_featured: boolean }
//
// Multiplos destaques: marcar/desmarcar este post NAO afeta os demais.
// O carrossel da home exibe todos os posts com is_featured=1.
//
// is_featured=true:  marca este post como featured -> { ok }
// is_featured=false: desmarca este post           -> { ok }

export const onRequestPost: PagesFunction<Env> = async ({ request, env, params }) => {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const slug = params.slug as string;
  if (!slug) {
    return Response.json({ error: 'slug obrigatorio' }, { status: 400 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'JSON invalido' }, { status: 400 });
  }

  const isFeatured = body.is_featured ? 1 : 0;

  try {
    const post = await env.DB
      .prepare(`SELECT slug, title, status FROM posts_meta WHERE slug = ?`)
      .bind(slug)
      .first<{ slug: string; title: string; status: string }>();

    if (!post) {
      return Response.json({ error: 'Post nao encontrado' }, { status: 404 });
    }
    if (post.status !== 'published') {
      return Response.json(
        { error: 'Apenas posts publicados podem ser destacados' },
        { status: 400 }
      );
    }

    const now = Date.now();

    await env.DB
      .prepare(`UPDATE posts_meta SET is_featured = ?, updated_at = ? WHERE slug = ?`)
      .bind(isFeatured, now, slug)
      .run();

    return Response.json({
      ok: true,
      slug,
      is_featured: isFeatured === 1,
    });
  } catch (err: any) {
    console.error('Feature toggle error:', err);
    return Response.json(
      { error: err.message || 'Erro ao alterar destaque' },
      { status: 500 }
    );
  }
};
