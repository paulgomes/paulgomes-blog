/**
 * Modelo de dados canonico intermediario.
 * Formato NEUTRO entre conectores (entrada) e o formato nativo Astro (saida).
 * Nunca guardar HTML cru da origem: o corpo vira uma AST de blocos.
 */

export type InlineNode =
  | { t: 'text'; value: string }
  | { t: 'strong'; children: InlineNode[] }
  | { t: 'em'; children: InlineNode[] }
  | { t: 'code'; value: string }
  | { t: 'link'; url: string; title?: string; children: InlineNode[] }
  | { t: 'break' };

export type CanonicalBlock =
  | { t: 'paragraph'; children: InlineNode[] }
  | { t: 'heading'; level: 1 | 2 | 3 | 4 | 5 | 6; children: InlineNode[] }
  | { t: 'image'; ref: MediaRef; alt?: string; caption?: string }
  | { t: 'figure'; ref: MediaRef; caption?: InlineNode[] }
  | { t: 'table'; head: CanonicalBlock[][]; rows: CanonicalBlock[][][] }
  | { t: 'thematicBreak' }
  | { t: 'embed'; provider: 'youtube' | 'twitter' | 'generic'; url: string }
  | { t: 'code'; lang?: string; value: string }
  | { t: 'list'; ordered: boolean; items: CanonicalBlock[][] }
  | { t: 'quote'; children: CanonicalBlock[] }
  | { t: 'html'; raw: string }; // escape hatch sanitizado — ultimo recurso

export interface MediaRef {
  /** URL na origem (para download). */
  sourceUrl: string;
  /** Chave de destino no R2 quando ja resolvida (ex: YYYY/MM/uuid.ext). */
  destKey?: string;
  /** URL publica final (PUBLIC_R2_DOMAIN + destKey) quando ja resolvida. */
  destUrl?: string;
  mime?: string;
  bytes?: number;
  hash?: string;
  alt?: string;
  caption?: string;
}

export interface AuthorRef {
  sourceId: string;
  name: string;
  slug?: string;
  email?: string;
}

export type ContentStatus = 'ok' | 'empty' | 'corrupt' | 'needs-review';

export type DiagnosticLevel = 'error' | 'warning' | 'info';

export interface Diagnostic {
  level: DiagnosticLevel;
  code: string;
  message: string;
}

/** Enriquecimento por IA — separado, nunca aplicado sem aprovacao humana. */
export interface AiEnrichment {
  metaTitle?: string;
  metaDescription?: string;
  faq?: { q: string; a: string }[];
  tldr?: string;
  keyPoints?: string[];
  summary?: string;
}

export interface CanonicalPost {
  // Identidade & SEO
  sourceId: string;
  /** Slug de destino = slug ORIGINAL da origem (preserva URL canonica). */
  slug: string;
  originalUrl: string | null;
  title: string;
  description: string;

  // Conteudo (AST neutra)
  body: CanonicalBlock[];
  bodyFormat: 'markdown' | 'mdx';

  // Datas (ISO 8601 da ORIGEM; pubDate imutavel apos publicacao)
  publishedAt: string | null;
  updatedAt: string | null;

  // Taxonomia
  rawCategories: string[];
  /** Subconjunto de CATEGORIAS apos o gate de mapeamento. */
  mappedCategories: string[];
  rawTags: string[];

  authorRef: AuthorRef | null;
  heroMedia: MediaRef | null;
  inlineMedia: MediaRef[];

  // SEO da origem (campos com/sem destino — ver doc secao 2.3)
  seo: {
    metaTitle?: string;
    metaDescription?: string;
    focusKeyword?: string;
    // sem destino na plataforma atual (descartados explicitamente):
    canonicalUrl?: string;
    noindex?: boolean;
  };

  enrichment?: AiEnrichment;
  contentHash: string;
  status: ContentStatus;
  warnings: Diagnostic[];
}
