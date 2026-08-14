#!/usr/bin/env node
/**
 * Sincroniza os vídeos do canal do YouTube para `src/data/videos.json`.
 *
 * Por que gravar um JSON no repo em vez de buscar no build:
 * o site segue a mesma lógica do resto do projeto — conteúdo vive no Git, o
 * build é determinístico e funciona offline. Um build que depende de uma
 * chamada externa quebra quando a API muda, oscila ou está fora do ar, e a
 * página de vídeos sumiria do site sem ninguém alterar uma linha.
 *
 * Duas fontes, na ordem de preferência:
 *
 *   1. YouTube Data API (se `YOUTUBE_API_KEY` estiver definida)
 *      Devolve o catálogo COMPLETO, paginado. É o caminho para "todos os
 *      vídeos". A chave é gratuita no Google Cloud (quota diária folgada para
 *      este uso).
 *
 *   2. Feed RSS público (sem chave)
 *      Oficial e estável, mas o YouTube limita a resposta aos 15 vídeos mais
 *      recentes. Não há parâmetro de paginação — é limite do endpoint, não da
 *      implementação.
 *
 * Uso:
 *   npm run videos:sync                      # RSS, 15 mais recentes
 *   YOUTUBE_API_KEY=... npm run videos:sync  # API, catálogo completo
 */

import { execFile } from 'node:child_process';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);

/**
 * GET que funciona com e sem proxy corporativo.
 *
 * O `fetch` do Node 22 IGNORA as variáveis HTTP_PROXY/HTTPS_PROXY — ele abre a
 * conexão direto e, num ambiente que exige proxy, o retorno é 403. Quando essas
 * variáveis existem, delegamos ao curl, que as respeita. Sem proxy (o caso
 * normal, na máquina do dono ou em CI), segue pelo fetch nativo.
 */
async function httpGet(url) {
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;

  if (proxy) {
    const { stdout } = await execFileAsync(
      'curl',
      ['-sSL', '--max-time', '30', '-A', 'paulgomes-blog/1.0', '--fail', url],
      { maxBuffer: 32 * 1024 * 1024 }
    );
    return stdout;
  }

  const res = await fetch(url, { headers: { 'user-agent': 'paulgomes-blog/1.0' } });
  if (!res.ok) throw new Error(`${url} respondeu ${res.status}`);
  return await res.text();
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'src/data/videos.json');

const CHANNEL_ID = 'UCmZW3r4X8Lk7VsGsGVkr_lw';
const CHANNEL_HANDLE = '@paulgomesx';
const CHANNEL_URL = `https://www.youtube.com/${CHANNEL_HANDLE}`;

const RSS = `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`;
const API = 'https://www.googleapis.com/youtube/v3';

/** Decodifica as entidades XML que aparecem em título e descrição. */
function decode(s) {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function tag(xml, name) {
  const m = new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`).exec(xml);
  return m ? decode(m[1].trim()) : '';
}

// --- fonte 1: RSS ----------------------------------------------------------

async function fromRss() {
  const xml = await httpGet(RSS);

  const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map((m) => m[1]);
  return entries.map((e) => {
    const id = tag(e, 'yt:videoId');
    const description = tag(e, 'media:description');
    return {
      id,
      title: tag(e, 'title'),
      published: tag(e, 'published').slice(0, 10),
      // A descrição do YouTube é longa e cheia de hashtag/link; aqui vira
      // resumo curto, que é o uso na listagem.
      description: description.split('\n')[0].slice(0, 280),
      thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      url: `https://www.youtube.com/watch?v=${id}`,
    };
  });
}

// --- fonte 2: Data API -----------------------------------------------------

async function fromApi(key) {
  // O canal expõe uma playlist "uploads" com todo o histórico.
  const ch = JSON.parse(await httpGet(`${API}/channels?part=contentDetails&id=${CHANNEL_ID}&key=${key}`));
  const uploads = ch?.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploads) throw new Error('playlist de uploads não encontrada');

  const videos = [];
  let pageToken = '';
  do {
    const url =
      `${API}/playlistItems?part=snippet&playlistId=${uploads}&maxResults=50&key=${key}` +
      (pageToken ? `&pageToken=${pageToken}` : '');
    const data = JSON.parse(await httpGet(url));

    for (const item of data.items ?? []) {
      const s = item.snippet;
      const id = s?.resourceId?.videoId;
      if (!id) continue;
      videos.push({
        id,
        title: s.title,
        published: (s.publishedAt || '').slice(0, 10),
        description: (s.description || '').split('\n')[0].slice(0, 280),
        thumbnail:
          s.thumbnails?.maxres?.url ||
          s.thumbnails?.high?.url ||
          `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
        url: `https://www.youtube.com/watch?v=${id}`,
      });
    }
    pageToken = data.nextPageToken || '';
  } while (pageToken);

  return videos;
}

// --- main ------------------------------------------------------------------

const key = process.env.YOUTUBE_API_KEY;
let videos;
let source;

if (key) {
  videos = await fromApi(key);
  source = 'youtube-data-api';
} else {
  videos = await fromRss();
  source = 'rss';
}

// "Privado"/"Excluído" aparecem quando um vídeo saiu do ar mas segue na
// playlist de uploads. Publicar um card que leva a lugar nenhum é pior que
// omitir.
videos = videos.filter((v) => v.id && v.title && !/^(Private|Deleted) video$/i.test(v.title));
videos.sort((a, b) => (b.published || '').localeCompare(a.published || ''));

const payload = {
  channel: { id: CHANNEL_ID, handle: CHANNEL_HANDLE, url: CHANNEL_URL, name: 'Paul Gomes' },
  source,
  // Sem `syncedAt`: uma data que muda a cada execução produz diff em toda
  // sincronização, mesmo quando nenhum vídeo mudou.
  count: videos.length,
  videos,
};

await mkdir(path.dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(payload, null, 2) + '\n', 'utf8');

console.log(`fonte: ${source}`);
console.log(`vídeos gravados: ${videos.length}`);
if (source === 'rss') {
  console.log('\nO RSS do YouTube devolve no máximo os 15 vídeos mais recentes.');
  console.log('Para o catálogo completo, rode com YOUTUBE_API_KEY definida.');
}
console.log(`arquivo: ${path.relative(ROOT, OUT)}`);
