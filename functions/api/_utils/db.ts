export type Env = {
  DB: D1Database;
  MEDIA: R2Bucket;
  SESSION_SECRET: string;
  PUBLIC_R2_DOMAIN: string;
  GITHUB_TOKEN: string;
  GITHUB_REPO: string;
  GITHUB_BRANCH: string;
  // Newsletter (Resend)
  RESEND_API_KEY: string;
  RESEND_AUDIENCE_ID: string;
  SITE_URL: string;
  // Contato (Cloudflare Email Service — beta, via API REST).
  // O binding send_email não é suportado em Pages, então usamos a API REST.
  CLOUDFLARE_ACCOUNT_ID: string;
  EMAIL_API_TOKEN: string; // secret configurado no painel das Pages
};

export function getDB(env: Env): D1Database {
  if (!env.DB) {
    throw new Error('D1 binding "DB" not configured');
  }
  return env.DB;
}
