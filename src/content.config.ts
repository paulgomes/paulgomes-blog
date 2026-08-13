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
		/**
		 * Título/description alternativos para SEO, herdados da importação do
		 * WordPress. Existem em ~205 posts e até agora eram DESCARTADOS pelo Zod
		 * por não estarem declarados aqui.
		 *
		 * Parte deles é reescrita editorial legítima e mais curta; parte é o
		 * original cortado com reticências. `src/lib/seo-meta.ts` decide qual
		 * usar — nunca aplique estes campos direto.
		 */
		metaTitle: z.string().optional(),
		metaDescription: z.string().optional(),
		/** Palavra-chave alvo do post. Informativa; não altera renderização. */
		focusKeyword: z.string().optional(),
		/**
		 * Perguntas e respostas do post, emitidas como JSON-LD `FAQPage`.
		 *
		 * Nota honesta sobre o retorno: desde 2023 o Google restringiu o rich
		 * result de FAQ a sites governamentais e de saúde, então NÃO espere as
		 * sanfonas no resultado de busca. O valor aqui é outro e alinhado ao
		 * foco GEO/AEO do site: dar a sistemas de IA um par pergunta-resposta
		 * explícito e citável, em vez de deixá-los inferir do corpo do texto.
		 */
		faq: z
			.array(z.object({ q: z.string().min(3), a: z.string().min(10) }))
			.optional(),
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
