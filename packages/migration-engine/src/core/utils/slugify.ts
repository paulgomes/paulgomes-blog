/**
 * Espelha functions/api/_utils/slugify.ts (fonte unica do projeto):
 * minusculas + remove diacriticos (NFD) + colapsa nao-alfanumericos em "-".
 * Usado APENAS como fallback — slug de destino = slug ORIGINAL da origem.
 */
export function slugify(input: string | null | undefined): string {
  return String(input ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove marcas combinantes
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');
}
