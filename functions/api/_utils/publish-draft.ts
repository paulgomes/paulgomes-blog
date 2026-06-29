import type { Env } from './db';
import { commitFile, buildMarkdown } from './github';

// Publica um draft: commita o .md no Git, faz upsert em posts_meta e remove o draft.
// `publishedAt` é o timestamp de publicação (backdate manual ou horário agendado);
// updated_at/synced_at usam o momento atual. Idempotente via ON CONFLICT(slug):
// republicar preserva o published_at original (curadoria de data fica no INSERT).
//
// Fonte ÚNICA da lógica de publicação. Usado por:
//  - POST /api/drafts/:id/publish  (publicação manual / backdate)
//  - POST /api/cron/publish-scheduled  (agendados que chegaram no horário)
export async function publishDraft(
  env: Env,
  draft: any,
  publishedAt: number,
): Promise<{ slug: string; sha: string; commit_url: string; published_at: number }> {
  const now = Date.now();
  const githubPath = `src/content/blog/${draft.slug}.md`;
  const markdown = buildMarkdown({ ...draft, published_at: publishedAt });

  const commitResult = await commitFile(env, {
    path: githubPath,
    content: markdown,
    message: `feat(post): publica "${draft.title}"`,
  });
  const sha = commitResult.sha;
  const categorias = draft.categorias ?? null;

  await env.DB.prepare(`
    INSERT INTO posts_meta (
      slug, title, description, content_md, hero_image_url, hero_image_alt, categorias,
      author_id, published_at, updated_at,
      github_path, github_sha, synced_at, status,
      focus_keyword, meta_title, meta_description
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', ?, ?, ?)
    ON CONFLICT(slug) DO UPDATE SET
      title = excluded.title,
      description = excluded.description,
      content_md = excluded.content_md,
      hero_image_url = excluded.hero_image_url,
      hero_image_alt = excluded.hero_image_alt,
      categorias = excluded.categorias,
      updated_at = excluded.updated_at,
      github_path = excluded.github_path,
      github_sha = excluded.github_sha,
      synced_at = excluded.synced_at,
      status = 'published',
      focus_keyword = excluded.focus_keyword,
      meta_title = excluded.meta_title,
      meta_description = excluded.meta_description
  `).bind(
    draft.slug,
    draft.title,
    draft.description ?? null,
    draft.content_md,
    draft.hero_image_url ?? null,
    draft.hero_image_alt ?? null,
    categorias,
    draft.author_id ?? null,
    publishedAt,   // published_at (backdate/agendado) — só usado em INSERT
    now,           // updated_at
    githubPath,
    sha,
    now,           // synced_at (acabou de commitar)
    draft.focus_keyword ?? null,
    draft.meta_title ?? null,
    draft.meta_description ?? null,
  ).run();

  // Remove o draft (evita duplicidade na listagem). Falha aqui não bloqueia.
  try {
    await env.DB.prepare(`DELETE FROM drafts WHERE id = ?`).bind(draft.id).run();
  } catch (delErr) {
    console.warn(`[publishDraft ${draft.slug}] Falha ao deletar draft ${draft.id}:`, delErr);
  }

  return { slug: draft.slug, sha, commit_url: commitResult.html_url, published_at: publishedAt };
}
