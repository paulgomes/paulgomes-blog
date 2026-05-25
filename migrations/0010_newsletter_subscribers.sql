-- Newsletter subscribers (double opt-in + LGPD evidencia).
-- Fluxo: subscribe -> pending -> email confirm -> click -> confirmed.
-- Unsubscribe via /cancelar?token=... (link em todo broadcast futuro).

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending',   -- pending | confirmed | unsubscribed
  confirm_token TEXT NOT NULL UNIQUE,
  unsubscribe_token TEXT NOT NULL UNIQUE,
  resend_contact_id TEXT,                   -- ID no Resend Audiences (apos confirmar)
  created_at INTEGER NOT NULL,
  confirmed_at INTEGER,
  unsubscribed_at INTEGER,
  consent_ip TEXT,                          -- evidencia LGPD
  consent_user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_subscribers_email   ON newsletter_subscribers(email);
CREATE INDEX IF NOT EXISTS idx_subscribers_confirm ON newsletter_subscribers(confirm_token);
CREATE INDEX IF NOT EXISTS idx_subscribers_unsub   ON newsletter_subscribers(unsubscribe_token);
CREATE INDEX IF NOT EXISTS idx_subscribers_status  ON newsletter_subscribers(status);
