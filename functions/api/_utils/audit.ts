import type { Env } from './db';

/**
 * Registra uma acao no audit log (tabela audit_logs, migration 0014).
 * Best-effort: uma falha de auditoria NUNCA quebra a operacao principal.
 */
export async function audit(
  env: Env,
  opts: {
    userId?: string | null;
    action: string;
    entity?: string | null;
    entityId?: string | null;
    before?: unknown;
    after?: unknown;
  },
): Promise<void> {
  try {
    await env.DB.prepare(
      `INSERT INTO audit_logs (id, user_id, action, entity, entity_id, before_json, after_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        crypto.randomUUID(),
        opts.userId ?? null,
        opts.action,
        opts.entity ?? null,
        opts.entityId ?? null,
        opts.before !== undefined ? JSON.stringify(opts.before) : null,
        opts.after !== undefined ? JSON.stringify(opts.after) : null,
        Date.now(),
      )
      .run();
  } catch {
    // silencioso de proposito — auditoria nao deve derrubar a operacao
  }
}
