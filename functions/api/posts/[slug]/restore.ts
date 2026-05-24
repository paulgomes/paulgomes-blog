import type { Env } from '../../_utils/db';
import { requireAuth } from '../../_utils/require-auth';
import { commitFile, getFileSha, buildMarkdown } from '../../_utils/github';

// POST /api/posts/:slug/restore
// Restaura um post com status='deleted': republica .md no Git + status='published'.
// Falha 422 se content_md=null no D1 (caso posts legacy importados sem corpo).

export const onRequestPost: PagesFunction<Env> = async ({ request, env, params }) => {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const slug = params.slug as string;
  if (!slug) {
    return Response.json({ error: 'slug obrigatorio' }, { status: 400 });
  }

  try {
    const post = await env.DB.prepare(
      `SELECT * FROM posts_meta WHERE slug = ?`
    ).bind(slug).first<any>();

    if (!post) {
      return Response.json({ error: 'Post nao encontrado' }, { status: 404 });
    }
    if (post.status !== 'deleted') {
      return Response.json(
        { error: `Post nao esta deletado (status atual: ${post.status})` },
        { status: 400 }
      );
    }
    if (!post.content_md) {
      return Response.json(
        { error: 'Post sem content_md no D1 — restore impossivel (recuperar manual via Git)' },
        { status: 422 }
      );
    }

    const githubPath = (post.github_path as string) || `src/content/blog/${slug}.md`;

    // Defesa: avisa se arquivo ja existe no Git (vai sobrescrever)
    const existingSha = await getFileSha(env, githubPath);
    if (existingSha) {
      console.warn(`[restore ${slug}] Arquivo ja existe no Git, sobrescrevendo: ${githubPath}`);
    }

    const markdown = buildMarkdown(post);
    const commitResult = await commitFile(env, {
      path: githubPath,
      content: markdown,
      message: `chore(post): restaura "${post.title}"`,
    });

    // Volta pra published, marca synced_at = agora (acabou de commitar)
    const now = Date.now();
    await env.DB.prepare(`
      UPDATE posts_meta
      SET status = 'published', updated_at = ?, synced_at = ?, github_sha = ?, github_path = ?
      WHERE slug = ?
    `).bind(now, now, commitResult.sha, githubPath, slug).run();

    return Response.json({
      ok: true,
      slug,
      title: post.title,
      commit_url: commitResult.html_url,
      message: `Post "${post.title}" restaurado. Rebuild em ~2 min.`,
    });
  } catch (err: any) {
    console.error('Restore error:', err);
    return Response.json({ error: err?.message || 'Erro ao restaurar' }, { status: 500 });
  }
};
