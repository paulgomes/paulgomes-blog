import type { Env } from '../_utils/db';
import { publishDraft } from '../_utils/publish-draft';

// POST /api/cron/publish-scheduled
//
// Publica os posts agendados cujo horário já chegou. Autenticado por CRON_SECRET
// (header Authorization: Bearer …), NÃO por sessão — é chamado pelo GitHub Actions
// agendado, fora do navegador. Liberado no _middleware (LIMITE #6) e protegido aqui
// pelo segredo. Idempotente: cada draft publicado é removido, então não republica.
const MAX_PER_RUN = 10;

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const secret = (env as any).CRON_SECRET as string | undefined;
  if (!secret) {
    return Response.json({ error: 'CRON_SECRET não configurado no Cloudflare' }, { status: 503 });
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'não autorizado' }, { status: 401 });
  }

  const now = Date.now();
  const due = await env.DB.prepare(`
    SELECT d.*, u.name as author_name
    FROM drafts d
    LEFT JOIN users u ON u.id = d.author_id
    WHERE d.status = 'scheduled' AND d.scheduled_at IS NOT NULL AND d.scheduled_at <= ?
    ORDER BY d.scheduled_at ASC
    LIMIT ?
  `).bind(now, MAX_PER_RUN).all<any>();

  const drafts = due.results || [];
  const published: string[] = [];
  const failed: { slug: string; error: string }[] = [];

  for (const draft of drafts) {
    if (!draft.title || !draft.slug || !draft.content_md) {
      failed.push({ slug: draft.slug || `draft#${draft.id}`, error: 'campos obrigatórios faltando' });
      continue;
    }
    try {
      // Publica com o horário planejado (não "agora") para o published_at refletir o agendamento.
      await publishDraft(env, draft, Number(draft.scheduled_at) || now);
      published.push(draft.slug);
    } catch (err: any) {
      console.error(`[cron] Falha ao publicar agendado ${draft.slug}:`, err);
      failed.push({ slug: draft.slug, error: err.message || 'erro' });
    }
  }

  return Response.json({ ok: true, checked_at: now, due: drafts.length, published, failed });
};
