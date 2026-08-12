#!/usr/bin/env node
/**
 * Auditoria de SEO sobre o `dist/` construído.
 *
 * Existe porque um diagnóstico do Search Console leva dias para refletir um
 * erro que o build já sabia. Estas checagens rodam em segundos e pegam as
 * causas mais comuns de página não indexada ANTES do deploy:
 *
 *   1. Destino de redirect que aponta para página inexistente (301 -> 404)
 *   2. Redirect encadeado (destino sem barra final vira 301 -> 308)
 *   3. Origem de redirect que também é página real (regra que nunca dispara)
 *   4. Link interno quebrado
 *   5. Link interno que passa por redirect (desperdiça orçamento de rastreio)
 *   6. URL no sitemap que não existe, redireciona ou não tem barra final
 *   7. Post sem description (o Google inventa o snippet)
 *   8. Post sem título, ou com caractere de escape literal no frontmatter
 *   9. Conteúdo raso (candidato natural a "rastreada, mas não indexada")
 *
 * Uso:
 *   npm run build && npm run seo:audit
 *   npm run seo:audit -- --strict     # falha o processo com qualquer aviso
 *
 * Só os itens 1 a 8 falham por padrão. Conteúdo raso é decisão editorial, não
 * defeito técnico — aparece como aviso.
 */

import { existsSync, readFileSync, statSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const BLOG = path.join(ROOT, 'src/content/blog');
const REDIRECTS = path.join(ROOT, 'public/_redirects');
const SITE = 'https://paulgomes.com.br';

const STRICT = process.argv.includes('--strict');
const THIN_WORDS = 300;

const errors = [];
const warnings = [];
const err = (cat, msg) => errors.push({ cat, msg });
const warn = (cat, msg) => warnings.push({ cat, msg });

// --- helpers ---------------------------------------------------------------

/** Uma rota existe no dist? Aceita `/a/b/` e `/a/b`. */
function routeExists(route) {
  const clean = route.split('#')[0].split('?')[0].replace(/^\/+/, '').replace(/\/+$/, '');
  if (clean === '') return existsSync(path.join(DIST, 'index.html'));
  const asDir = path.join(DIST, clean, 'index.html');
  const asFile = path.join(DIST, clean);
  return existsSync(asDir) || (existsSync(asFile) && statSync(asFile).isFile());
}

async function walkHtml(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walkHtml(full)));
    else if (entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}

function parseRedirects() {
  if (!existsSync(REDIRECTS)) return [];
  return readFileSync(REDIRECTS, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => l.split(/\s+/))
    .filter((p) => p.length >= 2)
    .map(([from, to, code]) => ({ from, to, code: code || '' }));
}

// --- 1-3: redirects --------------------------------------------------------

function auditRedirects(rules) {
  const seen = new Map();

  for (const { from, to } of rules) {
    if (!to.startsWith('http')) {
      if (!routeExists(to)) err('redirect', `destino inexistente: ${from} -> ${to}`);
      // Sem barra final o Astro (format: 'directory') emite outro redirect.
      if (!to.endsWith('/')) err('redirect', `destino sem barra final (encadeia 301->308): ${from} -> ${to}`);
    }
    if (routeExists(from)) {
      err('redirect', `origem também é página real, a regra nunca dispara: ${from}`);
    }
    // Só é duplicata de verdade quando a MESMA origem aponta para destinos
    // DIFERENTES. Ter `/about` e `/about/` para o mesmo destino é a prática
    // correta, não um erro — as duas formas precisam ser cobertas.
    const key = from.replace(/\/+$/, '') || '/';
    if (seen.has(key) && seen.get(key) !== to) {
      warn('redirect', `origem com destinos conflitantes: ${from} -> ${to} e -> ${seen.get(key)}`);
    } else {
      seen.set(key, to);
    }
  }
  return seen;
}

// --- 4-5: links internos ---------------------------------------------------

const SKIP_EXT = /\.(png|jpe?g|webp|avif|svg|gif|ico|css|js|mjs|xml|json|txt|pdf|zip)$/i;

async function auditInternalLinks(files, redirectSources) {
  const broken = new Map();
  const viaRedirect = new Map();

  for (const file of files) {
    const page = '/' + path.relative(DIST, file).replace(/index\.html$/, '');
    const html = await readFile(file, 'utf8');
    for (const m of html.matchAll(/href="(\/[^"]*)"/g)) {
      const href = m[1];
      if (href.startsWith('//') || SKIP_EXT.test(href)) continue;
      if (!routeExists(href)) {
        if (!broken.has(href)) broken.set(href, []);
        broken.get(href).push(page);
      } else {
        const key = href.replace(/\/+$/, '') || '/';
        if (key !== '/' && redirectSources.has(key)) {
          if (!viaRedirect.has(href)) viaRedirect.set(href, []);
          viaRedirect.get(href).push(page);
        }
      }
    }
  }

  for (const [href, pages] of broken) {
    err('link', `link interno quebrado: ${href} (em ${pages.length} página(s), ex.: ${pages[0]})`);
  }
  for (const [href, pages] of viaRedirect) {
    warn('link', `link interno passa por redirect: ${href} (em ${pages.length} página(s))`);
  }
}

// --- 6: sitemap ------------------------------------------------------------

function auditSitemap() {
  const file = path.join(DIST, 'sitemap-0.xml');
  if (!existsSync(file)) {
    err('sitemap', 'sitemap-0.xml não encontrado no dist');
    return 0;
  }
  const xml = readFileSync(file, 'utf8');
  const urls = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);

  for (const url of urls) {
    const route = url.replace(SITE, '');
    if (!routeExists(route)) err('sitemap', `URL no sitemap não existe: ${url}`);
    if (!url.endsWith('/') && !url.match(/\.[a-z]+$/i)) {
      err('sitemap', `URL no sitemap sem barra final (gera redirect): ${url}`);
    }
    if (route.startsWith('/painel') || route.startsWith('/og/')) {
      err('sitemap', `rota privada vazando no sitemap: ${url}`);
    }
  }
  return urls.length;
}

// --- 7-9: frontmatter e profundidade --------------------------------------

async function auditContent() {
  const files = (await readdir(BLOG)).filter((f) => /\.(md|mdx)$/.test(f));
  let thin = 0;
  let longDesc = 0;

  for (const file of files) {
    const slug = file.replace(/\.(md|mdx)$/, '');
    const raw = await readFile(path.join(BLOG, file), 'utf8');
    const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(raw);
    if (!m) {
      err('frontmatter', `${slug}: frontmatter ausente ou malformado`);
      continue;
    }
    const [, fm, body] = m;

    const get = (key) => {
      const line = new RegExp(`^${key}:\\s*(.*)$`, 'm').exec(fm);
      return line ? line[1].trim().replace(/^["']|["']$/g, '') : '';
    };

    const title = get('title');
    const description = get('description');

    if (!title) err('frontmatter', `${slug}: sem title`);
    // "\n" literal no YAML vaza para <title> e para o JSON-LD.
    if (/\\[nrt]/.test(title)) err('frontmatter', `${slug}: escape literal no title -> "${title}"`);
    if (/\\[nrt]/.test(description)) err('frontmatter', `${slug}: escape literal na description`);

    if (!description) {
      err('frontmatter', `${slug}: sem description (o Google inventa o snippet)`);
    } else if (description.length > 165) {
      // Herança da importação do WordPress, que cortava em ~200 chars. Não
      // impede indexação — só desperdiça o final do snippet. Contado em
      // agregado para não afogar os problemas reais em ruído.
      longDesc++;
    }

    const words = body
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/[#*_>\-[\]()!]/g, ' ')
      .split(/\s+/)
      .filter(Boolean).length;

    if (words === 0) {
      err('conteudo', `${slug}: post SEM CORPO — página vazia publicada`);
    } else if (words < THIN_WORDS) {
      thin++;
      warn('conteudo', `${slug}: ${words} palavras (abaixo de ${THIN_WORDS})`);
    }
  }
  return { total: files.length, thin, longDesc };
}

// --- main ------------------------------------------------------------------

if (!existsSync(DIST)) {
  console.error('dist/ não encontrado. Rode `npm run build` antes.');
  process.exit(1);
}

const rules = parseRedirects();
const redirectSources = auditRedirects(rules);
const htmlFiles = await walkHtml(DIST);
await auditInternalLinks(htmlFiles, redirectSources);
const sitemapCount = auditSitemap();
const content = await auditContent();

console.log('=== Auditoria de SEO ===');
console.log(`páginas HTML     ${htmlFiles.length}`);
console.log(`regras _redirects ${rules.length}`);
console.log(`URLs no sitemap  ${sitemapCount}`);
console.log(`posts            ${content.total} (${content.thin} com menos de ${THIN_WORDS} palavras)`);
console.log(`descriptions > 165 chars: ${content.longDesc} (o Google trunca o final; herança da importação)`);

const byCat = (list) => {
  const g = {};
  for (const { cat, msg } of list) (g[cat] ??= []).push(msg);
  return g;
};

if (errors.length) {
  console.log(`\n--- ERROS (${errors.length}) ---`);
  for (const [cat, msgs] of Object.entries(byCat(errors))) {
    console.log(`\n[${cat}]`);
    for (const m of msgs.slice(0, 20)) console.log('  ✗ ' + m);
    if (msgs.length > 20) console.log(`  … e mais ${msgs.length - 20}`);
  }
}

if (warnings.length) {
  console.log(`\n--- AVISOS (${warnings.length}) ---`);
  for (const [cat, msgs] of Object.entries(byCat(warnings))) {
    console.log(`\n[${cat}] ${msgs.length}`);
    for (const m of msgs.slice(0, 12)) console.log('  · ' + m);
    if (msgs.length > 12) console.log(`  … e mais ${msgs.length - 12}`);
  }
}

if (!errors.length && !warnings.length) console.log('\nOK — nenhum problema encontrado.');
else if (!errors.length) console.log('\nSem erros. Os avisos acima são decisão editorial, não defeito técnico.');

if (errors.length || (STRICT && warnings.length)) process.exit(1);
