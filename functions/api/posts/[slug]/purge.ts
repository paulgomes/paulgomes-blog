import type { Env } from '../../_utils/db';
import { requireRole } from '../../_utils/require-role';
import { audit } from '../../_utils/audit';
import { deleteFile } from '../../_utils/github';

// DELETE /api/posts/:slug/purge
// Hard delete: remove definitivamente do D1 e do Git. IRREVERSIVEL.
// Defesa em profundidade: SO funciona em posts ja com status='deleted'.
// Ordem: Git primeiro -> D1 (se Git falhar, D1 fica intacto pra retry).

export const onRequestDelete: PagesFunction<Env> = async ({ request, env, params }) => {
  const auth = await requireRole(request, env, 'admin');
  if (auth instanceof Response) return auth;

  const slug = params.slug as string;
  if (!slug) {
    return Response.json({ error: 'slug obrigatorio' }, { status: 400 });
  }

  try {
    const post = await env.DB.prepare(
      `SELECT slug, title, status, github_path FROM posts_meta WHERE slug = ?`
    ).bind(slug).first<{ slug: string; title: string; status: string; github_path: string | null }>();

    if (!post) {
      return Response.json({ error: 'Post nao encontrado' }, { status: 404 });
    }
    if (post.status !== 'deleted') {
      return Response.json(
        { error: `Purge so pode ser feito em posts deletados. Status atual: ${post.status}. Use DELETE /api/posts/:slug primeiro.` },
        { status: 400 }
      );
    }

    const githubPath = post.github_path || `src/content/blog/${slug}.md`;

    // 1. Tenta remover do Git (pode ja estar fora)
    let gitAlreadyRemoved = false;
    try {
      await deleteFile(env, {
        path: githubPath,
        message: `chore(post): purge definitivo de "${post.title}"`,
      });
    } catch (gitErr: any) {
      const msg = gitErr?.message || String(gitErr);
      if (msg.includes('arquivo nao existe no Git')) {
        gitAlreadyRemoved = true;
        console.warn(`[purge ${slug}] Arquivo ja estava removido do Git`);
      } else {
        // Erro real do Git — NAO purga o D1, retorna 207 pra retry
        console.error(`[purge ${slug}] Git falhou:`, msg);
        return Response.json({
          ok: false,
          error: `Git falhou: ${msg}. D1 NAO foi purgado — tente novamente.`,
        }, { status: 207 });
      }
    }

    // 2. Hard delete no D1
    await env.DB.prepare(`DELETE FROM posts_meta WHERE slug = ?`).bind(slug).run();

    return Response.json({
      ok: true,
      slug,
      title: post.title,
      d1_purged: true,
      git_already_removed: gitAlreadyRemoved,
      message: `Post "${post.title}" removido permanentemente.`,
    });
  } catch (err: any) {
    console.error('Purge error:', err);
    return Response.json({ error: err?.message || 'Erro ao purgar' }, { status: 500 });
  }
};
