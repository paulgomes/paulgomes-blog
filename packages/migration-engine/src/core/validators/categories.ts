/**
 * GATE de categorias (invariante de 1a classe — categoria fora do enum quebra o build).
 * Decisao #1: mapeamento MANUAL; nunca inventa categoria do enum.
 *
 * O enum vivo e gerado em src/lib/categorias.ts (markers CATEGORIAS_BEGIN/END).
 * O pacote e standalone: a lista PERMITIDA e INJETADA (lida pelo adapter/CLI),
 * nunca importada do app. A constante abaixo e so um espelho de conveniencia.
 */
import type { Diagnostic } from '../types/canonical.js';

/** Espelho do enum atual (manter em sync; a fonte de verdade e src/lib/categorias.ts). */
export const KNOWN_CATEGORIES = [
  'IA', 'GEO', 'SEO', 'Branding', 'Tecnologia', 'Negócios', 'Em Alta',
  'ASI', 'Cybersecurity', 'Podcasts', 'DevOps', 'Google Ads', 'Redes Sociais', 'PALESTRAS',
] as const;

export interface CategoryMapResult {
  /** categorias ja mapeadas para o enum (subconjunto de `allowed`). */
  mapped: string[];
  /** categorias da origem sem destino no enum (exigem decisao humana). */
  unmapped: string[];
}

/**
 * Aplica um mapeamento origem->enum. Categoria sem entrada no mapa (ou mapeada
 * para algo fora de `allowed`) vai para `unmapped` — NUNCA entra no resultado.
 */
export function mapCategories(
  raw: string[],
  mapping: Record<string, string>,
  allowed: readonly string[],
): CategoryMapResult {
  const allow = new Set(allowed);
  const mapped = new Set<string>();
  const unmapped: string[] = [];
  for (const r of raw) {
    const key = r.trim();
    if (!key) continue;
    const target = mapping[key] ?? mapping[key.toLowerCase()];
    if (target && allow.has(target)) {
      mapped.add(target);
    } else if (allow.has(key)) {
      // ja e uma categoria valida do enum
      mapped.add(key);
    } else {
      unmapped.push(key);
    }
  }
  return { mapped: [...mapped], unmapped };
}

/**
 * GATE bloqueante: retorna diagnostics de ERRO para qualquer categoria fora do enum.
 * Deve rodar ANTES de qualquer commit de .md (em todo caminho: publish/sync/import).
 */
export function assertCategoriesInEnum(
  categories: string[],
  allowed: readonly string[],
): Diagnostic[] {
  const allow = new Set(allowed);
  const out: Diagnostic[] = [];
  for (const c of categories) {
    if (!allow.has(c)) {
      out.push({
        level: 'error',
        code: 'CATEGORY_NOT_IN_ENUM',
        message: `Categoria "${c}" nao esta no enum CATEGORIAS — commitar quebraria o build.`,
      });
    }
  }
  return out;
}
