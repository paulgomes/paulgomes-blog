/**
 * Ports (interfaces de saida injetadas no nucleo).
 * O nucleo NUNCA conhece R2/GitHub/D1 diretamente — recebe estes adapters.
 * Adapters concretos vivem em packages/migration-engine/adapters/{cloudflare,node}.
 */
import type { MediaBlob, MediaLocation } from './media.js';

export interface StructuredLogger {
  debug(msg: string, meta?: Record<string, unknown>): void;
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
  child(bindings: Record<string, unknown>): StructuredLogger;
}

/** Resolve segredos por nome (Workers Secrets / KV cifrado / env do CLI). */
export interface SecretResolver {
  get(name: string): Promise<string | undefined>;
}

/** Armazenamento de bytes (R2 no Cloudflare, fs no CLI). */
export interface StoragePort {
  head(key: string): Promise<MediaLocation | null>;
  put(key: string, blob: MediaBlob): Promise<MediaLocation>;
  url(key: string): string;
}

/** Geracao de variantes (Cloudflare Images OU sharp no CLI). Opcional. */
export interface ImagesPort {
  ingest(blob: MediaBlob): Promise<{ id: string; variants: Record<string, string> }>;
  variantUrl(id: string, variant: string): string;
}

/** Commit de arquivos no Git (GitHub Contents/GraphQL). Espelha functions/api/_utils/github.ts. */
export interface CommitPort {
  getFileSha(path: string): Promise<string | null>;
  /** Commita um ou varios arquivos atomicamente (enum + posts + redirects no MESMO commit). */
  commitFiles(
    files: { path: string; content: string }[],
    message: string,
  ): Promise<{ commitSha: string }>;
  deleteFile(path: string, message: string): Promise<void>;
}

/** Fila de chunks (Cloudflare Queues no Worker; in-process no CLI). */
export interface QueuePort {
  enqueue(msg: unknown): Promise<void>;
  ack(id: string): Promise<void>;
  retry(id: string, delayMs: number): Promise<void>;
}
