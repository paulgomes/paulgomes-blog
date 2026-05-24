import type { Env } from '../../_utils/db';
import { requireAuth } from '../../_utils/require-auth';

// POST /api/posts/:slug/feature
// Body: { is_featured: boolean }
//
// is_featured=true:
//   1. Desmarca featured atual (se existir e for outro post)
//   2. Marca este post como featured
//   3. Retorna { ok, previous: { slug, title } | null }
//
// is_featured=false:
//   1. Desmarca este post
//   2. Retorna { ok }
//
// Atomicidade: D1 batch executa o par de UPDATEs em sequencia atomica —
// nunca ficamos com 0 featured intermediarios visiveis.

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

    let previous: { slug: string; title: string } | null = null;
    const now = Date.now();

    if (isFeatured === 1) {
      const current = await env.DB
        .prepare(`SELECT slug, title FROM posts_meta WHERE is_featured = 1 AND slug != ? LIMIT 1`)
        .bind(slug)
        .first<{ slug: string; title: string }>();

      if (current) {
        previous = { slug: current.slug, title: current.title };
      }

      await env.DB.batch([
        env.DB.prepare(`UPDATE posts_meta SET is_featured = 0, updated_at = ? WHERE is_featured = 1 AND slug != ?`).bind(now, slug),
        env.DB.prepare(`UPDATE posts_meta SET is_featured = 1, updated_at = ? WHERE slug = ?`).bind(now, slug),
      ]);
    } else {
      await env.DB
        .prepare(`UPDATE posts_meta SET is_featured = 0, updated_at = ? WHERE slug = ?`)
        .bind(now, slug)
        .run();
    }

    return Response.json({
      ok: true,
      slug,
      is_featured: isFeatured === 1,
      previous,
    });
  } catch (err: any) {
    console.error('Feature toggle error:', err);
    return Response.json(
      { error: err.message || 'Erro ao alterar destaque' },
      { status: 500 }
    );
  }
};
