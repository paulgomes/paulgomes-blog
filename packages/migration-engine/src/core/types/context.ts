import type { StructuredLogger, SecretResolver } from './ports.js';

/** Contexto injetado em todo conector: logging, cancelamento e segredos. */
export interface ConnectorContext {
  readonly logger: StructuredLogger;
  /** Cancelamento cooperativo (best-effort; Workers podem ser mortos sem aviso). */
  readonly signal: AbortSignal;
  readonly secrets: SecretResolver;
}
