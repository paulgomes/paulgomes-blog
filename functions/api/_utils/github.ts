import type { Env } from './db';

// Helpers pra GitHub Contents API
// Docs: https://docs.github.com/en/rest/repos/contents

const GH_HEADERS_BASE = {
  'User-Agent': 'paulgomes-painel',
  'Accept': 'application/vnd.github.v3+json',
};

function authHeader(token: string) {
  return { 'Authorization': `token ${token}` };
}

/**
 * Retorna o blob SHA atual de um arquivo no branch configurado.
 * `null` se o arquivo não existe (404).
 */
export async function getFileSha(env: Env, path: string): Promise<string | null> {
  const res = await fetch(
    `https://api.github.com/repos/${env.GITHUB_REPO}/contents/${path}?ref=${env.GITHUB_BRANCH}`,
    { headers: { ...GH_HEADERS_BASE, ...authHeader(env.GITHUB_TOKEN) } }
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub getFileSha ${res.status}: ${await res.text()}`);
  const data = await res.json() as any;
  return data.sha;
}

/**
 * Cria ou atualiza um arquivo no repo. Pega o SHA atual automaticamente.
 * Retorna o novo blob SHA + URL do commit.
 */
export async function commitFile(env: Env, opts: {
  path: string;
  content: string;
  message: string;
}): Promise<{ sha: string; commit_url: string; html_url: string }> {
  const existingSha = await getFileSha(env, opts.path);

  // UTF-8 safe base64 (btoa só aceita Latin-1)
  const bytes = new TextEncoder().encode(opts.content);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const base64 = btoa(binary);

  const body: any = {
    message: opts.message,
    content: base64,
    branch: env.GITHUB_BRANCH,
  };
  if (existingSha) body.sha = existingSha;

  const res = await fetch(
    `https://api.github.com/repos/${env.GITHUB_REPO}/contents/${opts.path}`,
    {
      method: 'PUT',
      headers: {
        ...GH_HEADERS_BASE,
        ...authHeader(env.GITHUB_TOKEN),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    throw new Error(`GitHub commitFile ${res.status}: ${await res.text()}`);
  }

  const data = await res.json() as any;
  return {
    sha: data.content.sha,
    commit_url: data.commit?.url || '',
    html_url: data.commit?.html_url || '',
  };
}

/**
 * Remove um arquivo do repo. Pega o SHA atual automaticamente.
 * Lanca erro 'arquivo nao existe no Git' se o path nao for encontrado (404)
 * — caller decide se eh erro fatal ou warning.
 */
export async function deleteFile(env: Env, opts: {
  path: string;
  message: string;
}): Promise<{ sha: string; commit_url: string; html_url: string }> {
  const existingSha = await getFileSha(env, opts.path);
  if (!existingSha) {
    throw new Error(`arquivo nao existe no Git: ${opts.path}`);
  }

  const res = await fetch(
    `https://api.github.com/repos/${env.GITHUB_REPO}/contents/${opts.path}`,
    {
      method: 'DELETE',
      headers: {
        ...GH_HEADERS_BASE,
        ...authHeader(env.GITHUB_TOKEN),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: opts.message,
        sha: existingSha,
        branch: env.GITHUB_BRANCH,
      }),
    }
  );

  if (!res.ok) {
    throw new Error(`GitHub deleteFile ${res.status}: ${await res.text()}`);
  }

  const data = await res.json() as any;
  return {
    sha: data.commit?.sha || '',
    commit_url: data.commit?.url || '',
    html_url: data.commit?.html_url || '',
  };
}

/**
 * Gera frontmatter + body markdown a partir dos campos de posts_meta/drafts.
 * Aceita tags como JSON string ou array. published_at em ms timestamp ou ISO.
 */
export function buildMarkdown(post: {
  title: string;
  description?: string | null;
  hero_image_url?: string | null;
  tags?: string | string[] | null;
  published_at?: number | string | null;
  content_md?: string | null;
  focus_keyword?: string | null;
  meta_title?: string | null;
  meta_description?: string | null;
  is_featured?: number | boolean | null;
}): string {
  const tags: string[] = Array.isArray(post.tags)
    ? post.tags
    : (post.tags ? (() => { try { return JSON.parse(post.tags as string); } catch { return []; } })() : []);

  // pubDate como YYYY-MM-DD (formato dos 115 posts existentes)
  const pubTs = post.published_at
    ? (typeof post.published_at === 'number' ? new Date(post.published_at) : new Date(post.published_at))
    : new Date();
  const pubDate = pubTs.toISOString().slice(0, 10);

  let fm = '---\n';
  fm += `title: ${yamlString(post.title)}\n`;
  fm += `description: ${yamlString(post.description || '')}\n`;
  fm += `pubDate: ${pubDate}\n`;
  if (tags.length) {
    fm += 'tags:\n';
    for (const t of tags) fm += `  - ${t}\n`;
  }
  if (post.hero_image_url) fm += `heroImage: ${yamlString(post.hero_image_url)}\n`;
  // Adiciona linha so quando is_featured=1 (omissao = false via default Zod)
  if (post.is_featured === 1 || post.is_featured === true) fm += `featured: true\n`;
  if (post.focus_keyword) fm += `focusKeyword: ${yamlString(post.focus_keyword)}\n`;
  if (post.meta_title) fm += `metaTitle: ${yamlString(post.meta_title)}\n`;
  if (post.meta_description) fm += `metaDescription: ${yamlString(post.meta_description)}\n`;
  fm += '---\n\n';

  const body = (post.content_md || '').replace(/\r\n/g, '\n');
  return fm + body + (body.endsWith('\n') ? '' : '\n');
}

// YAML string quotes — escapa aspas duplas e quebras de linha simples
function yamlString(s: string): string {
  // Se contém quebra de linha, usa bloco literal — mas pra title/desc isso é raro
  // Aspas duplas com escape de " e \
  return '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n') + '"';
}
