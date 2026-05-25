import type { Env } from '../_utils/db';
import { requireAuth } from '../_utils/require-auth';

// GET  /api/categorias  -> { ok, categories: [{ id, name, slug, sort_order, count_posts }] }
// POST /api/categorias  -> body { name } -> cria com slug auto-gerado

function slugifyCategoria(name: string): string {
  return String(name)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  try {
    const cats = await env.DB
      .prepare(`SELECT id, name, slug, sort_order, created_at, updated_at FROM categories ORDER BY sort_order`)
      .all<{ id: string; name: string; slug: string; sort_order: number; created_at: number; updated_at: number }>();

    // count_posts: posts publicados com a categoria no JSON categorias
    const posts = await env.DB
      .prepare(`SELECT categorias FROM posts_meta WHERE status = 'published'`)
      .all<{ categorias: string | null }>();

    const counts: Record<string, number> = {};
    for (const row of posts.results || []) {
      let arr: string[] = [];
      try {
        arr = typeof row.categorias === 'string' ? JSON.parse(row.categorias) : (row.categorias || []);
      } catch { arr = []; }
      for (const t of arr) counts[t] = (counts[t] || 0) + 1;
    }

    const categories = (cats.results || []).map((c) => ({
      ...c,
      count_posts: counts[c.name] || 0,
    }));

    return Response.json({ ok: true, categories });
  } catch (err: any) {
    console.error('Categorias GET error:', err);
    return Response.json({ error: err?.message || 'Erro ao listar categorias' }, { status: 500 });
  }
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  let body: any;
  try { body = await request.json(); } catch { return Response.json({ error: 'JSON invalido' }, { status: 400 }); }

  const name = String(body?.name || '').trim();
  if (!name) return Response.json({ error: 'name obrigatorio' }, { status: 400 });
  if (name.length > 40) return Response.json({ error: 'name muito longo (max 40)' }, { status: 400 });

  const slug = slugifyCategoria(name);
  if (!slug) return Response.json({ error: 'name nao gera slug valido' }, { status: 400 });

  try {
    // UNIQUE em name e slug — antes do INSERT pra mensagem amigavel
    const dup = await env.DB
      .prepare(`SELECT name, slug FROM categories WHERE name = ? OR slug = ? LIMIT 1`)
      .bind(name, slug)
      .first<{ name: string; slug: string }>();
    if (dup) {
      const reason = dup.slug === slug ? `slug "${slug}"` : `nome "${name}"`;
      return Response.json({ error: `Ja existe categoria com ${reason}` }, { status: 409 });
    }

    const id = `cat-${slug}`;
    const now = Date.now();
    const maxRow = await env.DB
      .prepare(`SELECT COALESCE(MAX(sort_order), -1) AS m FROM categories`)
      .first<{ m: number }>();
    const sort_order = (maxRow?.m ?? -1) + 1;

    await env.DB
      .prepare(`INSERT INTO categories (id, name, slug, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`)
      .bind(id, name, slug, sort_order, now, now)
      .run();

    return Response.json({
      ok: true,
      category: { id, name, slug, sort_order, created_at: now, updated_at: now, count_posts: 0 },
    }, { status: 201 });
  } catch (err: any) {
    console.error('Categorias POST error:', err);
    return Response.json({ error: err?.message || 'Erro ao criar categoria' }, { status: 500 });
  }
};
