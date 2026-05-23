import type { Env } from '../../_utils/db';
import { requireAuth } from '../../_utils/require-auth';

async function getFileSha(env: Env, path: string): Promise<string | null> {
  const res = await fetch(
    `https://api.github.com/repos/${env.GITHUB_REPO}/contents/${path}?ref=${env.GITHUB_BRANCH}`,
    {
      headers: {
        'Authorization': `token ${env.GITHUB_TOKEN}`,
        'User-Agent': 'paulgomes-painel',
        'Accept': 'application/vnd.github.v3+json',
      },
    }
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
  const data = await res.json() as any;
  return data.sha;
}

async function commitFile(env: Env, path: string, content: string, message: string): Promise<string> {
  const existingSha = await getFileSha(env, path);

  const encoder = new TextEncoder();
  const bytes = encoder.encode(content);
  const base64 = btoa(String.fromCharCode(...bytes));

  const body: any = {
    message,
    content: base64,
    branch: env.GITHUB_BRANCH,
  };
  if (existingSha) body.sha = existingSha;

  const res = await fetch(
    `https://api.github.com/repos/${env.GITHUB_REPO}/contents/${path}`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `token ${env.GITHUB_TOKEN}`,
        'User-Agent': 'paulgomes-painel',
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GitHub commit error: ${res.status} ${err}`);
  }

  const data = await res.json() as any;
  return data.content.sha;
}

function buildMarkdown(draft: any): string {
  const tags = draft.tags ? JSON.parse(draft.tags) : [];
  const pubDate = new Date(draft.published_at || Date.now()).toISOString();

  let frontmatter = '---\n';
  frontmatter += `title: ${JSON.stringify(draft.title)}\n`;
  frontmatter += `description: ${JSON.stringify(draft.description || '')}\n`;
  frontmatter += `pubDate: ${JSON.stringify(pubDate)}\n`;
  if (draft.hero_image_url) frontmatter += `heroImage: ${JSON.stringify(draft.hero_image_url)}\n`;
  if (draft.category) frontmatter += `category: ${JSON.stringify(draft.category)}\n`;
  if (tags.length) frontmatter += `tags: ${JSON.stringify(tags)}\n`;
  if (draft.author_name) frontmatter += `author: ${JSON.stringify(draft.author_name)}\n`;
  if (draft.focus_keyword) frontmatter += `focusKeyword: ${JSON.stringify(draft.focus_keyword)}\n`;
  if (draft.meta_title) frontmatter += `metaTitle: ${JSON.stringify(draft.meta_title)}\n`;
  if (draft.meta_description) frontmatter += `metaDescription: ${JSON.stringify(draft.meta_description)}\n`;
  frontmatter += '---\n\n';

  return frontmatter + (draft.content_md || '');
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env, params }) => {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const id = params.id as string;
  const draft = await env.DB.prepare(`
    SELECT d.*, u.name as author_name
    FROM drafts d
    LEFT JOIN users u ON u.id = d.author_id
    WHERE d.id = ?
  `).bind(id).first();

  if (!draft) return Response.json({ error: 'Rascunho não encontrado' }, { status: 404 });
  if (!draft.title || !draft.slug || !draft.content_md) {
    return Response.json({ error: 'Faltam campos obrigatórios (título, slug, conteúdo)' }, { status: 400 });
  }

  const now = Date.now();
  const githubPath = `src/content/blog/${draft.slug}.md`;
  const markdown = buildMarkdown({ ...draft, published_at: now });

  try {
    const sha = await commitFile(
      env,
      githubPath,
      markdown,
      `feat(post): publica "${draft.title}"`
    );

    // Atualiza draft
    await env.DB.prepare(`
      UPDATE drafts SET status = 'published', published_at = ?, updated_at = ? WHERE id = ?
    `).bind(now, now, id).run();

    // Insere/atualiza posts_meta
    await env.DB.prepare(`
      INSERT INTO posts_meta (slug, title, author_id, published_at, github_path, github_sha)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(slug) DO UPDATE SET
        title = excluded.title,
        github_sha = excluded.github_sha
    `).bind(draft.slug, draft.title, draft.author_id, now, githubPath, sha).run();

    return Response.json({
      success: true,
      slug: draft.slug,
      published_at: now,
      preview_url: `https://paulgomes.com.br/blog/${draft.slug}`,
      message: 'Post enviado pro GitHub. Cloudflare rebuild em ~1-2 min.'
    });
  } catch (err: any) {
    console.error('Publish error:', err);
    return Response.json({ error: err.message || 'Erro ao publicar' }, { status: 500 });
  }
};
