// paulgomes-cron — Cron Trigger que publica posts agendados.
//
// Cloudflare Pages não suporta Cron Triggers; por isso este Worker separado
// chama, a cada 15 min, o endpoint das Pages Functions que faz a publicação.
// Autentica com CRON_SECRET (secret deste Worker == secret do projeto Pages).
//
// O endpoint (/api/cron/publish-scheduled) seleciona drafts status='scheduled'
// com scheduled_at <= agora (máx. 10/execução), commita cada .md no Git via
// GitHub Contents API e remove o draft. Idempotente.

const ENDPOINT = 'https://paulgomes.com.br/api/cron/publish-scheduled';

export default {
  async scheduled(event, env, ctx) {
    if (!env.CRON_SECRET) {
      console.error('[paulgomes-cron] CRON_SECRET ausente no Worker');
      return;
    }
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.CRON_SECRET}` },
      });
      const body = await res.text();
      console.log(`[paulgomes-cron] ${event.cron} -> HTTP ${res.status} ${body}`);
    } catch (err) {
      console.error('[paulgomes-cron] falha ao chamar o endpoint:', err && err.stack || err);
    }
  },
};
