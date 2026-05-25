import type { Env } from '../_utils/db';
import { requireAuth } from '../_utils/require-auth';

// GET /api/posts?q=<query>&categoria=<nome>&status=<draft|published|scheduled|deleted|all>&page=<n>&per_page=50
//
// Lista UNIFICADA de drafts + posts_meta com filtros.
// Retorna items[] com discriminador `type: 'post' | 'draft'`.

const DEFAULT_PER_PAGE = 50;
const MAX_PER_PAGE = 100;

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const url = new URL(request.url);
  const q = (url.searchParams.get('q') || '').trim();
  const categoria = (url.searchParams.get('categoria') || '').trim();
  const statusParam = (url.searchParams.get('status') || 'all').trim();
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const perPageReq = parseInt(url.searchParams.get('per_page') || String(DEFAULT_PER_PAGE), 10);
  const perPage = Math.min(MAX_PER_PAGE, Math.max(1, perPageReq));
  const offset = (page - 1) * perPage;

  // Constrói WHERE comum
  const likeQ = q ? `%${q}%` : null;
  const likeCategoria = categoria ? `%"${categoria}"%` : null;

  // Query SELECT para posts_meta (apenas publicados, exclui deletados)
  const postsSelect = `
    SELECT
      'post:' || slug AS id,
      'post' AS type,
      slug,
      title,
      description,
      hero_image_url,
      categorias,
      status,
      published_at,
      updated_at,
      CASE WHEN updated_at > COALESCE(synced_at, published_at) THEN 0 ELSE 1 END AS git_synced
    FROM posts_meta
    WHERE status != 'deleted'
    ${likeQ ? "AND title LIKE ?" : ""}
    ${likeCategoria ? "AND categorias LIKE ?" : ""}
  `;

  // Query SELECT para drafts
  const draftsSelect = `
    SELECT
      'draft:' || id AS id,
      'draft' AS type,
      slug,
      title,
      description,
      hero_image_url,
      categorias,
      status,
      published_at,
      updated_at,
      NULL AS git_synced
    FROM drafts
    ${likeQ || likeCategoria ? "WHERE 1=1" : ""}
    ${likeQ ? "AND title LIKE ?" : ""}
    ${likeCategoria ? "AND categorias LIKE ?" : ""}
  `;

  // Monta query final + bindings baseado no status
  let sql: string;
  let bindings: any[] = [];

  if (statusParam === 'published') {
    sql = postsSelect + ' ORDER BY published_at DESC LIMIT ? OFFSET ?';
    if (likeQ) bindings.push(likeQ);
    if (likeCategoria) bindings.push(likeCategoria);
    bindings.push(perPage, offset);
  } else if (statusParam === 'deleted') {
    // Lixeira: so posts_meta com status='deleted' (drafts nao tem lixeira)
    const deletedSelect = `
      SELECT
        'post:' || slug AS id,
        'post' AS type,
        slug,
        title,
        description,
        hero_image_url,
        categorias,
        status,
        published_at,
        updated_at,
        0 AS git_synced
      FROM posts_meta
      WHERE status = 'deleted'
      ${likeQ ? "AND title LIKE ?" : ""}
      ${likeCategoria ? "AND categorias LIKE ?" : ""}
    `;
    sql = deletedSelect + ' ORDER BY updated_at DESC LIMIT ? OFFSET ?';
    if (likeQ) bindings.push(likeQ);
    if (likeCategoria) bindings.push(likeCategoria);
    bindings.push(perPage, offset);
  } else if (statusParam === 'draft' || statusParam === 'scheduled') {
    // Filtra drafts pelo status específico
    const draftWithStatus = draftsSelect + (likeQ || likeCategoria ? ' AND status = ?' : ' WHERE status = ?');
    sql = draftWithStatus + ' ORDER BY updated_at DESC LIMIT ? OFFSET ?';
    if (likeQ) bindings.push(likeQ);
    if (likeCategoria) bindings.push(likeCategoria);
    bindings.push(statusParam, perPage, offset);
  } else {
    // 'all' — union. Posts ordenam por published_at (updated_at foi sobrescrito
    // em massa pelo backfill SEO); drafts caem no updated_at (sem published_at).
    // Wrap em subquery: SQLite nao aceita expressao no ORDER BY de um UNION direto.
    sql = `SELECT * FROM (${postsSelect} UNION ALL ${draftsSelect})
      ORDER BY CASE WHEN published_at IS NULL THEN updated_at ELSE published_at END DESC
      LIMIT ? OFFSET ?`;
    if (likeQ) bindings.push(likeQ);
    if (likeCategoria) bindings.push(likeCategoria);
    if (likeQ) bindings.push(likeQ);
    if (likeCategoria) bindings.push(likeCategoria);
    bindings.push(perPage, offset);
  }

  const result = await env.DB.prepare(sql).bind(...bindings).all();

  // Calcula total separado
  let totalSql: string;
  let totalBindings: any[] = [];
  if (statusParam === 'published') {
    totalSql = `SELECT COUNT(*) as n FROM posts_meta WHERE status != 'deleted'
      ${likeQ ? "AND title LIKE ?" : ""}
      ${likeCategoria ? "AND categorias LIKE ?" : ""}`;
    if (likeQ) totalBindings.push(likeQ);
    if (likeCategoria) totalBindings.push(likeCategoria);
  } else if (statusParam === 'deleted') {
    totalSql = `SELECT COUNT(*) as n FROM posts_meta WHERE status = 'deleted'
      ${likeQ ? "AND title LIKE ?" : ""}
      ${likeCategoria ? "AND categorias LIKE ?" : ""}`;
    if (likeQ) totalBindings.push(likeQ);
    if (likeCategoria) totalBindings.push(likeCategoria);
  } else if (statusParam === 'draft' || statusParam === 'scheduled') {
    totalSql = `SELECT COUNT(*) as n FROM drafts WHERE status = ?
      ${likeQ ? "AND title LIKE ?" : ""}
      ${likeCategoria ? "AND categorias LIKE ?" : ""}`;
    totalBindings.push(statusParam);
    if (likeQ) totalBindings.push(likeQ);
    if (likeCategoria) totalBindings.push(likeCategoria);
  } else {
    totalSql = `SELECT (
      (SELECT COUNT(*) FROM posts_meta WHERE status != 'deleted'
        ${likeQ ? "AND title LIKE ?" : ""}
        ${likeCategoria ? "AND categorias LIKE ?" : ""})
      +
      (SELECT COUNT(*) FROM drafts
        ${likeQ || likeCategoria ? "WHERE 1=1" : ""}
        ${likeQ ? "AND title LIKE ?" : ""}
        ${likeCategoria ? "AND categorias LIKE ?" : ""})
    ) as n`;
    if (likeQ) totalBindings.push(likeQ);
    if (likeCategoria) totalBindings.push(likeCategoria);
    if (likeQ) totalBindings.push(likeQ);
    if (likeCategoria) totalBindings.push(likeCategoria);
  }

  const totalRow = await env.DB.prepare(totalSql).bind(...totalBindings).first();
  const total = Number(totalRow?.n || 0);

  return Response.json({
    items: result.results || [],
    total,
    page,
    per_page: perPage,
    total_pages: Math.max(1, Math.ceil(total / perPage)),
  });
};
