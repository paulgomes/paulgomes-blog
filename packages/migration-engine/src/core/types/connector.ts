/**
 * Interfaces de conector. ISP: FONTE (le) e DESTINO (exporta) separados.
 * A conversao RawEntity -> Canonical vive no CORE (transformers), nao no conector.
 * O conector NUNCA conhece R2/storage: so faz downloadMedia (bytes).
 */
import type { ConnectorContext } from './context.js';
import type { CanonicalPost, AuthorRef, Diagnostic } from './canonical.js';
import type { MediaBlob } from './media.js';

export type ConnectorId = string; // 'wordpress-xml' | 'ghost' | 'rss' | 'json' | ...
export type ExporterId = string;  // 'markdown' | 'mdx' | 'json' | 'wpxml' | ...

/** O que ESTA fonte realmente suporta (evita stubs mortos). */
export interface ConnectorCapabilities {
  posts: boolean;
  pages: boolean;
  authors: boolean;
  categories: boolean;
  tags: boolean;
  media: boolean;
  incrementalSync: boolean;
}

export interface ConnectorConfig {
  /** rotulo/origem (caminho de arquivo, URL de API) — usado em logs. */
  source: string;
  /**
   * Conteudo ja carregado (ex: XML enviado via upload no painel).
   * Quando presente, o conector usa isto e NAO toca no filesystem —
   * o que permite rodar o engine no navegador / em Cloudflare Functions.
   */
  sourceContent?: string;
  /** opcoes livres por conector (sem segredos; segredos vem do SecretResolver). */
  options?: Record<string, unknown>;
}

export interface ValidationResult {
  ok: boolean;
  diagnostics: Diagnostic[];
}

/** Entidade crua, no formato nativo da fonte (antes da conversao). */
export interface RawEntity {
  sourceId: string;
  kind: 'post' | 'page';
  /** payload bruto especifico da fonte (ex: item do WP XML). */
  raw: unknown;
}

export interface RawAuthor {
  sourceId: string;
  name: string;
  slug?: string;
  email?: string;
}

export interface RawTaxonomy {
  sourceId: string;
  name: string;
  slug?: string;
  parent?: string;
}

export interface RawMedia {
  sourceId: string;
  url: string;
  mime?: string;
  alt?: string;
}

export interface MediaRefLite {
  url: string;
}

export interface SyncCursor {
  since: string; // ISO 8601
  lastSourceId?: string;
}

export interface SyncDelta {
  sourceId: string;
  change: 'created' | 'updated' | 'deleted';
  entity?: RawEntity;
}

export interface SourceQuery {
  limit?: number;
  afterSourceId?: string;
}

/** FONTE: so le e entrega RawEntity cru. Nao converte, nao conhece storage. */
export interface SourceConnector {
  readonly id: ConnectorId;
  readonly capabilities: ConnectorCapabilities;

  connect(ctx: ConnectorContext, config: ConnectorConfig): Promise<void>;
  validate(): Promise<ValidationResult>;

  // Leitura — AsyncIterable p/ streaming (100k itens nao cabem em 128MB).
  fetchPosts(query?: SourceQuery): AsyncIterable<RawEntity>;
  fetchPages?(query?: SourceQuery): AsyncIterable<RawEntity>;
  fetchAuthors?(): AsyncIterable<RawAuthor>;
  fetchCategories?(): AsyncIterable<RawTaxonomy>;
  fetchTags?(): AsyncIterable<RawTaxonomy>;
  fetchMedia?(query?: SourceQuery): AsyncIterable<RawMedia>;

  /** So bytes da origem. O upload p/ R2 e responsabilidade do stage 'store'. */
  downloadMedia(ref: MediaRefLite): Promise<MediaBlob>;

  sync?(since: SyncCursor): AsyncIterable<SyncDelta>;
  disconnect(): Promise<void>;
}

/** DESTINO/EXPORT: papel oposto, interface separada. */
export interface Exporter {
  readonly id: ExporterId;
  export(canonical: CanonicalPost): Promise<ExportArtifact>;
}

export interface ExportArtifact {
  /** caminho relativo sugerido (ex: src/content/blog/<slug>.md). */
  path: string;
  content: string;
  mime: string;
}

export type { AuthorRef };
