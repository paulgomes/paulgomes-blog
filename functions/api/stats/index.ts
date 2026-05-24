import type { Env } from '../_utils/db';
import { requireAuth } from '../_utils/require-auth';

// GET /api/stats — counters pro dashboard
//   total       → posts_meta (not deleted) + drafts
//   drafts      → drafts.status='draft'
//   scheduled   → drafts.status='scheduled'
//   published   → posts_meta.status='published'
//   unsynced    → posts_meta.status='published' AND updated_at > published_at

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const sql = `
    SELECT
      (SELECT COUNT(*) FROM posts_meta WHERE status != 'deleted') AS posts_total,
      (SELECT COUNT(*) FROM posts_meta WHERE status = 'published') AS published,
      (SELECT COUNT(*) FROM posts_meta WHERE status = 'published' AND updated_at > COALESCE(synced_at, published_at)) AS unsynced,
      (SELECT COUNT(*) FROM posts_meta WHERE status = 'deleted') AS deleted,
      (SELECT COUNT(*) FROM drafts) AS drafts_total,
      (SELECT COUNT(*) FROM drafts WHERE status = 'draft') AS drafts,
      (SELECT COUNT(*) FROM drafts WHERE status = 'scheduled') AS scheduled
  `;
  const row = await env.DB.prepare(sql).first() as any;

  return Response.json({
    total: Number(row?.posts_total || 0) + Number(row?.drafts_total || 0),
    published: Number(row?.published || 0),
    drafts: Number(row?.drafts || 0),
    scheduled: Number(row?.scheduled || 0),
    unsynced: Number(row?.unsynced || 0),
    deleted: Number(row?.deleted || 0),
  });
};
