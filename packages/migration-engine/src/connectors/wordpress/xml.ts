/**
 * Conector WordPress XML (WXR / "export do WordPress").
 * Implementa SourceConnector: le e entrega RawEntity cru (item do WXR).
 * A conversao para CanonicalPost vive em ./transform.ts (no core/conector, nao acoplada ao resto).
 */
import { XMLParser } from 'fast-xml-parser';
import type {
  SourceConnector,
  ConnectorCapabilities,
  ConnectorConfig,
  ValidationResult,
  RawEntity,
  RawAuthor,
  RawTaxonomy,
  MediaRefLite,
} from '../../core/types/connector.js';
import type { ConnectorContext } from '../../core/types/context.js';
import type { MediaBlob } from '../../core/types/media.js';
import { detectMime } from '../../core/validators/security.js';

export interface WpItem {
  title?: string;
  link?: string;
  pubDate?: string;
  'dc:creator'?: string;
  'content:encoded'?: string;
  'excerpt:encoded'?: string;
  'wp:post_id'?: string | number;
  'wp:post_name'?: string;
  'wp:post_date'?: string;
  'wp:post_date_gmt'?: string;
  'wp:post_modified'?: string;
  'wp:post_type'?: string;
  'wp:status'?: string;
  category?: WpCategory | WpCategory[];
}

export interface WpCategory {
  '@_domain'?: string;   // 'category' | 'post_tag'
  '@_nicename'?: string;
  '#text'?: string;
}

function toArray<T>(v: T | T[] | undefined | null): T[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

export class WordPressXmlConnector implements SourceConnector {
  readonly id = 'wordpress-xml';
  readonly capabilities: ConnectorCapabilities = {
    posts: true,
    pages: true,
    authors: true,
    categories: true,
    tags: true,
    media: true,
    incrementalSync: false,
  };

  private ctx!: ConnectorContext;
  private config!: ConnectorConfig;
  private channel: Record<string, unknown> | null = null;

  async connect(ctx: ConnectorContext, config: ConnectorConfig): Promise<void> {
    this.ctx = ctx;
    this.config = config;
    // Conteudo deve vir carregado (upload/leitura feita pelo chamador — CLI ou painel).
    // O conector NUNCA toca no filesystem, pra ser browser/Functions-safe.
    const xml = config.sourceContent;
    if (xml === undefined) {
      throw new Error('WordPressXmlConnector: forneca config.sourceContent (conteudo do XML).');
    }
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      // CDATA mesclado como valor da tag (string), nao objeto — campos do WXR
      // (post_type, status, content:encoded, ...) vem em CDATA.
      processEntities: true,
      trimValues: false,
    });
    const doc = parser.parse(xml) as { rss?: { channel?: Record<string, unknown> } };
    this.channel = doc.rss?.channel ?? null;
    ctx.logger.info('wordpress-xml: conectado', { source: config.source });
  }

  async validate(): Promise<ValidationResult> {
    if (!this.channel) {
      return { ok: false, diagnostics: [{ level: 'error', code: 'WXR_INVALID', message: 'XML sem rss>channel — nao parece um export do WordPress.' }] };
    }
    const items = toArray(this.channel['item']);
    if (items.length === 0) {
      return { ok: false, diagnostics: [{ level: 'error', code: 'WXR_EMPTY', message: 'Nenhum <item> encontrado no WXR.' }] };
    }
    return { ok: true, diagnostics: [{ level: 'info', code: 'WXR_OK', message: `${items.length} itens no WXR.` }] };
  }

  private items(): WpItem[] {
    return toArray(this.channel?.['item'] as WpItem | WpItem[] | undefined);
  }

  async *fetchPosts(): AsyncIterable<RawEntity> {
    for (const item of this.items()) {
      if ((item['wp:post_type'] ?? 'post') !== 'post') continue;
      if ((item['wp:status'] ?? 'publish') !== 'publish') continue;
      yield { sourceId: String(item['wp:post_id'] ?? item['wp:post_name'] ?? item.link ?? ''), kind: 'post', raw: item };
    }
  }

  async *fetchPages(): AsyncIterable<RawEntity> {
    for (const item of this.items()) {
      if (item['wp:post_type'] !== 'page') continue;
      if ((item['wp:status'] ?? 'publish') !== 'publish') continue;
      yield { sourceId: String(item['wp:post_id'] ?? item.link ?? ''), kind: 'page', raw: item };
    }
  }

  async *fetchAuthors(): AsyncIterable<RawAuthor> {
    const authors = toArray(this.channel?.['wp:author'] as Record<string, unknown> | Record<string, unknown>[] | undefined);
    for (const a of authors) {
      yield {
        sourceId: String(a['wp:author_id'] ?? a['wp:author_login'] ?? ''),
        name: String(a['wp:author_display_name'] ?? a['wp:author_login'] ?? 'Autor'),
        slug: a['wp:author_login'] ? String(a['wp:author_login']) : undefined,
        email: a['wp:author_email'] ? String(a['wp:author_email']) : undefined,
      };
    }
  }

  async *fetchCategories(): AsyncIterable<RawTaxonomy> {
    const cats = toArray(this.channel?.['wp:category'] as Record<string, unknown> | Record<string, unknown>[] | undefined);
    for (const c of cats) {
      yield {
        sourceId: String(c['wp:term_id'] ?? c['wp:category_nicename'] ?? ''),
        name: String(c['wp:cat_name'] ?? ''),
        slug: c['wp:category_nicename'] ? String(c['wp:category_nicename']) : undefined,
      };
    }
  }

  async downloadMedia(ref: MediaRefLite): Promise<MediaBlob> {
    const res = await fetch(ref.url, { signal: this.ctx.signal });
    if (!res.ok) throw new Error(`download falhou (${res.status}): ${ref.url}`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    const mime = detectMime(bytes) ?? res.headers.get('content-type') ?? 'application/octet-stream';
    return { bytes, mime, filename: ref.url.split('/').pop() ?? undefined };
  }

  async disconnect(): Promise<void> {
    this.channel = null;
  }
}
