// Slugify: minusculas + remove diacriticos (NFD) + colapsa nao-alfanumericos em "-".
// IMPORTANTE: manter em sync com a copia inline em
//   src/pages/painel/posts/editor.astro (bundle Astro != bundle Functions).

export function slugify(input: string | null | undefined): string {
  return String(input ?? '')
    .toLowerCase()
    .normalize('NFD')                       // "ê" -> "e" + diacritico combinante
    .replace(/[̀-ͯ]/g, '')        // remove combining marks U+0300..U+036F
    .replace(/[^a-z0-9]+/g, '-')            // qualquer outra coisa vira "-"
    .replace(/^-+|-+$/g, '')                // tira hifens nas pontas
    .replace(/-+/g, '-');                   // colapsa hifens duplicados
}
