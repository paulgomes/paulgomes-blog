import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { CATEGORIAS } from './lib/categorias';

const blog = defineCollection({
	// Load Markdown and MDX files in the `src/content/blog/` directory.
	loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
	// Type-check frontmatter using a schema
	schema: ({ image }) =>
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
		}),
});

export const collections = { blog };
