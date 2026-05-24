import type { Env } from '../_utils/db';
import { requireAuth } from '../_utils/require-auth';
import { buildTree, type MenuItem, type MenuItemNode } from '../_utils/menus';
import { commitFile } from '../_utils/github';

// POST /api/menus/sync
// Le menus do D1, filtra is_hidden e (no footer) /privacidade,
// gera src/data/menu-header.json e src/data/menu-footer.json,
// commita os 2 arquivos via Contents API (2 commits sequenciais — Cloudflare debounce 1 build).

const PRIVACY_URL = '/privacidade';

function filterTree(items: MenuItemNode[], menuType: 'header' | 'footer'): MenuItemNode[] {
  return items
    .filter((it) => !it.is_hidden)
    .filter((it) => !(menuType === 'footer' && it.url === PRIVACY_URL))
    .map((it) => ({ ...it, children: filterTree(it.children, menuType) }));
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const [headerRows, footerRows] = await Promise.all([
    env.DB.prepare('SELECT * FROM menu_items WHERE menu_type = ? ORDER BY sort_order').bind('header').all<MenuItem>(),
    env.DB.prepare('SELECT * FROM menu_items WHERE menu_type = ? ORDER BY sort_order').bind('footer').all<MenuItem>(),
  ]);

  const headerTree = filterTree(buildTree(headerRows.results || []), 'header');
  const footerTree = filterTree(buildTree(footerRows.results || []), 'footer');
  const synced_at = Date.now();

  const headerJson = JSON.stringify({ menu_type: 'header', synced_at, items: headerTree }, null, 2) + '\n';
  const footerJson = JSON.stringify({ menu_type: 'footer', synced_at, items: footerTree }, null, 2) + '\n';

  try {
    const headerResult = await commitFile(env, {
      path: 'src/data/menu-header.json',
      content: headerJson,
      message: 'sync(menus): atualiza menu-header',
    });
    const footerResult = await commitFile(env, {
      path: 'src/data/menu-footer.json',
      content: footerJson,
      message: 'sync(menus): atualiza menu-footer',
    });

    return Response.json({
      ok: true,
      synced_at,
      header: { sha: headerResult.sha, commit_url: headerResult.html_url },
      footer: { sha: footerResult.sha, commit_url: footerResult.html_url },
      message: 'Menus sincronizados. Cloudflare vai rebuildar em ~1-2 min.',
    });
  } catch (err: any) {
    console.error('Sync menus error:', err);
    return Response.json({ error: err.message || 'Erro ao sincronizar menus' }, { status: 500 });
  }
};
