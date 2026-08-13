/**
 * Escolha de `<title>` e meta description a partir do frontmatter.
 *
 * Contexto: ~205 posts importados do WordPress trazem `metaTitle` e
 * `metaDescription`. Eles nunca chegaram ao HTML porque o schema de conteúdo
 * não os declarava — o Zod descartava os dois silenciosamente.
 *
 * Só que esses campos são de DUAS naturezas misturadas:
 *
 *   1. Reescrita editorial de verdade, mais curta e melhor:
 *      title:     "Alucinações: por que a IA inventa e o que realmente reduz isso"
 *      metaTitle: "Alucinações de IA: por que a máquina inventa"
 *
 *   2. O próprio título cortado com reticências pelo importador:
 *      title:     "Agência especialista em sites para médicos e clínicas médicas"
 *      metaTitle: "Agência especialista em sites para médicos e clínicas..."
 *
 * Usar o tipo 2 como `<title>` seria PIOR que o título longo: o SERP passaria a
 * exibir uma frase cortada no meio. Por isso a verificação vive aqui, no código,
 * e não numa limpeza dos arquivos: o painel pode reescrever o frontmatter a
 * qualquer momento a partir do D1, e um dado limpo hoje volta sujo amanhã. A
 * guarda no código sobrevive a isso.
 */

/** Limites em que o Google costuma truncar a exibição. */
export const TITLE_MAX = 60;
export const DESCRIPTION_MAX = 165;

const ELLIPSIS = /(\.{3}|…)\s*$/;

function normalize(s: string): string {
  return s.normalize('NFC').trim().toLowerCase();
}

/**
 * `candidate` é apenas `full` cortado, e não uma reescrita?
 *
 * Compara o candidato sem as reticências com o início do texto completo. Exige
 * pelo menos 10 caracteres de sobreposição para não classificar como truncagem
 * uma reescrita que por acaso começa com as mesmas palavras.
 */
export function isTruncation(candidate: string, full: string): boolean {
  const base = candidate.replace(ELLIPSIS, '').trim();
  if (!base) return true;
  const probe = normalize(base).slice(0, Math.max(10, base.length - 3));
  return normalize(full).startsWith(probe);
}

/**
 * Um candidato só substitui o original se: existir, ser mais curto que o limite,
 * não terminar em reticências e não ser uma truncagem do original.
 */
function pick(original: string, candidate: string | undefined, max: number): string {
  const value = (candidate ?? '').trim();
  if (!value) return original;
  if (value.length > max) return original;
  if (ELLIPSIS.test(value)) return original;
  if (isTruncation(value, original)) return original;
  return value;
}

/** `<title>` da página: prefere a reescrita editorial quando ela é legítima. */
export function seoTitle(title: string, metaTitle?: string): string {
  return pick(title, metaTitle, TITLE_MAX);
}

/**
 * Remove o fragmento pendurado de um texto cortado pelo importador.
 *
 * Muitas descriptions chegaram do WordPress cortadas em ~200 caracteres, no
 * meio de uma frase, com reticências no fim. No snippet do Google isso aparece
 * como um pensamento interrompido. Aqui recuamos até o último fim de frase real
 * e devolvemos algo completo.
 *
 * Se o recuo deixar o texto curto demais para ser útil (< 70 caracteres), o
 * original é mantido: uma frase truncada informa mais que meia dúzia de
 * palavras soltas.
 */
export function trimDangling(text: string): string {
  const value = text.trim();
  if (!ELLIPSIS.test(value)) return value;

  const withoutEllipsis = value.replace(ELLIPSIS, '').trim();

  // Recua até o último ponto final / interrogação / exclamação.
  const lastStop = Math.max(
    withoutEllipsis.lastIndexOf('. '),
    withoutEllipsis.lastIndexOf('! '),
    withoutEllipsis.lastIndexOf('? ')
  );
  if (lastStop > 0) {
    const sentence = withoutEllipsis.slice(0, lastStop + 1).trim();
    if (sentence.length >= 70) return sentence;
  }

  // Sem fim de frase utilizável: ao menos não deixa a palavra pela metade.
  const lastSpace = withoutEllipsis.lastIndexOf(' ');
  const clipped = (lastSpace > 0 ? withoutEllipsis.slice(0, lastSpace) : withoutEllipsis).trim();
  const cleaned = clipped.replace(/[,;:\-–—]$/, '').trim();
  return cleaned.length >= 70 ? cleaned : value;
}

/** Meta description: mesma regra do título, mais a limpeza do corte do importador. */
export function seoDescription(description: string, metaDescription?: string): string {
  return trimDangling(pick(description, metaDescription, DESCRIPTION_MAX));
}
