import type { Env } from '../_utils/db';
import { requireAuth } from '../_utils/require-auth';
import { generateId } from '../_utils/crypto';

// GET  /api/brands  -> { title, items: [{ id, name, url, logo_url, position }] }
// POST /api/brands  -> { name, url?, logo_url? }  cria marca (position = max+1)

function normalizeUrl(input: unknown): string | null {
  if (!input || typeof input !== 'string') return null;
  const v = input.trim();
  if (!v) return null;
  if (!/^https?:\/\//i.test(v)) return null; // exige protocolo explicito
  return v;
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const [brands, titleRow] = await Promise.all([
    env.DB.prepare('SELECT id, name, url, logo_url, position FROM brands ORDER BY position ASC, created_at ASC').all<{ id: string; name: string; url: string | null; logo_url: string | null; position: number }>(),
    env.DB.prepare("SELECT value FROM site_config WHERE key = 'brands_marquee_title'").first<{ value: string }>(),
  ]);

  return Response.json({
    title: titleRow?.value || 'Marcas que passaram por aqui',
    items: brands.results || [],
  });
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const body = await request.json() as any;
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) {
    return Response.json({ error: 'name obrigatório' }, { status: 400 });
  }
  if (name.length > 60) {
    return Response.json({ error: 'name muito longo (máx 60)' }, { status: 400 });
  }
  const url = normalizeUrl(body.url);
  if (body.url && !url) {
    return Response.json({ error: 'URL inválida (precisa começar com http:// ou https://)' }, { status: 400 });
  }
  const logoUrl = normalizeUrl(body.logo_url);
  if (body.logo_url && !logoUrl) {
    return Response.json({ error: 'logo_url inválida (precisa começar com http:// ou https://)' }, { status: 400 });
  }

  // position auto = max + 1
  const row = await env.DB.prepare('SELECT COALESCE(MAX(position), -1) AS m FROM brands').first<{ m: number }>();
  const position = (row?.m ?? -1) + 1;

  const id = generateId();
  const now = Date.now();
  await env.DB
    .prepare('INSERT INTO brands (id, name, url, logo_url, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(id, name, url, logoUrl, position, now, now)
    .run();

  const item = await env.DB.prepare('SELECT id, name, url, logo_url, position FROM brands WHERE id = ?').bind(id).first();
  return Response.json({ ok: true, id, item }, { status: 201 });
};
