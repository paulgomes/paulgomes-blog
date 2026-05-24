import type { Env } from '../_utils/db';
import { requireAuth } from '../_utils/require-auth';

// POST /api/menus/reorder
// Body: { menu_type, items: [{ id, parent_id, sort_order }, ...] }
// Atualiza em lote (D1 batch). Valida tipo + ciclos antes.

type ReorderItem = { id: string; parent_id: string | null; sort_order: number };

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const body = await request.json() as any;
  const menu_type = body.menu_type;
  if (menu_type !== 'header' && menu_type !== 'footer') {
    return Response.json({ error: 'menu_type deve ser "header" ou "footer"' }, { status: 400 });
  }
  const items: ReorderItem[] = Array.isArray(body.items) ? body.items : [];
  if (items.length === 0) {
    return Response.json({ error: 'items vazio' }, { status: 400 });
  }

  // Carrega todos os items existentes desse menu (pra validar pertencimento)
  const rows = await env.DB
    .prepare('SELECT id, menu_type FROM menu_items WHERE menu_type = ?')
    .bind(menu_type)
    .all<{ id: string; menu_type: string }>();
  const validIds = new Set((rows.results || []).map((r) => r.id));

  // Valida: cada id existe e é do menu_type correto
  const submittedIds = new Set<string>();
  for (const it of items) {
    if (!it.id || typeof it.id !== 'string') {
      return Response.json({ error: 'item sem id' }, { status: 400 });
    }
    if (!validIds.has(it.id)) {
      return Response.json({ error: `id ${it.id} não pertence ao menu_type ${menu_type}` }, { status: 400 });
    }
    if (submittedIds.has(it.id)) {
      return Response.json({ error: `id ${it.id} duplicado no payload` }, { status: 400 });
    }
    submittedIds.add(it.id);
    if (it.parent_id !== null && it.parent_id !== undefined) {
      if (typeof it.parent_id !== 'string' || !validIds.has(it.parent_id)) {
        return Response.json({ error: `parent_id ${it.parent_id} inválido` }, { status: 400 });
      }
      if (it.parent_id === it.id) {
        return Response.json({ error: `item ${it.id} não pode ser pai de si mesmo` }, { status: 400 });
      }
    }
  }

  // Validação de ciclo: monta map id → newParentId apenas com o payload
  // e qualquer item do menu não mencionado mantém seu parent atual.
  // Pra checar ciclo, simula o estado final.
  const finalParent = new Map<string, string | null>();
  // Inicia com estado atual
  const currentRows = await env.DB
    .prepare('SELECT id, parent_id FROM menu_items WHERE menu_type = ?')
    .bind(menu_type)
    .all<{ id: string; parent_id: string | null }>();
  for (const r of currentRows.results || []) finalParent.set(r.id, r.parent_id);
  // Aplica mudanças do payload
  for (const it of items) finalParent.set(it.id, it.parent_id ?? null);

  // Detecta ciclo: pra cada nó, sobe até NULL com Set de visitados
  for (const startId of finalParent.keys()) {
    const seen = new Set<string>();
    let cur: string | null = startId;
    while (cur) {
      if (seen.has(cur)) {
        return Response.json({ error: `ciclo detectado envolvendo ${startId}` }, { status: 400 });
      }
      seen.add(cur);
      cur = finalParent.get(cur) ?? null;
    }
  }

  // Batch update via D1
  const now = Date.now();
  const stmts = items.map((it) =>
    env.DB
      .prepare('UPDATE menu_items SET parent_id = ?, sort_order = ?, updated_at = ? WHERE id = ?')
      .bind(it.parent_id ?? null, it.sort_order, now, it.id)
  );
  await env.DB.batch(stmts);

  return Response.json({ ok: true, updated_count: items.length });
};
