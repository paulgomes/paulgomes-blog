import type { Env } from '../_utils/db';
import { requireRole } from '../_utils/require-role';
import { commitFile } from '../_utils/github';

// POST /api/config/sync (admin)
// Lê site_config (snippet + social) e regenera src/data/site-config.json (commit → rebuild).
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const auth = await requireRole(request, env, 'admin');
  if (auth instanceof Response) return auth;

  const [snip, social] = await Promise.all([
    env.DB.prepare("SELECT value FROM site_config WHERE key = 'site_head_snippet'").first<{ value: string }>(),
    env.DB.prepare("SELECT value FROM site_config WHERE key = 'site_social'").first<{ value: string }>(),
  ]);

  let socialObj: Record<string, string> = {};
  if (social?.value) { try { socialObj = JSON.parse(social.value); } catch { /* ignore */ } }

  const synced_at = Date.now();
  const json = JSON.stringify(
    { head_snippet: snip?.value || '', social: socialObj, synced_at },
    null,
    2,
  ) + '\n';

  try {
    const result = await commitFile(env, {
      path: 'src/data/site-config.json',
      content: json,
      message: 'sync(config): atualiza snippets e redes sociais do site',
    });
    return Response.json({
      ok: true,
      synced_at,
      commit_url: result.html_url,
      message: 'Configurações publicadas. Cloudflare vai rebuildar em ~1-2 min.',
    });
  } catch (err: any) {
    console.error('Config sync error:', err);
    return Response.json({ error: err.message || 'Erro ao publicar configurações' }, { status: 500 });
  }
};
