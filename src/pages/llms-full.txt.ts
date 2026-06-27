import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { SITE_CONFIG } from '../config/site';

const SITE_URL = SITE_CONFIG.url;

// Conteudo bruto de TODOS os ensaios em markdown — alvo: GEO/AEO.
// .mdx vem com JSX (componentes Astro) — mantemos bruto porque LLMs lidam bem
// e a alternativa (parsing/strip) introduz risco maior.
export const GET: APIRoute = async () => {
  const posts = await getCollection('blog');
  const sorted = posts.sort(
    (a, b) => new Date(b.data.pubDate).getTime() - new Date(a.data.pubDate).getTime()
  );

  const lines: string[] = [];

  // Header
  lines.push('# Paul Gomes — Thinking Forward (Conteúdo completo)');
  lines.push('');
  lines.push('> Todos os ensaios em formato markdown puro pra consumo por LLMs.');
  lines.push('> Atualizado automaticamente a cada deploy.');
  lines.push('');
  lines.push(`Site: ${SITE_URL}`);
  lines.push(`Total de ensaios: ${sorted.length}`);
  lines.push(`Última atualização: ${new Date().toISOString().split('T')[0]}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // Cada post
  for (const p of sorted) {
    const url = `${SITE_URL}/${p.id}/`;
    const pubDate = new Date(p.data.pubDate).toISOString().split('T')[0];
    const categorias = (p.data.categorias || []).join(', ');
    const body = (p.body || '').trim();

    lines.push(`# ${p.data.title}`);
    lines.push('');
    lines.push(`Publicado em: ${pubDate}`);
    if (categorias) lines.push(`Categorias: ${categorias}`);
    lines.push(`URL: ${url}`);
    if (p.data.description) {
      lines.push('');
      lines.push(`> ${p.data.description}`);
    }
    lines.push('');
    if (body) {
      lines.push(body);
      lines.push('');
    }
    lines.push('---');
    lines.push('');
  }

  return new Response(lines.join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
