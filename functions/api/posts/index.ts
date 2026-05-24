import type { Env } from '../_utils/db';
import { requireAuth } from '../_utils/require-auth';

// GET /api/posts?q=<query>&tag=<tag>&status=<draft|published|scheduled|all>&page=<n>&per_page=50
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
  const tag = (url.searchParams.get('tag') || '').trim();
  const statusParam = (url.searchParams.get('status') || 'all').trim();
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const perPageReq = parseInt(url.searchParams.get('per_page') || String(DEFAULT_PER_PAGE), 10);
  const perPage = Math.min(MAX_PER_PAGE, Math.max(1, perPageReq));
  const offset = (page - 1) * perPage;

  // Constrói WHERE comum
  const likeQ = q ? `%${q}%` : null;
  const likeTag = tag ? `%"${tag}"%` : null;

  // Query SELECT para posts_meta (apenas publicados, exclui deletados)
  const postsSelect = `
    SELECT
      'post:' || slug AS id,
      'post' AS type,
      slug,
      title,
      description,
      hero_image_url,
      tags,
      status,
      published_at,
      updated_at,
      CASE WHEN updated_at > COALESCE(synced_at, published_at) THEN 0 ELSE 1 END AS git_synced
    FROM posts_meta
    WHERE status != 'deleted'
    ${likeQ ? "AND title LIKE ?" : ""}
    ${likeTag ? "AND tags LIKE ?" : ""}
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
      tags,
      status,
      published_at,
      updated_at,
      NULL AS git_synced
    FROM drafts
    ${likeQ || likeTag ? "WHERE 1=1" : ""}
    ${likeQ ? "AND title LIKE ?" : ""}
    ${likeTag ? "AND tags LIKE ?" : ""}
  `;

  // Monta query final + bindings baseado no status
  let sql: string;
  let bindings: any[] = [];

  if (statusParam === 'published') {
    sql = postsSelect + ' ORDER BY published_at DESC LIMIT ? OFFSET ?';
    if (likeQ) bindings.push(likeQ);
    if (likeTag) bindings.push(likeTag);
    bindings.push(perPage, offset);
  } else if (statusParam === 'draft' || statusParam === 'scheduled') {
    // Filtra drafts pelo status específico
    const draftWithStatus = draftsSelect + (likeQ || likeTag ? ' AND status = ?' : ' WHERE status = ?');
    sql = draftWithStatus + ' ORDER BY updated_at DESC LIMIT ? OFFSET ?';
    if (likeQ) bindings.push(likeQ);
    if (likeTag) bindings.push(likeTag);
    bindings.push(statusParam, perPage, offset);
  } else {
    // 'all' — union
    sql = `${postsSelect} UNION ALL ${draftsSelect} ORDER BY updated_at DESC LIMIT ? OFFSET ?`;
    if (likeQ) bindings.push(likeQ);
    if (likeTag) bindings.push(likeTag);
    if (likeQ) bindings.push(likeQ);
    if (likeTag) bindings.push(likeTag);
    bindings.push(perPage, offset);
  }

  const result = await env.DB.prepare(sql).bind(...bindings).all();

  // Calcula total separado
  let totalSql: string;
  let totalBindings: any[] = [];
  if (statusParam === 'published') {
    totalSql = `SELECT COUNT(*) as n FROM posts_meta WHERE status != 'deleted'
      ${likeQ ? "AND title LIKE ?" : ""}
      ${likeTag ? "AND tags LIKE ?" : ""}`;
    if (likeQ) totalBindings.push(likeQ);
    if (likeTag) totalBindings.push(likeTag);
  } else if (statusParam === 'draft' || statusParam === 'scheduled') {
    totalSql = `SELECT COUNT(*) as n FROM drafts WHERE status = ?
      ${likeQ ? "AND title LIKE ?" : ""}
      ${likeTag ? "AND tags LIKE ?" : ""}`;
    totalBindings.push(statusParam);
    if (likeQ) totalBindings.push(likeQ);
    if (likeTag) totalBindings.push(likeTag);
  } else {
    totalSql = `SELECT (
      (SELECT COUNT(*) FROM posts_meta WHERE status != 'deleted'
        ${likeQ ? "AND title LIKE ?" : ""}
        ${likeTag ? "AND tags LIKE ?" : ""})
      +
      (SELECT COUNT(*) FROM drafts
        ${likeQ || likeTag ? "WHERE 1=1" : ""}
        ${likeQ ? "AND title LIKE ?" : ""}
        ${likeTag ? "AND tags LIKE ?" : ""})
    ) as n`;
    if (likeQ) totalBindings.push(likeQ);
    if (likeTag) totalBindings.push(likeTag);
    if (likeQ) totalBindings.push(likeQ);
    if (likeTag) totalBindings.push(likeTag);
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
