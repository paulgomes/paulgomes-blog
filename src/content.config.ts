import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { CATEGORIAS } from './lib/categorias';

// Schema compartilhado PT/EN. As categorias continuam sendo as MESMAS chaves de
// taxonomia nos dois idiomas (o enum e gate de build) — traduz-se o texto do post,
// nao o vocabulario de categorias.
const postSchema = ({ image }: { image: () => any }) =>
	z.object({
		title: z.string(),
		description: z.string(),
		// Transform string to Date object
		pubDate: z.coerce.date(),
		updatedDate: z.coerce.date().optional(),
		heroImage: z.union([image(), z.string().url()]).optional(),
		heroImageAlt: z.string().max(200).optional(),
		// Enum dinamico — vem do CATEGORIAS gerado por /api/categorias/sync
		categorias: z.array(z.enum(CATEGORIAS as unknown as [string, ...string[]])).default([]),
		featured: z.boolean().optional().default(false),
	});

const blog = defineCollection({
	// Load Markdown and MDX files in the `src/content/blog/` directory.
	loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
	// Type-check frontmatter using a schema
	schema: postSchema,
});

// Traducoes EN dos posts. ADITIVA: o id (slug) de cada entrada espelha o do post
// PT correspondente, e e isso que forma o par PT<->EN usado pelo hreflang.
// Um post so ganha versao /en/ quando existe o arquivo equivalente aqui —
// nada de hreflang para idioma sem pagina publicada (regra do src/i18n/README.md).
const blogEn = defineCollection({
	loader: glob({ base: './src/content/blog-en', pattern: '**/*.{md,mdx}' }),
	schema: postSchema,
});

export const collections = { blog, blogEn };
