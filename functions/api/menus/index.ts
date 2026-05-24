import type { Env } from '../_utils/db';
import { requireAuth } from '../_utils/require-auth';
import { buildTree, type MenuItem } from '../_utils/menus';

// GET /api/menus?type=header  → { items: [...tree] }
// GET /api/menus?type=footer  → { items: [...tree] }
// GET /api/menus              → { header: [...], footer: [...] }

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const url = new URL(request.url);
  const type = url.searchParams.get('type');

  if (type === 'header' || type === 'footer') {
    const rows = await env.DB
      .prepare('SELECT * FROM menu_items WHERE menu_type = ? ORDER BY sort_order')
      .bind(type)
      .all<MenuItem>();
    return Response.json({ items: buildTree(rows.results || []) });
  }

  // Sem param: retorna ambos
  const [h, f] = await Promise.all([
    env.DB.prepare('SELECT * FROM menu_items WHERE menu_type = ? ORDER BY sort_order').bind('header').all<MenuItem>(),
    env.DB.prepare('SELECT * FROM menu_items WHERE menu_type = ? ORDER BY sort_order').bind('footer').all<MenuItem>(),
  ]);

  return Response.json({
    header: buildTree(h.results || []),
    footer: buildTree(f.results || []),
  });
};
