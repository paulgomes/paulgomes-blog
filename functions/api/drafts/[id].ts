import type { Env } from '../_utils/db';
import { requireAuth } from '../_utils/require-auth';

export const onRequestGet: PagesFunction<Env> = async ({ request, env, params }) => {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const id = params.id as string;
  const draft = await env.DB.prepare(`
    SELECT d.*, u.name as author_name
    FROM drafts d
    LEFT JOIN users u ON u.id = d.author_id
    WHERE d.id = ?
  `).bind(id).first();

  if (!draft) return Response.json({ error: 'Não encontrado' }, { status: 404 });
  return Response.json({ draft });
};

export const onRequestPut: PagesFunction<Env> = async ({ request, env, params }) => {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const id = params.id as string;
  const body = await request.json() as any;
  const now = Date.now();

  const fields: string[] = [];
  const values: any[] = [];

  const updatable = ['slug', 'title', 'description', 'content_md', 'hero_image_url', 'hero_image_alt',
                     'category', 'focus_keyword', 'meta_title', 'meta_description', 'scheduled_at', 'status'];

  // status por aqui só alterna entre 'draft' e 'scheduled' (publicar/deletar têm fluxos próprios)
  if (body.status !== undefined && body.status !== 'draft' && body.status !== 'scheduled') {
    return Response.json({ error: 'status inválido (use draft|scheduled)' }, { status: 400 });
  }

  // hero_image_alt: validar max 200
  if (body.hero_image_alt !== undefined) {
    const v = body.hero_image_alt;
    if (v !== null && (typeof v !== 'string' || v.length > 200)) {
      return Response.json({ error: 'hero_image_alt inválido (max 200 chars)' }, { status: 400 });
    }
  }

  for (const f of updatable) {
    if (body[f] !== undefined) {
      fields.push(`${f} = ?`);
      values.push(body[f]);
    }
  }

  if (body.categorias !== undefined) {
    fields.push('categorias = ?');
    values.push(JSON.stringify(body.categorias));
  }

  fields.push('updated_at = ?');
  values.push(now);
  values.push(id);

  await env.DB.prepare(`UPDATE drafts SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run();
  return Response.json({ success: true, updated_at: now });
};

export const onRequestDelete: PagesFunction<Env> = async ({ request, env, params }) => {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const id = params.id as string;
  await env.DB.prepare('DELETE FROM drafts WHERE id = ?').bind(id).run();
  return Response.json({ success: true });
};
