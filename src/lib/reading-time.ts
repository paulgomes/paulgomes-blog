/** Tempo de leitura aproximado, em minutos (~200 palavras/min). Fonte unica (DRY). */
export function readingTime(text: string | undefined): number {
  const words = (text ?? '').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}
