import type { Env } from '../_utils/db';
import { requireAuth } from '../_utils/require-auth';

// MANTENHA EM SYNC com src/lib/tags.ts
// (functions/ e src/ tem bundlers separados em Cloudflare Pages)
const TAGS = ['IA', 'GEO', 'SEO', 'Branding', 'Tecnologia', 'Negócios'] as const;

// GET /api/tags/stats
// Retorna contagem de posts publicados por tag, com slugs e percentuais.

type PostRow = { slug: string; title: string; tags: string | null; published_at: number | null };

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  try {
    const result = await env.DB.prepare(`
      SELECT slug, title, tags, published_at
      FROM posts_meta
      WHERE status = 'published'
      ORDER BY published_at DESC
    `).all<PostRow>();

    const posts = result.results || [];
    const total = posts.length;

    const tagCounts: Record<string, { count: number; posts: Array<{ slug: string; title: string; published_at: number | null }> }> = {};
    for (const tag of TAGS) tagCounts[tag] = { count: 0, posts: [] };

    for (const post of posts) {
      let postTags: string[] = [];
      try {
        postTags = typeof post.tags === 'string' ? JSON.parse(post.tags) : (post.tags || []);
      } catch {
        postTags = [];
      }
      for (const tag of postTags) {
        if (tagCounts[tag]) {
          tagCounts[tag].count++;
          tagCounts[tag].posts.push({
            slug: post.slug,
            title: post.title,
            published_at: post.published_at,
          });
        }
      }
    }

    const tags = TAGS.map((name) => ({
      name,
      slug: slugifyTag(name),
      count: tagCounts[name].count,
      percentage: total > 0 ? Math.round((tagCounts[name].count / total) * 100) : 0,
      posts: tagCounts[name].posts,
    }));

    return Response.json({
      ok: true,
      total_posts: total,
      tags,
    });
  } catch (err: any) {
    console.error('Tags stats error:', err);
    return Response.json(
      { error: err?.message || 'Erro ao buscar stats' },
      { status: 500 }
    );
  }
};

function slugifyTag(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
