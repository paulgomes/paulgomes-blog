// @ts-check
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import react from '@astrojs/react';
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: 'https://paulgomes.com.br',
  output: 'static',
  trailingSlash: 'ignore',

  build: {
    format: 'directory',
  },

  integrations: [
    mdx(),
    sitemap({
      filter: (page) => !page.includes('/painel') && !page.includes('/og/'),
    }),
    react(),
  ],

  vite: {
    plugins: [tailwindcss()],
  },
});
