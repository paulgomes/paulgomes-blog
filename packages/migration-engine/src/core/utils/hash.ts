/**
 * Hash estavel para dedup/sync por conteudo.
 * Implementacao pura-JS (cyrb53) — funciona em Node E no navegador (sem node:crypto),
 * permitindo reusar o engine na UI do painel. Nao e crypto-forte (so dedup), de proposito.
 */
function cyrb53(input: string | Uint8Array, seed: number): number {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  for (let i = 0; i < bytes.length; i++) {
    const ch = bytes[i] as number;
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  // mascara h2 em 21 bits -> resultado 53-bit (precisao exata de Number).
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

export function contentHash(input: string | Uint8Array): string {
  const a = cyrb53(input, 0).toString(16).padStart(14, '0');
  const b = cyrb53(input, 0x9e3779b9).toString(16).padStart(14, '0');
  return a + b;
}
