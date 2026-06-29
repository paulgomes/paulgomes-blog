import type { Env } from '../_utils/db';
import { requireAuth } from '../_utils/require-auth';

// POST /api/ai/enrich
// Body: { kind, input }
// Enriquecimento por IA via Anthropic Messages API (modelo Haiku 4.5).
// Protegido por sessao (requireAuth). Dormente ate o dono setar ANTHROPIC_API_KEY.
//
// kind ∈ ['meta-description','faq','tldr','resumo','alt-text','key-points']
// Retorna { suggestion: <texto> }.

const KINDS = ['meta-description', 'faq', 'tldr', 'resumo', 'alt-text', 'key-points'] as const;
type Kind = (typeof KINDS)[number];

const ANTHROPIC_ENDPOINT = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-haiku-4-5-20251001';

function buildPrompt(kind: Kind, input: string): string {
  switch (kind) {
    case 'meta-description':
      return `Escreva uma meta description SEO (max 155 caracteres) em pt-BR para: ${input}`;
    case 'faq':
      return `Gere 3-5 perguntas e respostas (FAQ) em pt-BR sobre: ${input}`;
    case 'tldr':
      return `Resuma em 1 frase (TL;DR) em pt-BR: ${input}`;
    case 'resumo':
      return `Resuma em 2-3 frases em pt-BR: ${input}`;
    case 'alt-text':
      return `Gere um alt text descritivo e curto em pt-BR para uma imagem descrita como: ${input}`;
    case 'key-points':
      return `Liste 3-5 pontos-chave em pt-BR de: ${input}`;
  }
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  // O tipo Env nao declara ANTHROPIC_API_KEY (db.ts e compartilhado e nao deve ser editado).
  // Acesso via cast para nao quebrar a build.
  const apiKey = (env as any).ANTHROPIC_API_KEY as string | undefined;
  if (!apiKey) {
    return Response.json({ error: 'ANTHROPIC_API_KEY nao configurada' }, { status: 400 });
  }

  try {
    const body = (await request.json().catch(() => null)) as any;
    const kind = String(body?.kind || '') as Kind;
    const input = String(body?.input || '').trim();

    if (!KINDS.includes(kind)) {
      return Response.json({ error: 'kind invalido' }, { status: 400 });
    }
    if (!input) {
      return Response.json({ error: 'input vazio' }, { status: 400 });
    }

    const prompt = buildPrompt(kind, input);

    const res = await fetch(ANTHROPIC_ENDPOINT, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error(`Anthropic ${res.status}:`, detail.slice(0, 500));
      return Response.json({ error: 'Falha ao gerar sugestao pela IA.' }, { status: 502 });
    }

    const data = (await res.json()) as any;
    const suggestion = String(data?.content?.[0]?.text || '').trim();
    if (!suggestion) {
      return Response.json({ error: 'IA retornou resposta vazia.' }, { status: 502 });
    }

    return Response.json({ suggestion });
  } catch (err: any) {
    console.error('AI enrich error:', err?.message || err);
    return Response.json({ error: 'Erro ao processar enriquecimento.' }, { status: 500 });
  }
};
