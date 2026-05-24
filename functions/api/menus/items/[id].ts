import type { Env } from '../../_utils/db';
import { requireAuth } from '../../_utils/require-auth';
import { detectCycle } from '../../_utils/menus';

const UPDATABLE_STRING = ['label', 'url'] as const;
const UPDATABLE_INT = ['sort_order', 'open_new_tab', 'is_hidden'] as const;

export const onRequestGet: PagesFunction<Env> = async ({ request, env, params }) => {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const id = params.id as string;
  const item = await env.DB.prepare('SELECT * FROM menu_items WHERE id = ?').bind(id).first();
  if (!item) return Response.json({ error: 'Item não encontrado' }, { status: 404 });
  return Response.json({ item });
};

export const onRequestPut: PagesFunction<Env> = async ({ request, env, params }) => {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const id = params.id as string;
  const body = await request.json() as any;
  const now = Date.now();

  const existing = await env.DB
    .prepare('SELECT id, menu_type FROM menu_items WHERE id = ?')
    .bind(id)
    .first<{ id: string; menu_type: string }>();
  if (!existing) return Response.json({ error: 'Item não encontrado' }, { status: 404 });

  const sets: string[] = [];
  const values: any[] = [];

  for (const f of UPDATABLE_STRING) {
    if (body[f] !== undefined) {
      if (typeof body[f] !== 'string') {
        return Response.json({ error: `${f} deve ser string` }, { status: 400 });
      }
      sets.push(`${f} = ?`);
      values.push(body[f]);
    }
  }

  for (const f of UPDATABLE_INT) {
    if (body[f] !== undefined) {
      const n = Number(body[f]);
      if (!Number.isFinite(n)) {
        return Response.json({ error: `${f} deve ser número` }, { status: 400 });
      }
      sets.push(`${f} = ?`);
      values.push(f === 'open_new_tab' || f === 'is_hidden' ? (n ? 1 : 0) : n);
    }
  }

  // parent_id requer validação extra (ciclo + mesmo menu_type)
  if (body.parent_id !== undefined) {
    const newParentId: string | null = body.parent_id;

    if (newParentId !== null) {
      const parent = await env.DB
        .prepare('SELECT id, menu_type FROM menu_items WHERE id = ?')
        .bind(newParentId)
        .first<{ id: string; menu_type: string }>();
      if (!parent) return Response.json({ error: 'parent_id não existe' }, { status: 400 });
      if (parent.menu_type !== existing.menu_type) {
        return Response.json({ error: 'parent_id é de outro menu_type' }, { status: 400 });
      }
      if (await detectCycle(env, id, newParentId)) {
        return Response.json({ error: 'parent_id criaria ciclo na hierarquia' }, { status: 400 });
      }
    }

    sets.push('parent_id = ?');
    values.push(newParentId);
  }

  if (sets.length === 0) {
    return Response.json({ error: 'Nenhum campo pra atualizar' }, { status: 400 });
  }

  sets.push('updated_at = ?');
  values.push(now);
  values.push(id);

  await env.DB.prepare(`UPDATE menu_items SET ${sets.join(', ')} WHERE id = ?`).bind(...values).run();

  const item = await env.DB.prepare('SELECT * FROM menu_items WHERE id = ?').bind(id).first();
  return Response.json({ ok: true, item });
};

export const onRequestDelete: PagesFunction<Env> = async ({ request, env, params }) => {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const id = params.id as string;

  // Conta filhos antes pra reportar (CASCADE faz o trabalho)
  const countRow = await env.DB
    .prepare('SELECT COUNT(*) AS n FROM menu_items WHERE parent_id = ?')
    .bind(id)
    .first<{ n: number }>();
  const deleted_children_count = Number(countRow?.n || 0);

  const result = await env.DB.prepare('DELETE FROM menu_items WHERE id = ?').bind(id).run();
  if (!result.success) {
    return Response.json({ error: 'Falha ao deletar' }, { status: 500 });
  }

  return Response.json({ ok: true, deleted_id: id, deleted_children_count });
};
