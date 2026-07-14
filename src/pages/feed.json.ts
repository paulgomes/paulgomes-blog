import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { SITE_CONFIG } from '../config/site';

const SITE_URL = SITE_CONFIG.url;

// Feed JSON estático para o app móvel (leitor nativo do blog).
// Mesmo espírito dos endpoints llms.txt/llms-full.txt: gerado a cada deploy.
// body em markdown puro — o app renderiza nativamente (sem webview).
export const GET: APIRoute = async () => {
  const posts = await getCollection('blog');
  const sorted = posts.sort(
    (a, b) => new Date(b.data.pubDate).getTime() - new Date(a.data.pubDate).getTime()
  );

  const items = sorted.map((p) => {
    const hero = p.data.heroImage as unknown;
    const heroUrl =
      typeof hero === 'string'
        ? hero
        : hero && typeof hero === 'object' && 'src' in (hero as any)
          ? `${SITE_URL}${(hero as any).src}`
          : null;
    return {
      slug: p.id,
      url: `${SITE_URL}/${p.id}/`,
      title: p.data.title,
      description: p.data.description || '',
      pubDate: new Date(p.data.pubDate).toISOString(),
      categorias: p.data.categorias || [],
      heroImage: heroUrl,
      heroImageAlt: p.data.heroImageAlt || null,
      body_md: (p.body || '').trim(),
    };
  });

  return new Response(
    JSON.stringify({
      version: 1,
      site: {
        title: SITE_CONFIG.title,
        url: SITE_URL,
        author: 'Paul Gomes',
        language: 'pt-BR',
      },
      generatedAt: new Date().toISOString(),
      total: items.length,
      posts: items,
    }),
    { headers: { 'Content-Type': 'application/json; charset=utf-8' } }
  );
};
