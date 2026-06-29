import type { Env } from '../../_utils/db';
import { requireAuth } from '../../_utils/require-auth';
import { generateId } from '../../_utils/crypto';
import { slugify } from '../../_utils/slugify';
import { audit } from '../../_utils/audit';

// POST /api/posts/:slug/duplicate
// Cria um NOVO rascunho copiando conteudo/metadados de um post publicado.
// Espelha o INSERT de drafts/index.ts (mesmas colunas). Retorna { id, slug }.
export const onRequestPost: PagesFunction<Env> = async ({ request, env, params }) => {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const slug = params.slug as string;
  if (!slug) return Response.json({ error: 'slug obrigatorio' }, { status: 400 });

  const src = await env.DB.prepare(
    `SELECT title, description, content_md, hero_image_url, categorias,
            focus_keyword, meta_title, meta_description
     FROM posts_meta WHERE slug = ?`,
  )
    .bind(slug)
    .first<{
      title: string;
      description: string | null;
      content_md: string | null;
      hero_image_url: string | null;
      categorias: string | null;
      focus_keyword: string | null;
      meta_title: string | null;
      meta_description: string | null;
    }>();

  if (!src) return Response.json({ error: 'Post nao encontrado' }, { status: 404 });

  const id = generateId();
  const now = Date.now();
  const newSlug = `${slugify(src.title || 'post')}-copia`;
  const newTitle = `${src.title || 'Sem título'} (cópia)`;

  await env.DB.prepare(`
    INSERT INTO drafts (id, slug, title, description, content_md, hero_image_url,
                        category, categorias, focus_keyword, meta_title, meta_description,
                        author_id, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)
  `)
    .bind(
      id,
      newSlug,
      newTitle,
      src.description || '',
      src.content_md || '',
      src.hero_image_url || null,
      null, // category (legacy singular)
      src.categorias || '[]', // categorias ja e JSON string em posts_meta
      src.focus_keyword || null,
      src.meta_title || null,
      src.meta_description || null,
      auth.user.id,
      now,
      now,
    )
    .run();

  await audit(env, { userId: auth.user.id, action: 'post.duplicate', entity: 'post', entityId: slug, after: { newSlug, draftId: id } });

  return Response.json({ id, slug: newSlug });
};
