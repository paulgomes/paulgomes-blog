import type { StructuredLogger } from '../types/ports.js';

/** Logger estruturado simples (JSON em stderr) para CLI/Worker. */
export function createLogger(bindings: Record<string, unknown> = {}): StructuredLogger {
  function emit(level: string, msg: string, meta?: Record<string, unknown>): void {
    const line = JSON.stringify({ level, msg, ...bindings, ...(meta ?? {}) });
    // stderr para nao poluir stdout (que pode ser usado p/ dados).
    process.stderr.write(line + '\n');
  }
  return {
    debug: (m, meta) => emit('debug', m, meta),
    info: (m, meta) => emit('info', m, meta),
    warn: (m, meta) => emit('warn', m, meta),
    error: (m, meta) => emit('error', m, meta),
    child: (b) => createLogger({ ...bindings, ...b }),
  };
}
