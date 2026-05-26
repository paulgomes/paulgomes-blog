import type { Env } from '../_utils/db';
import { requireAuth } from '../_utils/require-auth';

// PUT    /api/brands/:id  -> { name?, url? }
// DELETE /api/brands/:id

function normalizeUrl(input: unknown): string | null {
  if (!input || typeof input !== 'string') return null;
  const v = input.trim();
  if (!v) return null;
  if (!/^https?:\/\//i.test(v)) return null;
  return v;
}

export const onRequestPut: PagesFunction<Env> = async ({ request, env, params }) => {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const id = params.id as string;
  const body = await request.json() as any;
  const sets: string[] = [];
  const values: any[] = [];

  if (body.name !== undefined) {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) return Response.json({ error: 'name não pode ficar vazio' }, { status: 400 });
    if (name.length > 60) return Response.json({ error: 'name muito longo (máx 60)' }, { status: 400 });
    sets.push('name = ?');
    values.push(name);
  }

  if (body.url !== undefined) {
    // null/'' apaga; string com http(s) salva; string sem protocolo erra
    if (body.url === null || body.url === '') {
      sets.push('url = NULL');
    } else {
      const url = normalizeUrl(body.url);
      if (!url) return Response.json({ error: 'URL inválida (precisa começar com http:// ou https://)' }, { status: 400 });
      sets.push('url = ?');
      values.push(url);
    }
  }

  if (body.logo_url !== undefined) {
    if (body.logo_url === null || body.logo_url === '') {
      sets.push('logo_url = NULL');
    } else {
      const logoUrl = normalizeUrl(body.logo_url);
      if (!logoUrl) return Response.json({ error: 'logo_url inválida (precisa começar com http:// ou https://)' }, { status: 400 });
      sets.push('logo_url = ?');
      values.push(logoUrl);
    }
  }

  if (sets.length === 0) {
    return Response.json({ error: 'nenhum campo pra atualizar' }, { status: 400 });
  }

  sets.push('updated_at = ?');
  values.push(Date.now());
  values.push(id);

  const result = await env.DB
    .prepare(`UPDATE brands SET ${sets.join(', ')} WHERE id = ?`)
    .bind(...values)
    .run();

  if (!result.success) {
    return Response.json({ error: 'Falha ao atualizar' }, { status: 500 });
  }

  const item = await env.DB.prepare('SELECT id, name, url, logo_url, position FROM brands WHERE id = ?').bind(id).first();
  if (!item) return Response.json({ error: 'Marca não encontrada' }, { status: 404 });

  return Response.json({ ok: true, item });
};

export const onRequestDelete: PagesFunction<Env> = async ({ request, env, params }) => {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const id = params.id as string;
  const result = await env.DB.prepare('DELETE FROM brands WHERE id = ?').bind(id).run();
  if (!result.success) {
    return Response.json({ error: 'Falha ao excluir' }, { status: 500 });
  }
  return Response.json({ ok: true });
};
