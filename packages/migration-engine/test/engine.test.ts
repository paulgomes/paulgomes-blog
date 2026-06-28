import { describe, it, expect } from 'vitest';
import {
  slugify,
  normalizeDate,
  buildFrontmatter,
  mapCategories,
  assertCategoriesInEnum,
  KNOWN_CATEGORIES,
  htmlToMarkdown,
  markdownToBlocks,
  blocksToMarkdown,
  contentHash,
  wpItemToCanonical,
  renderMarkdown,
  runImport,
  publishPosts,
  redirectLinesFor,
} from '../dist/index.js';
import type { PublishablePost } from '../dist/core/pipeline/import-pipeline.js';
import { mkdtemp, readFile, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const noopLogger: any = { debug() {}, info() {}, warn() {}, error() {}, child() { return noopLogger; } };
const noSecrets: any = { get: async () => undefined };

describe('slugify', () => {
  it('remove acentos e colapsa nao-alfanumericos', () => {
    expect(slugify('Olá, Mundo! Ção')).toBe('ola-mundo-cao');
    expect(slugify('  --A B--  ')).toBe('a-b');
    expect(slugify(null)).toBe('');
  });
});

describe('normalizeDate', () => {
  it('mantem YYYY-MM-DD e nao "inventa agora"', () => {
    expect(normalizeDate('2018-04-08T20:00:00.000Z')).toBe('2018-04-08');
    expect(normalizeDate('2018-04-08')).toBe('2018-04-08');
  });
});

describe('gate de categorias', () => {
  it('mapeia origem->enum e separa as sem destino', () => {
    const r = mapCategories(['Tecnologia', 'Marketing', 'IA'], { Marketing: 'Negócios' }, KNOWN_CATEGORIES);
    expect(r.mapped.sort()).toEqual(['IA', 'Negócios', 'Tecnologia']);
    expect(r.unmapped).toEqual([]);
  });
  it('categoria livre sem mapeamento vira unmapped (nunca entra)', () => {
    const r = mapCategories(['Lifestyle'], {}, KNOWN_CATEGORIES);
    expect(r.mapped).toEqual([]);
    expect(r.unmapped).toEqual(['Lifestyle']);
  });
  it('assert bloqueia categoria fora do enum', () => {
    expect(assertCategoriesInEnum(['Tecnologia'], KNOWN_CATEGORIES)).toHaveLength(0);
    const errs = assertCategoriesInEnum(['Inexistente'], KNOWN_CATEGORIES);
    expect(errs).toHaveLength(1);
    expect(errs[0]!.code).toBe('CATEGORY_NOT_IN_ENUM');
  });
});

describe('buildFrontmatter', () => {
  it('espelha o formato do projeto', () => {
    const fm = buildFrontmatter({ title: 'Olá "Mundo"', description: 'desc', pubDate: '2020-01-02', categorias: ['IA', 'SEO'] });
    expect(fm).toContain('title: "Olá \\"Mundo\\""');
    expect(fm).toContain('pubDate: 2020-01-02');
    expect(fm).toContain('  - IA');
    expect(fm.startsWith('---\n')).toBe(true);
    expect(fm.endsWith('---\n\n')).toBe(true);
  });
});

describe('html -> markdown -> blocks -> markdown', () => {
  it('converte HTML/Gutenberg e remove comentarios wp', () => {
    const md = htmlToMarkdown('<!-- wp:paragraph --><p>Olá <strong>mundo</strong> e <a href="https://x.com">link</a>.</p><!-- /wp:paragraph --><h2>Título</h2><ul><li>a</li><li>b</li></ul>');
    expect(md).toContain('**mundo**');
    expect(md).toContain('[link](https://x.com)');
    expect(md).toContain('## Título');
    expect(md).not.toContain('wp:');
  });
  it('roundtrip de blocos preserva estrutura', () => {
    const md = '# T\n\nparagrafo um\n\n- a\n- b\n\n> citação';
    const blocks = markdownToBlocks(md);
    const out = blocksToMarkdown(blocks);
    expect(out).toContain('# T');
    expect(out).toContain('paragrafo um');
    expect(out).toContain('- a');
    expect(out).toContain('> citação');
  });
});

describe('contentHash', () => {
  it('estavel e diferente por conteudo', () => {
    expect(contentHash('abc')).toBe(contentHash('abc'));
    expect(contentHash('abc')).not.toBe(contentHash('abd'));
    expect(contentHash('abc')).toMatch(/^[0-9a-f]{28}$/);
  });
});

describe('redirectLinesFor', () => {
  it('gera 301 so quando o slug muda', () => {
    const base = (originalUrl: string, slug: string): PublishablePost => ({ slug, title: 't', originalUrl, content: '', status: 'ok', categorias: [], warnings: 0 });
    expect(redirectLinesFor(base('https://paulgomes.com.br/igual/', 'igual'), 'https://paulgomes.com.br')).toEqual([]);
    expect(redirectLinesFor(base('https://paulgomes.com.br/blog/antigo/', 'novo'), 'https://paulgomes.com.br')).toEqual(['/blog/antigo /novo/ 301']);
  });
});

const WXR = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:wp="http://wordpress.org/export/1.2/">
<channel>
  <item>
    <title>Primeiro Post</title>
    <link>https://paulgomes.com.br/primeiro-post/</link>
    <dc:creator><![CDATA[Paul]]></dc:creator>
    <content:encoded><![CDATA[<p>Corpo com <strong>negrito</strong>.</p>]]></content:encoded>
    <wp:post_id>10</wp:post_id>
    <wp:post_name><![CDATA[primeiro-post]]></wp:post_name>
    <wp:post_date_gmt><![CDATA[2021-05-04 12:00:00]]></wp:post_date_gmt>
    <wp:post_type><![CDATA[post]]></wp:post_type>
    <wp:status><![CDATA[publish]]></wp:status>
    <category domain="category" nicename="tecnologia"><![CDATA[Tecnologia]]></category>
  </item>
  <item>
    <title>Rascunho Ignorado</title>
    <wp:post_id>11</wp:post_id>
    <wp:post_name><![CDATA[rascunho]]></wp:post_name>
    <wp:post_type><![CDATA[post]]></wp:post_type>
    <wp:status><![CDATA[draft]]></wp:status>
  </item>
</channel></rss>`;

describe('wpItemToCanonical', () => {
  it('preserva slug e data originais, mapeia categoria valida', () => {
    const item: any = {
      title: 'T', link: 'https://x/y/', 'wp:post_id': '1', 'wp:post_name': 'meu-slug',
      'content:encoded': '<p>oi</p>', 'wp:post_date_gmt': '2019-07-15 10:00:00',
      'wp:post_type': 'post', 'wp:status': 'publish',
      category: { '@_domain': 'category', '#text': 'Tecnologia' },
    };
    const c = wpItemToCanonical(item, { categoryMapping: {}, allowedCategories: KNOWN_CATEGORIES });
    expect(c.slug).toBe('meu-slug');
    expect(c.publishedAt?.slice(0, 10)).toBe('2019-07-15');
    expect(c.mappedCategories).toEqual(['Tecnologia']);
    expect(renderMarkdown(c)).toContain('pubDate: 2019-07-15');
  });
});

describe('runImport (pipeline ponta-a-ponta)', () => {
  it('importa so posts publish, 0 erros, datas preservadas', async () => {
    const res = await runImport({
      connectorId: 'wordpress-xml', source: 'mem', sourceContent: WXR,
      categoryMapping: {}, allowedCategories: KNOWN_CATEGORIES,
      logger: noopLogger, signal: AbortSignal.timeout(30000), secrets: noSecrets,
    });
    expect(res.report.errors).toBe(0);
    expect(res.report.totals.posts).toBe(1); // o draft e ignorado
    expect(res.posts[0]!.slug).toBe('primeiro-post');
    expect(res.posts[0]!.content).toContain('**negrito**');
  });
});

describe('publishPosts', () => {
  it('escreve novos, PULA existentes e gera redirects', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'me-pub-'));
    const blogDir = join(dir, 'blog');
    await mkdir(blogDir, { recursive: true });
    await writeFile(join(blogDir, 'existe.md'), 'ORIGINAL', 'utf-8');
    const redirectsFile = join(dir, '_redirects');

    const posts: PublishablePost[] = [
      { slug: 'existe', title: 'x', originalUrl: 'https://paulgomes.com.br/existe/', content: 'NOVO', status: 'ok', categorias: [], warnings: 0 },
      { slug: 'novo', title: 'y', originalUrl: 'https://paulgomes.com.br/blog/antigo/', content: '# novo', status: 'ok', categorias: ['IA'], warnings: 0 },
    ];
    const r = await publishPosts(posts, { blogDir, redirectsFile, siteUrl: 'https://paulgomes.com.br', allowedCategories: KNOWN_CATEGORIES, logger: noopLogger });

    expect(r.written).toEqual(['novo']);
    expect(r.skipped).toEqual(['existe']);
    expect(await readFile(join(blogDir, 'existe.md'), 'utf-8')).toBe('ORIGINAL'); // preservado
    expect(r.redirectsAdded).toContain('/blog/antigo /novo/ 301');
  });
});
