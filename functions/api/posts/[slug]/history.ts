import type { Env } from '../../_utils/db';
import { requireAuth } from '../../_utils/require-auth';

// GET /api/posts/:slug/history?limit=20
// Histórico de versões: commits do GitHub que tocaram src/content/blog/<slug>.md.
// Read-only (usa GITHUB_TOKEN). Fonte = histórico do Git (já é a fonte da verdade do build).
export const onRequestGet: PagesFunction<Env> = async ({ request, env, params }) => {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const slug = params.slug as string;
  if (!slug) return Response.json({ error: 'slug obrigatorio' }, { status: 400 });

  const url = new URL(request.url);
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)));
  const path = `src/content/blog/${slug}.md`;

  const api =
    `https://api.github.com/repos/${env.GITHUB_REPO}/commits` +
    `?path=${encodeURIComponent(path)}&sha=${encodeURIComponent(env.GITHUB_BRANCH)}&per_page=${limit}`;

  let res: Response;
  try {
    res = await fetch(api, {
      headers: {
        'User-Agent': 'paulgomes-painel',
        Accept: 'application/vnd.github.v3+json',
        Authorization: `token ${env.GITHUB_TOKEN}`,
      },
    });
  } catch (err) {
    console.error('history fetch error', err);
    return Response.json({ error: 'Falha de rede ao buscar histórico.' }, { status: 502 });
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    console.error(`GitHub commits ${res.status}:`, detail.slice(0, 300));
    return Response.json({ error: 'Falha ao buscar histórico no GitHub.' }, { status: 502 });
  }

  const commits = (await res.json().catch(() => [])) as any[];
  const versions = (Array.isArray(commits) ? commits : []).map((c) => ({
    sha: c.sha,
    shortSha: typeof c.sha === 'string' ? c.sha.slice(0, 7) : '',
    message: (c.commit?.message || '').split('\n')[0],
    author: c.commit?.author?.name || c.author?.login || '',
    date: c.commit?.author?.date || '',
    url: c.html_url || '',
  }));

  return Response.json({ slug, versions });
};
