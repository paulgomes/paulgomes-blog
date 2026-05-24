import type { Env } from '../../_utils/db';
import { requireAuth } from '../../_utils/require-auth';
import { generateId } from '../../_utils/crypto';

// POST /api/menus/items
// Body: { menu_type, parent_id?, label, url, sort_order?, open_new_tab?, is_hidden? }

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const body = await request.json() as any;
  const menu_type = body.menu_type;
  if (menu_type !== 'header' && menu_type !== 'footer') {
    return Response.json({ error: 'menu_type deve ser "header" ou "footer"' }, { status: 400 });
  }
  if (!body.label || typeof body.label !== 'string') {
    return Response.json({ error: 'label obrigatório' }, { status: 400 });
  }
  if (typeof body.url !== 'string') {
    return Response.json({ error: 'url obrigatório' }, { status: 400 });
  }

  const parent_id: string | null = body.parent_id ?? null;

  // Valida parent: existe? mesmo menu_type?
  if (parent_id) {
    const parent = await env.DB
      .prepare('SELECT id, menu_type FROM menu_items WHERE id = ?')
      .bind(parent_id)
      .first<{ id: string; menu_type: string }>();
    if (!parent) return Response.json({ error: 'parent_id não existe' }, { status: 400 });
    if (parent.menu_type !== menu_type) {
      return Response.json({ error: 'parent_id é de outro menu_type' }, { status: 400 });
    }
  }

  // sort_order auto: max + 1 do mesmo grupo
  let sort_order: number;
  if (typeof body.sort_order === 'number') {
    sort_order = body.sort_order;
  } else {
    const row = parent_id
      ? await env.DB.prepare('SELECT COALESCE(MAX(sort_order), -1) AS m FROM menu_items WHERE menu_type = ? AND parent_id = ?').bind(menu_type, parent_id).first<{ m: number }>()
      : await env.DB.prepare('SELECT COALESCE(MAX(sort_order), -1) AS m FROM menu_items WHERE menu_type = ? AND parent_id IS NULL').bind(menu_type).first<{ m: number }>();
    sort_order = (row?.m ?? -1) + 1;
  }

  const id = generateId();
  const now = Date.now();
  const open_new_tab = body.open_new_tab ? 1 : 0;
  const is_hidden = body.is_hidden ? 1 : 0;

  await env.DB
    .prepare(`INSERT INTO menu_items
      (id, menu_type, parent_id, label, url, sort_order, open_new_tab, is_hidden, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(id, menu_type, parent_id, body.label, body.url, sort_order, open_new_tab, is_hidden, now, now)
    .run();

  const item = await env.DB.prepare('SELECT * FROM menu_items WHERE id = ?').bind(id).first();
  return Response.json({ ok: true, id, item }, { status: 201 });
};
