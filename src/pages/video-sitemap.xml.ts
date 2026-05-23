import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

const SITE = 'https://paulgomes.com.br';

// Regex pra extrair IDs de YouTube
const YT_RE = /https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/g;

// Captura ID em <YouTube id="..." />
const YT_COMPONENT_RE = /<YouTube\s+id=["']([a-zA-Z0-9_-]{11})["']\s*\/>/g;

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export const GET: APIRoute = async () => {
  const posts = await getCollection('blog');
  const entries: string[] = [];

  for (const post of posts) {
    // Pega o body bruto via rawContent (se disponível) ou via render
    // No Astro 5+, podemos ler do filePath, mas o jeito mais simples é
    // varrer o corpo do conteúdo MDX.
    // Como getCollection retorna entries com `body` somente em algumas
    // versões, vamos usar fileURLToPath se necessário. Mas no Astro atual
    // post.body existe e contém o markdown bruto.
    const rawBody = (post as any).body || '';

    const ids = new Set<string>();
    let m;
    YT_RE.lastIndex = 0;
    while ((m = YT_RE.exec(rawBody)) !== null) ids.add(m[1]);
    YT_COMPONENT_RE.lastIndex = 0;
    while ((m = YT_COMPONENT_RE.exec(rawBody)) !== null) ids.add(m[1]);

    if (ids.size === 0) continue;

    const postUrl = `${SITE}/${post.id}/`;
    const title = escapeXml(post.data.title || '');
    const description = escapeXml(post.data.description || '');
    const pubDate = post.data.pubDate instanceof Date
      ? post.data.pubDate.toISOString()
      : new Date(post.data.pubDate).toISOString();

    for (const id of ids) {
      entries.push(`  <url>
    <loc>${postUrl}</loc>
    <video:video>
      <video:thumbnail_loc>https://i.ytimg.com/vi/${id}/hqdefault.jpg</video:thumbnail_loc>
      <video:title>${title}</video:title>
      <video:description>${description}</video:description>
      <video:player_loc>https://www.youtube.com/embed/${id}</video:player_loc>
      <video:publication_date>${pubDate}</video:publication_date>
    </video:video>
  </url>`);
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
${entries.join('\n')}
</urlset>`;

  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
    },
  });
};
