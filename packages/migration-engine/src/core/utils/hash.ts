import { createHash } from 'node:crypto';

/** Hash estavel (sha256 hex) para dedup/sync por conteudo. */
export function contentHash(input: string | Uint8Array): string {
  return createHash('sha256').update(input).digest('hex');
}
