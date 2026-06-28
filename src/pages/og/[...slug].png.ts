import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';
import sharp from 'sharp';

/**
 * Imagem OG (social) gerada automaticamente para posts SEM `heroImage`.
 * Fundo sólido #0203FC com o título do artigo em branco, 1200×630.
 *
 * Prerenderizada no build (output: 'static') — vira um arquivo /og/<slug>.png.
 * Posts COM capa não passam por aqui (continuam usando a própria heroImage).
 */

const WIDTH = 1200;
const HEIGHT = 630;
const BG = '#0203FC';
const PAD_X = 100;

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Quebra gulosa do título em linhas que cabem na largura disponível. */
function wrapLines(title: string, maxChars: number): string[] {
  const words = title.trim().split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export const getStaticPaths: GetStaticPaths = async () => {
  const posts = await getCollection('blog');
  return posts
    .filter((post) => !post.data.heroImage)
    .map((post) => ({
      params: { slug: post.id },
      props: { title: post.data.title },
    }));
};

export const GET: APIRoute = async ({ props }) => {
  const title = (props as { title?: string }).title ?? '';

  // Fonte adaptativa: títulos longos diminuem pra caber sem estourar.
  const len = title.length;
  const fontSize = len <= 40 ? 78 : len <= 80 ? 62 : len <= 120 ? 50 : 42;
  const maxChars = Math.max(8, Math.floor((WIDTH - PAD_X * 2) / (fontSize * 0.56)));
  const lines = wrapLines(title, maxChars).slice(0, 6);

  const lineHeight = Math.round(fontSize * 1.18);
  const blockHeight = lines.length * lineHeight;
  const startY = Math.round((HEIGHT - blockHeight) / 2 + fontSize * 0.78);

  const texts = lines
    .map(
      (line, i) =>
        `<text x="${WIDTH / 2}" y="${startY + i * lineHeight}" text-anchor="middle" ` +
        `fill="#ffffff" font-family="sans-serif" font-weight="700" ` +
        `font-size="${fontSize}" letter-spacing="-1">${escapeXml(line)}</text>`,
    )
    .join('');

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">` +
    `<rect width="${WIDTH}" height="${HEIGHT}" fill="${BG}"/>` +
    texts +
    `</svg>`;

  const png = await sharp(Buffer.from(svg)).png().toBuffer();

  return new Response(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
};
