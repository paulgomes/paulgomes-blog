import type { Env } from '../_utils/db';
import { requireAuth } from '../_utils/require-auth';
import { requireRole } from '../_utils/require-role';
import { audit } from '../_utils/audit';

// GET /api/config  → { head_snippet, social }
// PUT /api/config  (admin) → salva no D1 (site_config). Aplica no site após /api/config/sync.

const DEFAULT_SOCIAL: Record<string, string> = { linkedin: '', instagram: '', youtube: '', x: '', email: '' };

async function readConfig(env: Env) {
  const [snip, social] = await Promise.all([
    env.DB.prepare("SELECT value FROM site_config WHERE key = 'site_head_snippet'").first<{ value: string }>(),
    env.DB.prepare("SELECT value FROM site_config WHERE key = 'site_social'").first<{ value: string }>(),
  ]);
  let socialObj = { ...DEFAULT_SOCIAL };
  if (social?.value) { try { socialObj = { ...DEFAULT_SOCIAL, ...JSON.parse(social.value) }; } catch { /* ignore */ } }
  return { head_snippet: snip?.value || '', social: socialObj };
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;
  return Response.json(await readConfig(env));
};

export const onRequestPut: PagesFunction<Env> = async ({ request, env }) => {
  const auth = await requireRole(request, env, 'admin');
  if (auth instanceof Response) return auth;

  const body = (await request.json().catch(() => null)) as { head_snippet?: string; social?: Record<string, string> } | null;
  if (!body) return Response.json({ error: 'body inválido' }, { status: 400 });

  const headSnippet = typeof body.head_snippet === 'string' ? body.head_snippet : '';
  if (headSnippet.length > 20000) return Response.json({ error: 'snippet muito longo (máx 20.000 caracteres)' }, { status: 400 });

  // Social: só mantém chaves conhecidas, valores string.
  const incoming = body.social && typeof body.social === 'object' ? body.social : {};
  const social: Record<string, string> = {};
  for (const k of Object.keys(DEFAULT_SOCIAL)) {
    social[k] = typeof incoming[k] === 'string' ? incoming[k].trim() : '';
  }

  const now = Date.now();
  await env.DB.prepare(
    "INSERT INTO site_config (key, value, updated_at) VALUES ('site_head_snippet', ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
  ).bind(headSnippet, now).run();
  await env.DB.prepare(
    "INSERT INTO site_config (key, value, updated_at) VALUES ('site_social', ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
  ).bind(JSON.stringify(social), now).run();

  await audit(env, { userId: auth.user.id, action: 'config.update', entity: 'site_config' });
  return Response.json({ ok: true, updated_at: now });
};
