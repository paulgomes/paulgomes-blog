import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { CATEGORIAS, CATEGORIA_SLUGS } from '../lib/categorias';

const SITE_URL = 'https://paulgomes.com.br';

// Padrao llmstxt.org — sumario curto + links pros principais ensaios e categorias.
// Conteudo completo dos ensaios fica em /llms-full.txt
export const GET: APIRoute = async () => {
  const posts = await getCollection('blog');
  const sorted = posts.sort(
    (a, b) => new Date(b.data.pubDate).getTime() - new Date(a.data.pubDate).getTime()
  );
  const featured = sorted.slice(0, 20);

  const lines: string[] = [];

  // Header
  lines.push('# Paul Gomes — Thinking Forward');
  lines.push('');
  lines.push('> Blog editorial sobre inteligência artificial, GEO, SEO, branding e arquitetura digital. Ensaios autorais sobre as transformações que redefinem negócios, marcas e comportamento.');
  lines.push('');
  lines.push('Autor: Paul Gomes — Fundador e CEO do Grupo WYS.');
  lines.push('');
  lines.push('Este blog discute o futuro da internet como infraestrutura cognitiva, o papel das IAs generativas, otimização para mecanismos de busca (SEO) e para mecanismos generativos (GEO/AEO), branding em era pós-busca, e arquitetura de visibilidade em modelos de linguagem.');
  lines.push('');

  // Sobre
  lines.push('## Sobre');
  lines.push('');
  lines.push(`- [Sobre o autor](${SITE_URL}/sobre): Bio editorial completa de Paul Gomes`);
  lines.push(`- [Contato](${SITE_URL}/contato): Canais de contato e parceria`);
  lines.push('');

  // Ensaios em destaque
  lines.push('## Ensaios em destaque');
  lines.push('');
  for (const p of featured) {
    const url = `${SITE_URL}/${p.id}/`;
    const desc = (p.data.description || '').trim();
    const truncated = desc.length > 200 ? desc.slice(0, 197) + '...' : desc;
    lines.push(`- [${p.data.title}](${url})${truncated ? ': ' + truncated : ''}`);
  }
  lines.push('');

  // Categorias
  lines.push('## Categorias');
  lines.push('');
  for (const cat of CATEGORIAS) {
    const url = `${SITE_URL}/categoria/${CATEGORIA_SLUGS[cat]}/`;
    lines.push(`- [${cat}](${url})`);
  }
  lines.push('');

  // Acesso completo
  lines.push('## Conteúdo completo');
  lines.push('');
  lines.push(`- [llms-full.txt](${SITE_URL}/llms-full.txt): Conteúdo completo de todos os ${sorted.length} ensaios em formato markdown`);
  lines.push(`- [RSS](${SITE_URL}/rss.xml): Feed RSS dos posts mais recentes`);
  lines.push(`- [Sitemap](${SITE_URL}/sitemap-index.xml): Mapa do site`);
  lines.push('');

  return new Response(lines.join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
