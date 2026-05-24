import type { Env } from '../_utils/db';
import { requireAuth } from '../_utils/require-auth';

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

  if (body.tags !== undefined) {
    sets.push('tags = ?');
    values.push(typeof body.tags === 'string' ? body.tags : JSON.stringify(body.tags));
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
  const now = Date.now();

  await env.DB.prepare(
    `UPDATE posts_meta SET status = 'deleted', updated_at = ? WHERE slug = ?`
  ).bind(now, slug).run();

  return Response.json({ ok: true, soft_deleted: true });
};
