import type { Env } from '../_utils/db';
import { requireAuth } from '../_utils/require-auth';
import { deleteFile } from '../_utils/github';

// GET    /api/posts/:slug — busca post completo de posts_meta
// PUT    /api/posts/:slug — atualiza post
// DELETE /api/posts/:slug — soft-delete (status='deleted')

const UPDATABLE_FIELDS = [
  'title', 'description', 'content_md', 'hero_image_url',
  'focus_keyword', 'meta_title', 'meta_description'
];

export const onRequestGet: PagesFunction<Env> = async ({ request, env, params }) => {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const slug = params.slug as string;
  const post = await env.DB.prepare(`
    SELECT pm.*, u.name as author_name
    FROM posts_meta pm
    LEFT JOIN users u ON u.id = pm.author_id
    WHERE pm.slug = ? AND pm.status != 'deleted'
  `).bind(slug).first();

  if (!post) {
    return Response.json({ error: 'Post não encontrado' }, { status: 404 });
  }

  // git_synced: edits no painel vs último sync com Git (coluna synced_at)
  const updated = Number(post.updated_at || 0);
  const synced = Number(post.synced_at || 0);
  const git_synced = updated <= synced;

  // is_featured ja vem em pm.* (0/1) — UI faz cast pra boolean se quiser
  return Response.json({ post: { ...post, git_synced } });
};

export const onRequestPut: PagesFunction<Env> = async ({ request, env, params }) => {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const slug = params.slug as string;
  const body = await request.json() as any;
  const now = Date.now();

  const sets: string[] = [];
  const values: any[] = [];

  for (const f of UPDATABLE_FIELDS) {
    if (body[f] !== undefined) {
      sets.push(`${f} = ?`);
      values.push(body[f]);
    }
  }

  if (body.categorias !== undefined) {
    sets.push('categorias = ?');
    values.push(typeof body.categorias === 'string' ? body.categorias : JSON.stringify(body.categorias));
  }

  // published_at: aceita timestamp ms; passado/presente apenas (futuro = fase 2).
  if (body.published_at !== undefined && body.published_at !== null) {
    const v = Number(body.published_at);
    if (!Number.isFinite(v) || v <= 0) {
      return Response.json({ error: 'published_at inválido' }, { status: 400 });
    }
    if (v > now + 60_000) {
      return Response.json({ error: 'published_at no futuro ainda não é suportado (fase 2)' }, { status: 400 });
    }
    sets.push('published_at = ?');
    values.push(v);
  }

  if (sets.length === 0) {
    return Response.json({ error: 'Nenhum campo pra atualizar' }, { status: 400 });
  }

  sets.push('updated_at = ?');
  values.push(now);
  values.push(slug);

  const result = await env.DB.prepare(
    `UPDATE posts_meta SET ${sets.join(', ')} WHERE slug = ? AND status != 'deleted'`
  ).bind(...values).run();

  if (!result.success) {
    return Response.json({ error: 'Falha ao atualizar' }, { status: 500 });
  }

  // meta.changes pode ser undefined em alguns drivers — checagem leve
  return Response.json({
    ok: true,
    updated_at: now,
    git_synced: false, // se editou, agora dessincronizou
  });
};

export const onRequestDelete: PagesFunction<Env> = async ({ request, env, params }) => {
  const auth = await requireAuth(request, env);
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
    if (post.status === 'deleted') {
      return Response.json({ ok: true, slug, message: 'Post ja estava deletado' });
    }

    const githubPath = post.github_path || `src/content/blog/${slug}.md`;
    const now = Date.now();

    // 1. Soft-delete no D1 primeiro (post some do painel mesmo se Git falhar)
    await env.DB.prepare(
      `UPDATE posts_meta SET status = 'deleted', updated_at = ? WHERE slug = ?`
    ).bind(now, slug).run();

    // 2. Remove do Git
    let gitResult: { sha: string; commit_url: string; html_url: string } | null = null;
    let gitWarning: string | null = null;
    try {
      gitResult = await deleteFile(env, {
        path: githubPath,
        message: `chore(post): remove "${post.title}"`,
      });
    } catch (gitErr: any) {
      const msg = gitErr?.message || String(gitErr);
      if (msg.includes('arquivo nao existe no Git')) {
        // Arquivo ja removido (caso ASI) — nao eh erro fatal
        console.warn(`[DELETE ${slug}] ${msg}`);
        gitWarning = 'Arquivo nao estava no Git';
      } else {
        // Falha real do Git — D1 ja soft-deletado, sinaliza 207
        console.error(`[DELETE ${slug}] Git falhou:`, msg);
        return Response.json({
          ok: false,
          slug,
          d1_deleted: true,
          git_deleted: false,
          error: `D1 ok, Git falhou: ${msg}`,
        }, { status: 207 });
      }
    }

    return Response.json({
      ok: true,
      slug,
      d1_deleted: true,
      git_deleted: !!gitResult,
      commit_url: gitResult?.html_url || gitResult?.commit_url,
      ...(gitWarning ? { warning: gitWarning } : {}),
    });
  } catch (err: any) {
    console.error('DELETE error:', err);
    return Response.json({ error: err?.message || 'Erro ao deletar' }, { status: 500 });
  }
};
