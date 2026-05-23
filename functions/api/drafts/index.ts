import type { Env } from '../_utils/db';
import { requireAuth } from '../_utils/require-auth';
import { generateId } from '../_utils/crypto';

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const url = new URL(request.url);
  const status = url.searchParams.get('status'); // 'draft' | 'published' | 'all'

  let query = `
    SELECT d.id, d.slug, d.title, d.description, d.status, d.scheduled_at,
           d.published_at, d.created_at, d.updated_at, d.category,
           u.name as author_name
    FROM drafts d
    LEFT JOIN users u ON u.id = d.author_id
  `;
  const params: any[] = [];

  if (status && status !== 'all') {
    query += ' WHERE d.status = ?';
    params.push(status);
  }
  query += ' ORDER BY d.updated_at DESC LIMIT 100';

  const result = await env.DB.prepare(query).bind(...params).all();
  return Response.json({ drafts: result.results });
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const body = await request.json() as any;
  const id = generateId();
  const now = Date.now();
  const slug = (body.slug || `rascunho-${id.slice(0, 8)}`).toLowerCase().replace(/[^a-z0-9-]/g, '-');

  await env.DB.prepare(`
    INSERT INTO drafts (id, slug, title, description, content_md, hero_image_url,
                        category, tags, focus_keyword, meta_title, meta_description,
                        author_id, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)
  `).bind(
    id, slug,
    body.title || 'Sem título',
    body.description || '',
    body.content_md || '',
    body.hero_image_url || null,
    body.category || null,
    JSON.stringify(body.tags || []),
    body.focus_keyword || null,
    body.meta_title || null,
    body.meta_description || null,
    auth.user.id,
    now, now
  ).run();

  return Response.json({ id, slug });
};
