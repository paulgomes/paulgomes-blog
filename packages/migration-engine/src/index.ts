/**
 * @paulgomes/migration-engine — API publica do pacote.
 * Arquitetura de conectores para importar/exportar/sincronizar conteudo entre CMSs.
 * Ver docs/MIGRATION-ENGINE.md.
 */
export * from './core/types/index.js';
export { createConnector, CONNECTORS } from './connectors/index.js';
export { WordPressXmlConnector } from './connectors/wordpress/xml.js';
export { wpItemToCanonical } from './connectors/wordpress/transform.js';
export { runImport } from './core/pipeline/import-pipeline.js';
export { renderMarkdown, MarkdownExporter } from './core/transformers/canonical-to-markdown.js';
export { htmlToMarkdown } from './core/transformers/html.js';
export { markdownToBlocks, blocksToMarkdown } from './core/transformers/blocks.js';
export { mapCategories, assertCategoriesInEnum, KNOWN_CATEGORIES } from './core/validators/categories.js';
export { sanitizeHtml, detectMime } from './core/validators/security.js';
export { slugify } from './core/utils/slugify.js';
export { contentHash } from './core/utils/hash.js';
export { buildFrontmatter, normalizeDate } from './core/utils/frontmatter.js';
export { createLogger } from './core/utils/logger.js';
