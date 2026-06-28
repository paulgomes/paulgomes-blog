/**
 * Entrada BROWSER do engine — exporta apenas o que e browser-safe (preview no painel).
 * NAO exporta publish/logger/cli (usam node:fs / process). Empacotado por esbuild
 * num unico arquivo (ver scripts/build-engine-browser.* / package raiz).
 */
export { runImport } from './core/pipeline/import-pipeline.js';
export type { ImportOptions, ImportResult, PublishablePost } from './core/pipeline/import-pipeline.js';
export { KNOWN_CATEGORIES } from './core/validators/categories.js';
export { slugify } from './core/utils/slugify.js';
