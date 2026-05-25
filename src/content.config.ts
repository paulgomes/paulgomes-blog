import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { TAGS } from './lib/tags';

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
			// Enum dinamico — vem do TAGS gerado por /api/categories/sync
			tags: z.array(z.enum(TAGS as unknown as [string, ...string[]])).default([]),
			featured: z.boolean().optional().default(false),
		}),
});

export const collections = { blog };
