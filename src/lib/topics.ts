import { getCollection } from 'astro:content';
import { CATEGORIA_SLUGS, type Categoria } from './categorias';

// Grupos temáticos do mega menu / rodapé. Só entram categorias que TÊM conteúdo
// (contagem > 0) — nada de link para página vazia.
const GROUPS: { title: string; cats: Categoria[] }[] = [
  { title: 'Inteligência Artificial', cats: ['IA', 'ASI'] },
  { title: 'SEO e GEO', cats: ['SEO', 'GEO'] },
  { title: 'Tecnologia', cats: ['Tecnologia', 'DevOps', 'Cybersecurity'] },
  { title: 'Negócios e Futuro', cats: ['Negócios', 'Em Alta'] },
  { title: 'Marca', cats: ['Branding'] },
];

export interface TopicItem { label: Categoria; href: string; count: number; }
export interface TopicGroup { title: string; items: TopicItem[]; }

export async function getTopicGroups(): Promise<{ groups: TopicGroup[]; total: number }> {
  const posts = await getCollection('blog');
  const count: Record<string, number> = {};
  for (const p of posts) {
    for (const c of (p.data.categorias || [])) count[c] = (count[c] || 0) + 1;
  }
  const groups: TopicGroup[] = GROUPS.map((g) => ({
    title: g.title,
    items: g.cats
      .filter((c) => (count[c] || 0) > 0)
      .map((c) => ({ label: c, href: `/categoria/${CATEGORIA_SLUGS[c]}`, count: count[c] })),
  })).filter((g) => g.items.length > 0);
  return { groups, total: posts.length };
}
