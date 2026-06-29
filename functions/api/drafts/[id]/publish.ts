import type { Env } from '../../_utils/db';
import { requireAuth } from '../../_utils/require-auth';
import { publishDraft } from '../../_utils/publish-draft';

// POST /api/drafts/:id/publish
//
// Consolida o draft em posts_meta (commit .md + upsert + delete draft) via publishDraft().
// Aceita published_at opcional no corpo (backdate, só passado/presente);
// data futura é agendamento (status='scheduled'), publicada depois pelo cron.
export const onRequestPost: PagesFunction<Env> = async ({ request, env, params }) => {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const id = params.id as string;
  const draft = await env.DB.prepare(`
    SELECT d.*, u.name as author_name
    FROM drafts d
    LEFT JOIN users u ON u.id = d.author_id
    WHERE d.id = ?
  `).bind(id).first<any>();

  if (!draft) return Response.json({ error: 'Rascunho não encontrado' }, { status: 404 });
  if (!draft.title || !draft.slug || !draft.content_md) {
    return Response.json({ error: 'Faltam campos obrigatórios (título, slug, conteúdo)' }, { status: 400 });
  }

  const now = Date.now();
  // Backdate opcional: data "anterior" escolhida no calendário. Só passado/presente —
  // data futura é agendamento, não publicação imediata.
  let publishedAt = now;
  const body = (await request.json().catch(() => null)) as { published_at?: number } | null;
  if (body && typeof body.published_at === 'number' && Number.isFinite(body.published_at) && body.published_at <= now + 60_000) {
    publishedAt = body.published_at;
  }

  try {
    const result = await publishDraft(env, draft, publishedAt);
    return Response.json({
      success: true,
      slug: result.slug,
      published_at: result.published_at,
      preview_url: `https://paulgomes.com.br/${result.slug}`,
      commit_url: result.commit_url,
      message: 'Post publicado. Cloudflare rebuild em ~1-2 min.',
    });
  } catch (err: any) {
    console.error('Publish error:', err);
    return Response.json({ error: err.message || 'Erro ao publicar' }, { status: 500 });
  }
};
