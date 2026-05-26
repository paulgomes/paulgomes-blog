import type { Env } from '../_utils/db';
import { requireAuth } from '../_utils/require-auth';
import { commitFile } from '../_utils/github';

// POST /api/categorias/sync
// Le D1 categories, regenera secao CATEGORIAS+CATEGORIA_SLUGS+CATEGORIA_COLORS
// de src/lib/categorias.ts entre markers <CATEGORIAS_BEGIN> e <CATEGORIAS_END>,
// commita. Resto do categorias.ts (SLUG_TO_CATEGORIA derivado) preservado.

const CATEGORIAS_PATH = 'src/lib/categorias.ts';
const MARKER_BEGIN = '// <CATEGORIAS_BEGIN>';
const MARKER_END = '// <CATEGORIAS_END>';

// Paleta default: ciclica pra novas categorias sem cor especificada
const DEFAULT_COLORS = [
  { bg: '#0103F9', fg: '#ffffff' },
  { bg: '#0102CC', fg: '#ffffff' },
  { bg: '#0077a3', fg: '#ffffff' },
  { bg: '#005f86', fg: '#ffffff' },
  { bg: '#1f2937', fg: '#ffffff' },
  { bg: '#4b5563', fg: '#ffffff' },
  { bg: '#6b7280', fg: '#ffffff' },
  { bg: '#374151', fg: '#ffffff' },
];

// Cores fixas pras 6 originais — preserva visual atual
const LEGACY_COLORS: Record<string, { bg: string; fg: string }> = {
  'IA':         { bg: '#0103F9', fg: '#ffffff' },
  'GEO':        { bg: '#0102CC', fg: '#ffffff' },
  'SEO':        { bg: '#0077a3', fg: '#ffffff' },
  'Branding':   { bg: '#005f86', fg: '#ffffff' },
  'Tecnologia': { bg: '#1f2937', fg: '#ffffff' },
  'Negócios':   { bg: '#4b5563', fg: '#ffffff' },
};

type CategoryRow = { name: string; slug: string; sort_order: number };

function tsLiteral(s: string): string {
  // single-quote com escape minimo (nomes sao limitados — sem newline)
  return "'" + s.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
}

function buildSection(cats: CategoryRow[]): string {
  const names = cats.map((c) => tsLiteral(c.name)).join(', ');
  const slugLines = cats.map((c) => `  ${tsLiteral(c.name)}: ${tsLiteral(c.slug)},`).join('\n');
  const colorLines = cats.map((c, i) => {
    const col = LEGACY_COLORS[c.name] || DEFAULT_COLORS[i % DEFAULT_COLORS.length];
    return `  ${tsLiteral(c.name)}: { bg: '${col.bg}', fg: '${col.fg}' },`;
  }).join('\n');

  return `${MARKER_BEGIN}
export const CATEGORIAS = [${names}] as const;
export type Categoria = typeof CATEGORIAS[number];

export const CATEGORIA_SLUGS: Record<Categoria, string> = {
${slugLines}
};

export const CATEGORIA_COLORS: Record<Categoria, { bg: string; fg: string }> = {
${colorLines}
};
${MARKER_END}`;
}

async function getCurrentCategoriasContent(env: Env): Promise<string> {
  const url = `https://api.github.com/repos/${env.GITHUB_REPO}/contents/${CATEGORIAS_PATH}?ref=${env.GITHUB_BRANCH}`;
  const res = await fetch(url, {
    headers: {
      'Authorization': `token ${env.GITHUB_TOKEN}`,
      'User-Agent': 'paulgomes-painel',
      'Accept': 'application/vnd.github.v3+json',
    },
  });
  if (!res.ok) throw new Error(`Falha ao ler ${CATEGORIAS_PATH} (${res.status})`);
  const data = await res.json() as any;
  // content base64 (Latin-1 esperado pelo encoding base64, mas conteudo TS pode ter UTF-8 — usa TextDecoder)
  const binary = atob(data.content.replace(/\n/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder('utf-8').decode(bytes);
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  try {
    const result = await env.DB
      .prepare(`SELECT name, slug, sort_order FROM categories ORDER BY sort_order`)
      .all<CategoryRow>();
    const cats = result.results || [];
    if (cats.length === 0) {
      return Response.json({ error: 'Nenhuma categoria no D1 — z.enum precisa de >=1' }, { status: 400 });
    }

    const currentContent = await getCurrentCategoriasContent(env);
    const beginIdx = currentContent.indexOf(MARKER_BEGIN);
    const endIdx = currentContent.indexOf(MARKER_END);
    if (beginIdx === -1 || endIdx === -1 || endIdx < beginIdx) {
      return Response.json({
        error: `Markers ${MARKER_BEGIN}/${MARKER_END} nao encontrados em ${CATEGORIAS_PATH} — corrigir arquivo a mao primeiro`,
      }, { status: 500 });
    }

    const before = currentContent.substring(0, beginIdx);
    const after = currentContent.substring(endIdx + MARKER_END.length);
    const newSection = buildSection(cats);
    const newContent = before + newSection + after;

    if (newContent === currentContent) {
      return Response.json({
        ok: true,
        no_op: true,
        message: 'Sem mudancas — categorias.ts ja reflete o estado do D1',
      });
    }

    const commit = await commitFile(env, {
      path: CATEGORIAS_PATH,
      content: newContent,
      message: `chore(categorias): sync de ${cats.length} categoria(s)`,
    });

    return Response.json({
      ok: true,
      count: cats.length,
      commit_url: commit.html_url,
      message: `${cats.length} categoria(s) sincronizada(s). Rebuild em ~2 min.`,
    });
  } catch (err: any) {
    console.error('Categorias sync error:', err);
    return Response.json({ error: err?.message || 'Erro ao sincronizar' }, { status: 500 });
  }
};
