// @ts-check
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import react from '@astrojs/react';
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

const SITE = 'https://paulgomes.com.br';
const BLOG_DIR = new URL('./src/content/blog', import.meta.url).pathname;

/**
 * Mapa `/slug/` -> data da última modificação, para o `lastmod` do sitemap.
 *
 * O `lastmod` é o que diz ao Google o que vale reprocessar. Sem ele, 250+ URLs
 * chegam sem nenhum sinal de recência e um post corrigido hoje pode levar
 * semanas para ser rastreado de novo.
 *
 * Lido direto do frontmatter com regex em vez de `getCollection`: o
 * astro.config é avaliado antes das content collections existirem, então não há
 * como consultá-las aqui. Só precisamos de duas datas por arquivo — não vale
 * carregar um parser de YAML por isso.
 */
function buildLastmodMap() {
  const map = new Map();
  let files = [];
  try {
    files = readdirSync(BLOG_DIR).filter((f) => /\.(md|mdx)$/.test(f));
  } catch {
    return map; // sem conteúdo (ex.: checkout parcial) — sitemap segue sem lastmod
  }

  for (const file of files) {
    const slug = file.replace(/\.(md|mdx)$/, '');
    let raw;
    try {
      raw = readFileSync(path.join(BLOG_DIR, file), 'utf8');
    } catch {
      continue;
    }
    const fm = /^---\n([\s\S]*?)\n---/.exec(raw);
    if (!fm) continue;

    const read = (key) => {
      const m = new RegExp(`^${key}:\\s*(.+)$`, 'm').exec(fm[1]);
      return m ? m[1].trim().replace(/^["']|["']$/g, '') : null;
    };

    // updatedDate vence pubDate: é a data que representa a última alteração real.
    const value = read('updatedDate') || read('pubDate');
    if (!value) continue;
    const date = new Date(value);
    if (Number.isNaN(date.valueOf())) continue;

    map.set(`${SITE}/${slug}/`, date.toISOString());
  }
  return map;
}

const LASTMOD = buildLastmodMap();

/** Data do post mais recente — usada nas páginas de listagem, que mudam junto. */
const NEWEST = [...LASTMOD.values()].sort().pop();

// https://astro.build/config
export default defineConfig({
  site: SITE,
  output: 'static',
  trailingSlash: 'ignore',

  build: {
    format: 'directory',
  },

  integrations: [
    mdx(),
    sitemap({
      filter: (page) => !page.includes('/painel') && !page.includes('/og/'),
      serialize(item) {
        const exact = LASTMOD.get(item.url);
        if (exact) {
          item.lastmod = exact;
          return item;
        }
        // Home, /blog/, /categoria/* e /en/ refletem o acervo: a data do post
        // mais novo descreve a última vez que o conteúdo dessas páginas mudou.
        const isListing =
          item.url === `${SITE}/` ||
          item.url.startsWith(`${SITE}/blog`) ||
          item.url.startsWith(`${SITE}/categoria/`) ||
          item.url.startsWith(`${SITE}/en`);
        if (isListing && NEWEST) item.lastmod = NEWEST;
        return item;
      },
    }),
    react(),
  ],

  vite: {
    plugins: [tailwindcss()],
  },
});
