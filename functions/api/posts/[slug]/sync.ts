import type { Env } from '../../_utils/db';
import { requireAuth } from '../../_utils/require-auth';
import { buildMarkdown, commitFile } from '../../_utils/github';

// POST /api/posts/:slug/sync
// Regenera o .md a partir do D1 e commita direto em main.
// Atualiza posts_meta.synced_at + github_sha.

export const onRequestPost: PagesFunction<Env> = async ({ request, env, params }) => {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const slug = params.slug as string;

  const post = await env.DB.prepare(`
    SELECT * FROM posts_meta WHERE slug = ? AND status != 'deleted'
  `).bind(slug).first() as any;

  if (!post) {
    return Response.json({ error: 'Post não encontrado' }, { status: 404 });
  }
  if (!post.content_md) {
    return Response.json({ error: 'Post sem conteúdo pra sincronizar' }, { status: 400 });
  }

  const githubPath = (post.github_path as string) || `src/content/blog/${slug}.md`;
  const markdown = buildMarkdown(post);

  try {
    const result = await commitFile(env, {
      path: githubPath,
      content: markdown,
      message: `sync(painel): ${post.title}`,
    });

    const updatedAt = Number(post.updated_at || Date.now());
    await env.DB.prepare(`
      UPDATE posts_meta
      SET synced_at = ?, github_sha = ?, github_path = ?
      WHERE slug = ?
    `).bind(updatedAt, result.sha, githubPath, slug).run();

    return Response.json({
      ok: true,
      sha: result.sha,
      commit_url: result.html_url,
      synced_at: updatedAt,
      message: 'Sincronizado. Cloudflare vai rebuildar em ~1-2 min.',
    });
  } catch (err: any) {
    console.error('Sync error:', err);
    return Response.json({ error: err.message || 'Erro ao sincronizar' }, { status: 500 });
  }
};
