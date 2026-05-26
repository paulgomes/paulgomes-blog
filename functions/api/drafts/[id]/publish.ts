import type { Env } from '../../_utils/db';
import { requireAuth } from '../../_utils/require-auth';
import { commitFile, buildMarkdown } from '../../_utils/github';

// POST /api/drafts/:id/publish
//
// Consolida draft em posts_meta:
// 1. Commita .md no Git
// 2. INSERT/UPDATE posts_meta com TODOS os campos (inclui content_md)
// 3. DELETE draft (evita duplicacao na listagem; conteudo agora vive em posts_meta)
//
// Idempotente: ON CONFLICT(slug) DO UPDATE — Republicar funciona;
// preserva published_at original + is_featured.

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
  const githubPath = `src/content/blog/${draft.slug}.md`;
  const markdown = buildMarkdown({ ...draft, published_at: now });

  try {
    // 1. Commita .md no Git
    const commitResult = await commitFile(env, {
      path: githubPath,
      content: markdown,
      message: `feat(post): publica "${draft.title}"`,
    });
    const sha = commitResult.sha;

    // 2. INSERT/UPDATE posts_meta com TODOS os campos (idempotente via slug PK)
    //    ON CONFLICT preserva published_at e is_featured (curadoria via /feature endpoint).
    //    categorias vem do draft como JSON string ou null — passa direto.
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
      now,          // published_at (so usado em INSERT — ON CONFLICT preserva original)
      now,          // updated_at
      githubPath,
      sha,
      now,          // synced_at (acabou de commitar)
      draft.focus_keyword ?? null,
      draft.meta_title ?? null,
      draft.meta_description ?? null,
    ).run();

    // 3. DELETE draft — evita duplicidade na listagem UNION ALL.
    //    Falha aqui nao bloqueia (post ja publicado e consolidado); migration retroativa limpa.
    try {
      await env.DB.prepare(`DELETE FROM drafts WHERE id = ?`).bind(id).run();
    } catch (delErr) {
      console.warn(`[publish ${draft.slug}] Falha ao deletar draft ${id}:`, delErr);
    }

    return Response.json({
      success: true,
      slug: draft.slug,
      published_at: now,
      preview_url: `https://paulgomes.com.br/${draft.slug}`,
      commit_url: commitResult.html_url,
      message: 'Post publicado. Cloudflare rebuild em ~1-2 min.',
    });
  } catch (err: any) {
    console.error('Publish error:', err);
    return Response.json({ error: err.message || 'Erro ao publicar' }, { status: 500 });
  }
};
