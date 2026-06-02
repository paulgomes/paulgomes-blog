// Cloudflare Email Service — Email Sending (public beta).
// O binding `send_email` (nome "EMAIL") expõe .send() com este shape.
// Os tipos oficiais de workers-types ainda apontam pra API antiga (EmailMessage),
// então declaramos o contrato do beta aqui pra ter type-safety no env.EMAIL.
export interface EmailAddress {
  email: string;
  name?: string;
}
export interface EmailSendMessage {
  to: string | EmailAddress | (string | EmailAddress)[];
  from: string | EmailAddress;
  subject: string;
  html?: string;
  text?: string;
  cc?: string | EmailAddress | (string | EmailAddress)[];
  bcc?: string | EmailAddress | (string | EmailAddress)[];
  replyTo?: string | EmailAddress;
  headers?: Record<string, string>;
}
export interface EmailBinding {
  send(message: EmailSendMessage): Promise<{ messageId: string }>;
}

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
  // Contato (Cloudflare Email Service — beta)
  EMAIL: EmailBinding;
};

export function getDB(env: Env): D1Database {
  if (!env.DB) {
    throw new Error('D1 binding "DB" not configured');
  }
  return env.DB;
}
