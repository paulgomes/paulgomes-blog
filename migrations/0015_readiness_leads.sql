-- =====================================================================
-- ChatGPT Ads Readiness — leads capturados pela ferramenta de diagnostico.
--
-- Guarda o lead + o diagnostico completo em JSON, para posterior integracao
-- com CRM. O WYS Lead Score fica aqui (nunca e exibido ao usuario) e e o campo
-- de ordenacao natural para priorizar atendimento comercial.
--
-- Aplicar com:
--   wrangler d1 execute paulgomes-painel --remote --file=migrations/0015_readiness_leads.sql
-- =====================================================================

CREATE TABLE IF NOT EXISTS readiness_leads (
  id TEXT PRIMARY KEY,

  -- Identificacao do lead
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  whatsapp TEXT,
  empresa TEXT NOT NULL,

  -- Contexto da empresa (denormalizado para consulta rapida no painel)
  site TEXT,
  segmento TEXT,
  local TEXT,
  modelo TEXT,                          -- b2b|b2c|b2b2c|saas|ecommerce|marketplace|servico|outro
  objetivo TEXT,
  investimento_faixa TEXT,
  ticket_medio REAL,

  -- Resultado do diagnostico
  readiness_score INTEGER NOT NULL,     -- 0-100
  readiness_band TEXT NOT NULL,         -- baixa|desenvolvimento|ajustes|alta
  opportunity_index INTEGER,            -- 0-100
  wys_lead_score INTEGER NOT NULL,      -- 0-100, INTERNO
  wys_lead_tier TEXT NOT NULL,          -- baixa|oportunidade|qualificado|altamente-qualificado

  -- Payloads completos (JSON) para reprocessamento e CRM
  answers_json TEXT,
  diagnosis_json TEXT,
  site_signals_json TEXT,               -- NULL quando o scan nao foi possivel

  -- Rastreio
  user_agent TEXT,
  ip TEXT,
  crm_synced_at INTEGER,                -- NULL ate a integracao com CRM rodar
  created_at INTEGER NOT NULL
);

-- Priorizacao comercial: os leads mais quentes primeiro.
CREATE INDEX IF NOT EXISTS idx_readiness_leads_score
  ON readiness_leads(wys_lead_score DESC, created_at DESC);

-- Deduplicacao/consulta por e-mail.
CREATE INDEX IF NOT EXISTS idx_readiness_leads_email
  ON readiness_leads(email);

-- Fila de sincronizacao com CRM.
CREATE INDEX IF NOT EXISTS idx_readiness_leads_crm
  ON readiness_leads(crm_synced_at, created_at DESC);
