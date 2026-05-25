import type { Env } from '../_utils/db';
import { requireAuth } from '../_utils/require-auth';

// GET    /api/categories/:id  -> single
// PUT    /api/categories/:id  -> body { name?, sort_order? }
// DELETE /api/categories/:id  -> hard delete (bloqueia se ha posts associados)

function slugifyTag(name: string): string {
  return String(name)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function countPostsByTag(env: Env, name: string): Promise<number> {
  const row = await env.DB
    .prepare(`SELECT tags FROM posts_meta WHERE status = 'published' AND tags LIKE ?`)
    .bind(`%"${name}"%`)
    .all<{ tags: string | null }>();
  // double-check parsing JSON pra exact match (evita falso positivo se outra categoria tem name contido)
  let n = 0;
  for (const r of row.results || []) {
    let arr: string[] = [];
    try { arr = typeof r.tags === 'string' ? JSON.parse(r.tags) : (r.tags || []); } catch { arr = []; }
    if (arr.includes(name)) n++;
  }
  return n;
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env, params }) => {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const id = params.id as string;
  const cat = await env.DB.prepare(`SELECT * FROM categories WHERE id = ?`).bind(id).first();
  if (!cat) return Response.json({ error: 'Categoria nao encontrada' }, { status: 404 });
  return Response.json({ category: cat });
};

export const onRequestPut: PagesFunction<Env> = async ({ request, env, params }) => {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const id = params.id as string;
  let body: any;
  try { body = await request.json(); } catch { return Response.json({ error: 'JSON invalido' }, { status: 400 }); }

  const existing = await env.DB
    .prepare(`SELECT id, name, slug FROM categories WHERE id = ?`)
    .bind(id)
    .first<{ id: string; name: string; slug: string }>();
  if (!existing) return Response.json({ error: 'Categoria nao encontrada' }, { status: 404 });

  const now = Date.now();
  const sets: string[] = [];
  const values: any[] = [];
  let renamedFrom: string | null = null;
  let renamedTo: string | null = null;
  let newSlug: string | null = null;

  if (body.name !== undefined) {
    const newName = String(body.name).trim();
    if (!newName) return Response.json({ error: 'name nao pode ser vazio' }, { status: 400 });
    if (newName.length > 40) return Response.json({ error: 'name muito longo (max 40)' }, { status: 400 });

    if (newName !== existing.name) {
      const slug = slugifyTag(newName);
      if (!slug) return Response.json({ error: 'name nao gera slug valido' }, { status: 400 });

      // Conflito com outra categoria
      const dup = await env.DB
        .prepare(`SELECT id FROM categories WHERE (name = ? OR slug = ?) AND id != ? LIMIT 1`)
        .bind(newName, slug, id)
        .first();
      if (dup) return Response.json({ error: `Outra categoria ja usa name "${newName}" ou slug "${slug}"` }, { status: 409 });

      renamedFrom = existing.name;
      renamedTo = newName;
      newSlug = slug;
      sets.push('name = ?'); values.push(newName);
      sets.push('slug = ?'); values.push(slug);
    }
  }

  if (body.sort_order !== undefined) {
    const n = Number(body.sort_order);
    if (!Number.isFinite(n)) return Response.json({ error: 'sort_order deve ser numero' }, { status: 400 });
    sets.push('sort_order = ?'); values.push(n);
  }

  if (sets.length === 0) {
    return Response.json({ error: 'Nada pra atualizar' }, { status: 400 });
  }

  sets.push('updated_at = ?'); values.push(now);
  values.push(id);

  try {
    await env.DB.prepare(`UPDATE categories SET ${sets.join(', ')} WHERE id = ?`).bind(...values).run();

    // Cascata: se renomeou name, atualiza posts_meta.tags em D1
    let cascade_d1_updates = 0;
    let cascade_pending_syncs: string[] = [];
    if (renamedFrom && renamedTo) {
      const oldQuote = JSON.stringify(renamedFrom);
      const newQuote = JSON.stringify(renamedTo);
      const affected = await env.DB
        .prepare(`SELECT slug FROM posts_meta WHERE status = 'published' AND tags LIKE ?`)
        .bind(`%${oldQuote}%`)
        .all<{ slug: string }>();
      const slugs = (affected.results || []).map((r) => r.slug);

      if (slugs.length > 0) {
        // Update em D1: REPLACE("OldName" por "NewName") em todos
        const upd = await env.DB
          .prepare(`UPDATE posts_meta SET tags = REPLACE(tags, ?, ?), updated_at = ? WHERE status = 'published' AND tags LIKE ?`)
          .bind(oldQuote, newQuote, now, `%${oldQuote}%`)
          .run();
        cascade_d1_updates = upd.meta?.changes || slugs.length;
        // Sync individual de cada post NAO eh feito aqui (timeout risk).
        // Frontend ou /api/categories/sync subsequente sincroniza .md depois.
        cascade_pending_syncs = slugs;
      }
    }

    const updated = await env.DB.prepare(`SELECT * FROM categories WHERE id = ?`).bind(id).first();
    return Response.json({
      ok: true,
      category: updated,
      cascade: {
        renamed_from: renamedFrom,
        renamed_to: renamedTo,
        d1_updates: cascade_d1_updates,
        pending_syncs: cascade_pending_syncs,
      },
    });
  } catch (err: any) {
    console.error('Categories PUT error:', err);
    return Response.json({ error: err?.message || 'Erro ao atualizar' }, { status: 500 });
  }
};

export const onRequestDelete: PagesFunction<Env> = async ({ request, env, params }) => {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const id = params.id as string;
  const cat = await env.DB
    .prepare(`SELECT name FROM categories WHERE id = ?`)
    .bind(id)
    .first<{ name: string }>();
  if (!cat) return Response.json({ error: 'Categoria nao encontrada' }, { status: 404 });

  // Bloqueia se ha posts associados
  const count = await countPostsByTag(env, cat.name);
  if (count > 0) {
    return Response.json({
      error: `${count} post(s) usam essa categoria. Reatribua antes de excluir.`,
      count,
    }, { status: 400 });
  }

  // Bloqueia se for a ultima categoria (z.enum precisa de >=1 elemento)
  const totalRow = await env.DB.prepare(`SELECT COUNT(*) AS n FROM categories`).first<{ n: number }>();
  if ((totalRow?.n ?? 0) <= 1) {
    return Response.json({ error: 'Nao pode excluir a ultima categoria (schema Zod requer >= 1)' }, { status: 400 });
  }

  try {
    await env.DB.prepare(`DELETE FROM categories WHERE id = ?`).bind(id).run();
    return Response.json({ ok: true, deleted_id: id });
  } catch (err: any) {
    console.error('Categories DELETE error:', err);
    return Response.json({ error: err?.message || 'Erro ao excluir' }, { status: 500 });
  }
};
