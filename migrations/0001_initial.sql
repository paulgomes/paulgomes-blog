-- Usuários do painel
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'author', -- 'admin' | 'editor' | 'author'
  avatar_url TEXT,
  created_at INTEGER NOT NULL,
  last_login_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Sessões ativas (cookies)
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  user_agent TEXT,
  ip TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- Rascunhos de posts (antes de virar .md)
CREATE TABLE IF NOT EXISTS drafts (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  content_md TEXT,
  hero_image_url TEXT,
  category TEXT,
  tags TEXT, -- JSON array
  focus_keyword TEXT,
  meta_title TEXT,
  meta_description TEXT,
  author_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft', -- 'draft' | 'scheduled' | 'published'
  scheduled_at INTEGER,
  published_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (author_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_drafts_author ON drafts(author_id);
CREATE INDEX IF NOT EXISTS idx_drafts_status ON drafts(status);
CREATE INDEX IF NOT EXISTS idx_drafts_slug ON drafts(slug);

-- Metadata de posts já publicados (referência pra estatísticas, edição)
CREATE TABLE IF NOT EXISTS posts_meta (
  slug TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  author_id TEXT,
  published_at INTEGER NOT NULL,
  github_path TEXT, -- ex: src/content/blog/meu-post.md
  github_sha TEXT,
  FOREIGN KEY (author_id) REFERENCES users(id)
);

-- Convites pendentes (pra futuros colaboradores)
CREATE TABLE IF NOT EXISTS invites (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'author',
  token TEXT UNIQUE NOT NULL,
  expires_at INTEGER NOT NULL,
  invited_by TEXT NOT NULL,
  used_at INTEGER,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (invited_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_invites_token ON invites(token);
