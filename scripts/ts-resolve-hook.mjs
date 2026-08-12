/**
 * Hook de resolução para rodar os .ts do projeto direto no Node.
 *
 * O código-fonte usa imports sem extensão (`./types`), que é o que o resolver do
 * Vite/Astro espera. O resolver ESM do Node exige extensão explícita. Este hook
 * faz a ponte apenas nos testes — nenhuma linha do src/ precisa mudar de forma
 * para acomodar o runner.
 */

import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export async function resolve(specifier, context, next) {
  const relative = specifier.startsWith('./') || specifier.startsWith('../');
  const hasExtension = /\.[a-z0-9]+$/i.test(specifier);

  if (relative && !hasExtension && context.parentURL) {
    for (const ext of ['.ts', '.tsx', '.js', '.mjs']) {
      const candidate = new URL(specifier + ext, context.parentURL);
      if (existsSync(fileURLToPath(candidate))) {
        return next(specifier + ext, context);
      }
    }
  }

  return next(specifier, context);
}
