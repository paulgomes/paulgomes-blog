import type { Env } from '../_utils/db';
import { requireAuth } from '../_utils/require-auth';

// GET /api/stats/traffic?days=7|30
//
// Visitas/pageviews REAIS do Cloudflare Web Analytics (dados RUM já coletados no site),
// via GraphQL Analytics API. Inerte até os segredos serem configurados no Cloudflare Pages:
//   CF_ANALYTICS_TOKEN  → API token com permissão "Account Analytics: Read"
//   CF_ACCOUNT_ID       → ID da conta Cloudflare
//   CF_RUM_SITE_TAG     → (opcional) site tag do Web Analytics; se ausente, é autodescoberto
//
// Sem os segredos retorna { configured: false } e a UI mostra como conectar.
const GQL = 'https://api.cloudflare.com/client/v4/graphql';

function isoDate(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10); // YYYY-MM-DD
}

async function resolveSiteTag(accountId: string, token: string, envTag?: string): Promise<string | null> {
  if (envTag) return envTag;
  // Autodescoberta: lista os sites de Web Analytics da conta e pega o primeiro (conta single-site).
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/rum/site_info/list`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { result?: Array<{ site_tag?: string }> };
  return data.result?.[0]?.site_tag || null;
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const token = (env as any).CF_ANALYTICS_TOKEN as string | undefined;
  const accountId = (env as any).CF_ACCOUNT_ID as string | undefined;
  if (!token || !accountId) {
    return Response.json({
      configured: false,
      missing: [!token && 'CF_ANALYTICS_TOKEN', !accountId && 'CF_ACCOUNT_ID'].filter(Boolean),
    });
  }

  const url = new URL(request.url);
  const days = Math.min(90, Math.max(1, Number(url.searchParams.get('days')) || 7));
  const now = Date.now();
  const startDate = isoDate(now - days * 86_400_000);
  const endDate = isoDate(now);

  try {
    const siteTag = await resolveSiteTag(accountId, token, (env as any).CF_RUM_SITE_TAG);
    if (!siteTag) {
      return Response.json({ configured: false, error: 'Não achei o site tag do Web Analytics. Defina CF_RUM_SITE_TAG.' });
    }

    const query = `query Traffic($accountTag: string!, $siteTag: string!, $start: string!, $end: string!) {
      viewer {
        accounts(filter: { accountTag: $accountTag }) {
          totals: rumPageloadEventsAdaptiveGroups(limit: 1, filter: { siteTag: $siteTag, date_geq: $start, date_leq: $end }) {
            count
            sum { visits }
          }
          series: rumPageloadEventsAdaptiveGroups(limit: 1000, orderBy: [date_ASC], filter: { siteTag: $siteTag, date_geq: $start, date_leq: $end }) {
            count
            sum { visits }
            dimensions { date }
          }
          topPages: rumPageloadEventsAdaptiveGroups(limit: 10, orderBy: [count_DESC], filter: { siteTag: $siteTag, date_geq: $start, date_leq: $end }) {
            count
            dimensions { requestPath }
          }
        }
      }
    }`;

    const res = await fetch(GQL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables: { accountTag: accountId, siteTag, start: startDate, end: endDate } }),
    });
    const json = (await res.json()) as any;
    if (json.errors?.length) {
      return Response.json({ configured: true, error: json.errors[0]?.message || 'Erro na GraphQL API' }, { status: 502 });
    }

    const acc = json?.data?.viewer?.accounts?.[0];
    if (!acc) return Response.json({ configured: true, error: 'Sem dados para a conta/site informados.' }, { status: 502 });

    const pageviews = (acc.totals || []).reduce((s: number, g: any) => s + (g.count || 0), 0);
    const visits = (acc.totals || []).reduce((s: number, g: any) => s + (g.sum?.visits || 0), 0);
    const series = (acc.series || []).map((g: any) => ({
      date: g.dimensions?.date,
      pageviews: g.count || 0,
      visits: g.sum?.visits || 0,
    }));
    const topPages = (acc.topPages || []).map((g: any) => ({
      path: g.dimensions?.requestPath || '/',
      pageviews: g.count || 0,
    }));

    return Response.json({ configured: true, days, range: { start: startDate, end: endDate }, pageviews, visits, series, topPages });
  } catch (err: any) {
    console.error('traffic error:', err);
    return Response.json({ configured: true, error: err.message || 'Erro ao consultar Analytics' }, { status: 500 });
  }
};
