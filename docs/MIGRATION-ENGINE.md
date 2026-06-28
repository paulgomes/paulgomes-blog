# Migration Engine — Documento de Arquitetura e Plano (Core Platform)

> Versão 2.0 (Final) · 2026-06-28 · Autor: Arquitetura de Software Sênior · Status: Proposta para aprovação do dono
> Plataforma-alvo: blog Astro (`astro@^6`, `output: static`) + Cloudflare Pages/Functions + D1 (`paulgomes-painel`) + R2 (`paulgomes-uploads`).
> **Restrição-mãe (Invariante #1): o build tem de permanecer verde.** Nada neste documento pode quebrar `astro build`.
>
> *Esta versão 2.0 corrige a v1.0 contra os arquivos reais do repositório: ordem de commit real (Git-primeiro), estado de compensação inexistente (`git_synced`), formato de redirect real, ausência de bindings de Queues/KV/Images, escopo `tenantId` removido, e os limites duros de Cloudflare/GitHub/D1 em escala. Cada correção está marcada com [CORRIGIDO].*

---

## 0. PRÉ-PROVISIONAMENTO DE INFRAESTRUTURA (bloqueante) [CORRIGIDO]

A v1.0 assumia infra que **não existe**. `wrangler.toml` real expõe **somente** dois bindings: `DB` (D1) e `MEDIA` (R2). Não há `[[queues]]`, `[[kv_namespaces]]` nem binding de Cloudflare Images. Antes de qualquer fase que dependa deles, é preciso provisionar:

| Recurso | Comando/ação | Bloqueia | Custo |
|---|---|---|---|
| **Worker consumer dedicado** (não Pages) | novo projeto Worker + `wrangler.toml` próprio, com bindings `DB`/`MEDIA`/`[[queues.consumers]]` | Anel 2 | incluído |
| **Cloudflare Queue(s)** | `wrangler queues create migration-chunks` + `[[queues.producers]]` no Pages, `[[queues.consumers]]` no Worker | Fase 6 (e sync) | incluído (plano pago) |
| **KV namespace** (rate-limit) | `wrangler kv namespace create RATELIMIT` + binding | Fase 0 | baixo |
| **Cloudflare Images** (opcional) | ativar no dashboard + binding | Fase 2 (variantes) | **alto p/ 1M imgs — ver §6** |
| **Durable Object** (opcional, progresso WS) | só se WebSocket for exigido; senão polling | — | só se usado |

**Ponto estrutural crítico [CORRIGIDO]:** Pages Functions **não podem consumir** Cloudflare Queues — só **produzir** mensagens. O consumer (`queue()` handler) exige um **Worker dedicado**, com deploy e `wrangler.toml` independentes. O "Anel 2" da v1.0 que misturava "Queue Consumer + Pages Functions" no mesmo runtime é impossível. A topologia correta: **Pages (painel) enfileira → Worker dedicado consome → D1/R2/GitHub**. O consumer tem CPU limit próprio (não é ilimitado), batch máx. 100 mensagens, 6 retries default.

---

## 1. AUDITORIA DA ARQUITETURA ATUAL

### 1.1 Síntese do que existe

A Core Platform é um **app Astro single-package, não-monorepo, single-blog, single-writer** (`package.json` flat, sem `workspaces`, `type: module`, Node `>=22.12.0`). **Não existe noção de tenant** em nenhuma migration ou function. O conteúdo publicado vive em **dois lugares ao mesmo tempo**, e essa dualidade é o fato mais importante para o Engine:

| Camada | Fonte da verdade | Quem escreve | Restrição real |
|---|---|---|---|
| **Edição** | D1 (`drafts`, `posts_meta`, `categories`, `menu_items`) | Pages Functions (`functions/api/**`) | ~30s (deploy)/~10s (dev), single-writer, sem `BEGIN/COMMIT` |
| **Publicação/Render** | Git (`src/content/blog/*.{md,mdx}` — **120 .md + 10 .mdx = 130 arquivos**) | GitHub Contents API via `commitFile()` | base64 ~3.5MB/arquivo, ~5 req/s + secondary rate limits |
| **Mídia** | R2 (`env.MEDIA`, `media.paulgomes.com.br`) | `functions/api/upload.ts` | 10MB/arquivo, sem processamento server-side |
| **Deploy** | push em `main` → Cloudflare Pages rebuild (~1-2 min, **concorrência 1**) | webhook GitHub | rebuild valida Zod; **build vermelho derruba o site** |

O fluxo canônico é **D1 → Git → Build → Deploy**.

### 1.2 Ordem REAL de escrita (fonte: `publish.ts`) [CORRIGIDO]

A v1.0 afirmava "D1-primeiro, Git-depois". **Isso está invertido.** O fluxo real em `functions/api/drafts/[id]/publish.ts` é **Git-PRIMEIRO**:

1. `buildMarkdown({ ...draft, published_at: now })` → `commitFile()` (commit do `.md` no Git);
2. `INSERT/UPDATE posts_meta` (`ON CONFLICT(slug) DO UPDATE`, preserva `published_at`/`is_featured`, grava `synced_at = now` e `github_sha`);
3. `DELETE draft` (tratado como warning se falhar — pode deixar duplicidade na listagem `UNION ALL`).

`posts/[slug]/sync.ts` segue o mesmo padrão (commit primeiro, D1 depois). **O Engine adota a mesma ordem Git-primeiro** (§2.5), pois o commit só ocorre após a validação Zod+enum, e isso é o que protege o Invariante #1.

### 1.3 Por que cada fato importa para a migração

1. **D1=edição / Git=build / push=deploy** → O Engine **não publica "diretamente"**: escreve via `buildMarkdown`/`commitFile`/`deleteFile`/`getFileSha`, nunca um caminho paralelo.

2. **Enum de categorias frágil (gate de build, invariante de 1ª classe)** → `categorias` é `z.array(z.enum(CATEGORIAS))` em build-time. `CATEGORIAS` (14 itens reais: `'IA','GEO','SEO','Branding','Tecnologia','Negócios','Em Alta','ASI','Cybersecurity','Podcasts','DevOps','Google Ads','Redes Sociais','PALESTRAS'`) é gerado por marcadores `<CATEGORIAS_BEGIN>/<END>` em `src/lib/categorias.ts` via `POST /api/categorias/sync`. **Qualquer categoria fora do enum quebra o build.** A taxonomia de origem é livre (o relatório real traz `Inovação`, `Marketing`, `Lifestyle`, `Life hacks` — nenhuma no enum). Logo o Engine exige **mapeamento origem→enum com consulta ao D1 como gate bloqueante**.

3. **Cloudflare CPU/tempo/subrequests** → Pages Functions ~30s (deploy)/~10s (dev), ~128MB heap, **limite de subrequests** (50/req free, 1000 paid — frequentemente o teto que estoura antes do tempo), CPU-time ≠ wall-clock (I/O não conta). GitHub Contents API: **1 PUT/arquivo (~5 req/s) + secondary rate limits**. **100k artigos + 1M imagens NÃO cabem num request.** Isso obriga a separação núcleo puro / Worker-Queue / CLI Node.

4. **R2 sem processamento** → `output: static`; `sharp`/PIL não rodam em Workers; `astro:assets`/`getImage()` só serve assets locais (`src/assets/`), **não** URLs R2. Cloudflare Images não ativado.

5. **Migração WP em Python já existe** → `migration/migrate-wordpress.py` (ElementTree + BeautifulSoup + markdownify + PIL→WebP 1920px q85, `ThreadPoolExecutor` 10 workers) é o conector WP-XML de referência. O Engine **reusa** (porta para TS ou subprocess no CLI), não joga fora.

6. **Sem RBAC, sem audit, sem rate-limit** → `functions/_middleware.ts` só checa sessão (cookie HttpOnly 7d). `users.role ('admin'|'editor'|'author')` existe no schema mas **nenhuma API verifica**. O Engine — destrutivo em massa — **exige** RBAC + auditoria antes de produção (Fase 0).

### 1.4 Ativos reusáveis confirmados (citados dos arquivos reais)

- `functions/api/_utils/github.ts`: `buildMarkdown()`, `commitFile()`, `deleteFile()`, `getFileSha()` — handshake UTF-8→base64 (TextEncoder+btoa) já feito. **Nota:** `buildMarkdown` **emite `focusKeyword`/`metaTitle`/`metaDescription` no frontmatter hoje** (ver §2.3, correção SEO).
- `functions/api/_utils/db.ts`: tipo `Env` (D1 + R2 + secrets).
- `functions/api/_utils/slugify.ts`: NFD + colapso, fonte única de slug.
- `src/lib/categorias.ts`: `CATEGORIA_SLUGS`, `CATEGORIA_COLORS`, padrão marker-based.
- `scripts/{import-posts-to-d1,migrate-images-to-r2,rewrite-mdx-to-r2,convert-youtube-links,invert-redirects,backfill-*-alt}.mjs`: parsers de frontmatter, `detectMime()` por magic numbers, regex 4-pass de URL, ALT 3-tier, padrão `wrangler d1 execute --remote --file` em chunks de ~100 INSERTs.
- `migration/migrate-wordpress.py`: motor XML→MD completo.
- `migrations/0001_initial.sql … 0013`: schema evolucionário. **Colunas reais de `posts_meta`: `synced_at` (timestamp, 0004), `github_sha`, `github_path`, `status`, `content_md`, `author_id`. NÃO existe `git_synced`.**

---

## 2. ARQUITETURA DO MIGRATION ENGINE

### 2.1 Princípio reitor — três anéis de execução

O Engine é **um conjunto de pacotes TS puros, agnósticos de ambiente**, embrulhados por **dois drivers de execução** que reusam os mesmos pacotes.

```
        ┌───────────────────────────────────────────────────┐
        │  ANEL 1 — NÚCLEO (pure TS, zero I/O de ambiente)    │
        │  connectors/ + core/{transformers,validators,types} │
        │  → funções puras + interfaces; recebe PORTS injetados│
        └───────────────────────────────────────────────────┘
                ▲                                  ▲
   ┌────────────┴───────────────┐   ┌──────────────┴───────────────────┐
   │ ANEL 2 — DRIVER WORKER       │   │ ANEL 3 — DRIVER CLI/Node          │
   │ • Pages Functions: PRODUZ    │   │ runner Node local (cargas pesadas)│
   │   mensagens (control plane)  │   │ reusa wrangler + D1 remoto + R2    │
   │ • Worker DEDICADO: CONSOME a  │   │ sem teto de CPU; sharp p/ imagens  │
   │   fila, 1 chunk/msg, checkpoint│  │ subprocess opcional do .py         │
   └──────────────────────────────┘   └────────────────────────────────────┘
              estado em D1 (jobs/checkpoints/source_map) — fonte única p/ ambos
```

- **Anel 1 (pacote TS puro):** conectores, transformers, validators, modelo canônico. Recebe/devolve estruturas de dados; **não** toca em D1/R2/GitHub — recebe *ports* injetados. Testável em isolamento.
- **Anel 2 (control plane Pages + Worker consumer):** [CORRIGIDO] o painel (**Pages Functions**) apenas **enfileira**; um **Worker dedicado separado** consome a fila, processa **um chunk** por mensagem dentro do seu envelope de CPU, grava checkpoint no D1 e re-enfileira. Usado para imports pequenos/médios e sync incremental (webhook/cron).
- **Anel 3 (CLI Node):** carga inicial massiva (100k+). Mesmos pacotes do Anel 1, sem teto de CPU; `wrangler d1 execute --remote --file` em chunks de ~100 INSERTs; `sharp` para variantes de imagem; subprocess opcional do `migrate-wordpress.py`.

**Decisão:** o mesmo `JobState` em D1 é fonte da verdade para ambos os drivers → um import pode começar no CLI e ser retomado/monitorado pelo painel, e vice-versa.

### 2.2 As interfaces de conector — `SourceConnector` vs `Exporter` (assinaturas TS) [CORRIGIDO]

A v1.0 tinha uma **fat interface** que misturava papéis de fonte e destino (viola ISP) e punha `uploadMedia(StoragePort)` no conector, **contaminando o núcleo puro** com conhecimento de storage. Separamos as responsabilidades; `transform` move para o **core** (o conector entrega `RawEntity` cru), e o conector **nunca conhece R2/storage**.

```typescript
// packages/migration-engine/core/types/connector.ts

export interface ConnectorContext {
  readonly logger: StructuredLogger;
  readonly signal: AbortSignal;          // cancelamento cooperativo (best-effort, ver §2.6)
  readonly secrets: SecretResolver;      // credenciais NUNCA em D1 estático; tokens OAuth → KV cifrado (§6.9)
}

// FONTE: só lê e entrega RawEntity cru. NÃO converte, NÃO conhece storage.
export interface SourceConnector {
  readonly id: ConnectorId;              // 'wordpress-xml' | 'ghost' | 'rss' | ...
  readonly capabilities: ConnectorCapabilities; // o que ESTA fonte suporta de fato

  connect(ctx: ConnectorContext, config: ConnectorConfig): Promise<void>;
  validate(): Promise<ValidationResult>; // credencial/arquivo/MIME/tamanho

  // Leitura — TODAS AsyncIterable p/ streaming (nunca carregar 100k em 128MB)
  fetchPosts(query?: SourceQuery): AsyncIterable<RawEntity>;
  fetchPages?(query?: SourceQuery): AsyncIterable<RawEntity>;   // OPCIONAL — ver nota
  fetchAuthors?(): AsyncIterable<RawAuthor>;
  fetchCategories?(): AsyncIterable<RawTaxonomy>;
  fetchTags?(): AsyncIterable<RawTaxonomy>;
  fetchMedia?(query?: SourceQuery): AsyncIterable<RawMedia>;

  // SÓ bytes da origem. O upload para R2 é responsabilidade do STAGE 'store' (adapter), NÃO do conector.
  downloadMedia(ref: MediaRef): Promise<MediaBlob>;

  sync?(since: SyncCursor): AsyncIterable<SyncDelta>;   // incremental
  disconnect(): Promise<void>;
}

// DESTINO/EXPORT: papel oposto, interface separada. WP-XML não implementa isto.
export interface Exporter {
  readonly id: ExporterId;
  export(canonical: CanonicalPost): Promise<ExportArtifact>;   // → MDX/HTML/JSON/CSV/RSS/WP-XML
}

// CONVERSÃO vive no CORE (não no conector): RawEntity → Canonical
//   core/transformers: detect(raw) → transform(raw) → CanonicalPost
```

Notas de design:
- **`AsyncIterable`** em todo `fetch*` (corpos de 100k não cabem em 128MB).
- **`capabilities`** + métodos opcionais [CORRIGIDO]: nem toda fonte suporta tudo. RSS não tem autores ricos; CSV não tem mídia. Opcionalidade explícita evita stubs mortos `throw 'not implemented'`.
- **`transform` saiu do conector** [CORRIGIDO]: a conversão para canônico é do core (transformers + golden files), eliminando a duplicidade "quem converte?". O conector entrega `RawEntity` no formato nativo da fonte.
- **`uploadMedia` removido do conector** [CORRIGIDO]: o conector só faz `downloadMedia` (bytes). O stage `store` (adapter) faz o `put` no R2 → o núcleo continua agnóstico.
- **`fetchPages` opcional** [CORRIGIDO]: **não há content collection `pages`** no Astro (só `blog`, glob `src/content/blog/**`). `/sobre` é `.astro` estático, não conteúdo gerenciado. **No MVP, páginas importadas não têm destino**; ou marca-se `capability` não suportada, ou cria-se (fora do MVP) nova collection + schema Zod + rota (trabalho não listado em nenhuma fase).
- **`SecretResolver`** [CORRIGIDO]: senhas/keys estáticas → Workers Secrets. **Tokens OAuth rotativos por-conector NÃO cabem em Workers Secrets** (são definidos no deploy, não criados em runtime). Esses vão para **KV/D1 cifrado** com a chave-mestra em Secret (§6.9).

### 2.3 Modelo de dados canônico intermediário

Formato neutro entre conectores (entrada) e o formato nativo Astro (saída).

```typescript
// packages/migration-engine/core/types/canonical.ts

export interface CanonicalPost {
  // Identidade & SEO
  sourceId: string;            // id na origem (idempotência/sync)
  slug: string;                // ★ slug ORIGINAL da origem; slugify() só fallback (ver nota)
  originalUrl: string | null;  // p/ redirect 301
  title: string;
  description: string;
  // Conteúdo (AST neutra — NÃO guardar HTML WP cru)
  body: CanonicalBlock[];
  bodyFormat: 'markdown' | 'mdx';
  // Datas — pubDate IMUTÁVEL após publicação; data ORIGINAL preservada (ver nota)
  publishedAt: string | null;  // ISO 8601 da ORIGEM
  updatedAt: string | null;
  // Taxonomia livre (ainda não mapeada)
  rawCategories: string[];
  mappedCategories: string[];  // subconjunto de CATEGORIAS após o gate
  rawTags: string[];
  authorRef: AuthorRef | null;
  heroMedia: MediaRef | null;
  inlineMedia: MediaRef[];
  // SEO da origem — distinguir o que ALIMENTA o gerador de schema do que NÃO TEM DESTINO (ver nota)
  seo: {
    metaTitle?: string; metaDescription?: string; focusKeyword?: string; // → frontmatter (buildMarkdown JÁ emite)
    // sem destino na plataforma atual — DESCARTADOS/ignorados explicitamente:
    canonicalUrl?: string; noindex?: boolean; twitterCard?: string; jsonLd?: unknown[]; ogImage?: string;
  };
  enrichment?: AiEnrichment;   // separado; nunca sobrescreve original sem aprovação
  contentHash: string;
  status: 'ok' | 'empty' | 'corrupt' | 'needs-review';
  warnings: Diagnostic[];
}

export type CanonicalBlock =
  | { t: 'paragraph'; children: InlineNode[] }
  | { t: 'heading'; level: 1|2|3|4|5|6; children: InlineNode[] }
  | { t: 'image'; ref: MediaRef; alt?: string; caption?: string }
  | { t: 'figure'; ref: MediaRef; caption?: InlineNode[] }      // [CORRIGIDO] 1ª classe
  | { t: 'table'; head: CanonicalBlock[][]; rows: CanonicalBlock[][][] } // [CORRIGIDO] GFM
  | { t: 'thematicBreak' }                                       // [CORRIGIDO] hr
  | { t: 'embed'; provider: 'youtube'|'twitter'|'generic'; url: string } // → componente MDX
  | { t: 'code'; lang?: string; value: string }
  | { t: 'list'; ordered: boolean; items: CanonicalBlock[][] }
  | { t: 'quote'; children: CanonicalBlock[] }
  | { t: 'html'; raw: string };   // escape hatch sanitizado — último recurso
```

**Notas de correção:**
- **Slug = slug ORIGINAL da origem** [CORRIGIDO]: em `src/pages/[...slug].astro` a URL é `post.id` (nome do arquivo do glob). Derivar slug de `slugify(title)` **divergiria** do slug WP preservado e mudaria a URL canônica, exigindo um 301 indevido. Regra: **slug de destino = slug original da origem**; `slugify()` só quando a origem não tem slug. O nome do arquivo `.md` **é** o slug canônico.
- **Data original preservada** [CORRIGIDO]: `publish.ts` chama `buildMarkdown` com `published_at: now` (hardcoded). Para migração, o passo 14 **injeta `CanonicalPost.publishedAt` explicitamente** — nunca `now`. Além disso, `buildMarkdown` faz `toISOString().slice(0,10)` em **UTC**: uma data `2023-08-14T23:00-03:00` viraria `2023-08-15`. O Engine **normaliza a data-calendário local pretendida antes do slice** para evitar drift de 1 dia.
- **AST neutra com `table`/`figure`/`thematicBreak`** [CORRIGIDO]: blog WP real contém tabelas/hr/figuras; sem blocos de 1ª classe cairiam em `{t:'html'}`, exatamente o que a AST quer evitar. Embeds viram `{t:'embed'}` → `<YouTube/>` no MDX.
- **SEO: distinguir o que tem destino do que não tem** [CORRIGIDO]: a plataforma **gera** JSON-LD/canonical/breadcrumb deterministicamente em `BlogPost.astro`/`schema.ts` a partir do frontmatter (`title`, `description`, `pubDate`, `updatedDate`, `heroImage`, `categorias`). Logo:
  - `jsonLd`, `canonicalUrl`, `noindex`, `twitterCard`, `ogImage` da origem **são DESCARTADOS** (preservá-los criaria schema duplicado/conflitante; não há campo de override no render).
  - `metaTitle`/`metaDescription`/`focusKeyword`: `buildMarkdown` **já os escreve no frontmatter**, mas o Zod não os declara e `BaseHead.astro` **não os lê** (o `<title>` vem de `title`/`description`). **Hoje são inertes para SEO.** Decisão do dono (§6): ou estender `BaseHead` para que `metaTitle`/`metaDescription` controlem o `<head>`, ou declará-los puramente informativos.

### 2.4 Estrutura de pastas `packages/migration-engine`

```
packages/migration-engine/
├─ package.json                 # TS puro; "type":"module"; SEM deps de runtime CF; sem conflito de versão zod/astro com o app
├─ tsconfig.json                # estende astro/strict + strictNullChecks
├─ src/
│  ├─ connectors/               # PUROS — só SourceConnector (read+downloadMedia)
│  │  ├─ _base/                 # capabilities default + helpers
│  │  ├─ wordpress/             # ★ MVP — XML (porta do .py) + REST (depois)
│  │  ├─ ghost/ rss/ atom/ json/ csv/ markdown/ mdx/ html/ github/ notion/ ...
│  │  └─ index.ts               # registry: ConnectorId → factory
│  ├─ core/
│  │  ├─ types/                 # connector.ts, canonical.ts, jobs.ts, ports.ts, reports.ts
│  │  ├─ jobs/                  # Pipeline, Stage, JobState, Checkpoint, Retry, QueuePort
│  │  ├─ transformers/          # detect + RawEntity→CanonicalBlock[] (gutenberg/elementor/divi/wpbakery/shortcodes/html/md)
│  │  │  └─ canonical-to-{markdown,mdx,html,json,csv,rss,wpxml}/   # renderers/exporters
│  │  ├─ validators/            # schema(Zod), security(sanitize/MIME), seo, dedup, integrity
│  │  ├─ storage/               # StoragePort(R2), ImagesPort(CF Images), variants, hash-sync
│  │  ├─ ai/                    # EnrichmentProvider port + prompts (provider-agnostic)
│  │  ├─ reports/               # agregador por chunk + render do relatório
│  │  └─ utils/                 # slugify(reexport), frontmatter, logger, mime, backoff
│  └─ index.ts
├─ adapters/                    # ÚNICA camada que conhece o AMBIENTE
│  ├─ cloudflare/               # StoragePort→R2, CommitPort→GitHub, QueuePort→CF Queues
│  └─ node/                     # StoragePort→fs/wrangler, sharp, subprocess→migrate-wordpress.py
└─ test/                        # fixtures por conector + golden files
```

`connectors/` e `core/` são **puros**. `adapters/` é a única parte que conhece R2/GitHub/Queue/fs.

### 2.5 Pipeline de import — os 14 estágios desacoplados

Cada passo é um `Stage` puro idempotente; o orquestrador faz checkpoint após cada estágio e é **retomável de qualquer ponto**.

| # | Estágio | Onde roda | Nota |
|---|---|---|---|
| 1 | **connect** | Worker/CLI | `connect()` + resolve secrets |
| 2 | **validate** | Worker/CLI | arquivo/MIME/tamanho/credencial |
| 3 | **read** | streaming | `fetchPosts` `AsyncIterable`, em chunks |
| 4 | **map authors** | núcleo + D1 | ver decisão de schema abaixo |
| 5 | **map categories** | **núcleo + D1 (gate)** | livre→enum; consulta `categories`; não mapeada ⇒ `needs-review`, **nunca inventa enum** |
| 6 | **map tags** | núcleo | tags livres → JSON (sem FK, como hoje) |
| 7 | **download images** | CLI (massivo)/Worker (mínimo) | sub-job retomável próprio (ver §2.6); backoff por host; URL morta = warning |
| 8 | **transform image** | adapter | CLI `sharp` OU CF Images; **nunca em Worker puro** |
| 9 | **store R2** | adapter | `HEAD` idempotente (padrão `migrate-images-to-r2.mjs`) |
| 10 | **convert** | núcleo | transformers → `CanonicalBlock[]` → MD/MDX |
| 11 | **preview** | painel | diff antes de aplicar; **sem commit** |
| 12 | **validate (final)** | núcleo | **Zod + pré-flight categoria↔enum (lido de `main`)** + body |
| 13 | **report** | reports/ | agrega métricas parciais por chunk |
| 14 | **import** | adapter | **Git-PRIMEIRO**, depois D1 (ver regra de ouro) |

**Regra de ouro do passo 14 — Git-primeiro, alinhado ao código real [CORRIGIDO]:**
1. **Pré-condição absoluta:** `mappedCategories ⊆ CATEGORIAS` **já presente em `main`** (re-lido via `getFileSha`/conteúdo do branch alvo). Se o enum precisa de categoria nova, ela entra **no MESMO commit** dos posts (§3.3) — nunca em dois pushes sequenciais.
2. `commitFile()` / GraphQL `createCommitOnBranch` do(s) `.md` (+ `categorias.ts` + `_redirects` no mesmo commit) — espelha `publish.ts`.
3. `INSERT/UPDATE posts_meta` com `github_sha` + `synced_at = now` + a data **original** preservada.
4. Estado de compensação (abaixo).

**Estado de compensação — coluna NOVA, não "já suportado" [CORRIGIDO]:** a v1.0 inventou `git_synced=false` ("estado já suportado"). **Essa coluna não existe.** Existe `synced_at` (timestamp) e `github_sha`. Adiciona-se **migration 0014**:
```sql
ALTER TABLE posts_meta ADD COLUMN git_sync_status TEXT DEFAULT 'committed'; -- 'pending'|'committed'|'failed'
ALTER TABLE posts_meta ADD COLUMN sync_retry_count INTEGER DEFAULT 0;
```
Máquina de estados: grava `posts_meta` com `git_sync_status='pending'` **antes** de tentar o commit (write-ahead); após commit OK → `'committed'` + `synced_at`; se commit falha → `'failed'` + re-enfileira. Um **job de reconciliação** varre `git_sync_status IN ('pending','failed')` e recommita idempotentemente via `getFileSha`. Como Git é Git-primeiro, na prática o commit precede o `posts_meta` definitivo; o estado `pending` cobre a janela entre escrever o write-ahead e confirmar o commit.

### 2.6 Jobs / fila / checkpoint / retry

```typescript
export interface MigrationJob {
  id: string; connectorId: ConnectorId;            // [CORRIGIDO] sem tenantId — plataforma single-blog
  mode: 'import' | 'sync' | 'export';
  status: 'pending'|'running'|'paused'|'failed'|'completed';
  totals: { posts: number; media: number; done: number; errors: number };
  cursor: SyncCursor | null;
  createdBy: string; createdAt: number; updatedAt: number;
}
export interface Checkpoint { jobId: string; stage: StageName; chunkIndex: number; lastSourceId: string; state: unknown; createdAt: number; }
export interface QueuePort { enqueue(msg: ChunkMessage): Promise<void>; ack(id: string): Promise<void>; retry(id: string, delayMs: number): Promise<void>; }
```

- **Escopo single-blog [CORRIGIDO]:** `tenantId` removido de **todas** as interfaces e tabelas. Não há multi-tenancy no repo; mantê-lo adicionaria chaves compostas e índices sem requisito. Se multi-tenant entrar no roadmap, vira decisão explícita do dono (§6).
- **ChunkMessage leve (≤128KB) [CORRIGIDO]:** a mensagem da fila carrega **apenas ponteiros** (`jobId`, `chunkIndex`, `lastSourceId`, range de `sourceId`). O estado real (RawEntity/AST) vive em D1/R2 — Cloudflare Queues limita a mensagem a ~128KB.
- **Dimensionar chunk por SUBREQUESTS, não por nº de posts [CORRIGIDO]:** cada download de imagem + HEAD R2 + PUT R2 + chamada GitHub é uma subrequest (teto 50 free/1000 paid). O estágio "download/store mídia" é separado do estágio "converter/commitar texto"; o tamanho do chunk é calculado pelo **orçamento de subrequests** e por **CPU-time** (não wall-clock).
- **Checkpoint write-ahead [CORRIGIDO]:** Workers/Pages são **mortos sem aviso** ao exceder CPU/tempo — não se pode confiar que o `AbortSignal` dispare a tempo de gravar checkpoint. Cada item marca `source_map` (`status`) **antes** do efeito colateral seguinte; a retomada reprocessa no máximo 1 item parcial, tornado idempotente por `HEAD`/`contentHash`. O `AbortSignal` é best-effort, não a garantia.
- **Retry** com backoff exponencial + jitter para 429/503, **respeitando `Retry-After`** e a detecção de abuse/secondary-rate-limit do GitHub.
- **CLI** usa `QueuePort` in-process; chunking de SQL em ~100 INSERTs (`import-posts-to-d1.mjs`) para não estourar os 10MB do `wrangler d1 execute`.

### 2.7 Transformers (Gutenberg / Elementor / Divi / Shortcodes / HTML → MDX)

```
markup da origem → detector (wp:comments | elementor json | divi/wpbakery shortcodes)
   → transformer específico → CanonicalBlock[] (descarta layout proprietário)
   → sanitizer (validators/security)
   → renderer canonical-to-{markdown|mdx}
```

- **Gutenberg:** parseia `<!-- wp:* -->`; blocos → `CanonicalBlock` (incl. `table`/`figure`).
- **Elementor/Divi/WPBakery:** extraem texto/mídia, **descartam layout** → AST neutra.
- **Shortcodes:** registry `shortcode → handler`; `[youtube]`→`{t:'embed'}` (reusa `convert-youtube-links.mjs`).
- **HTML legado → MDX:** porta o markdownify do `.py`; imagens viram `{t:'image'}` para reescrita de URL (4-pass de `rewrite-mdx-to-r2.mjs`).
- **MDX só com allowlist de componentes [CORRIGIDO]:** `.mdx` quebra o build se emitir `<YouTube/>` sem o import correto ou apontar para componente inexistente. O renderer `canonical-to-mdx` (a) usa **apenas** componentes de um allowlist verificado contra `src/components`, (b) injeta os imports exatos, (c) tem **teste de build por fixture de embed**. **Prefere `.md` puro** sempre que possível — menor superfície de quebra.

### 2.8 Validators e segurança — gate como invariante de CÓDIGO [CORRIGIDO]

```typescript
export interface Validator<T> { validate(input: T, ctx: ValidationContext): Diagnostic[]; }
```
- **schema:** valida `CanonicalPost` contra o Zod de `src/content.config.ts` **antes** de commitar.
- **security:** sanitiza HTML, detecta `<script>`/handlers, bloqueia malicioso, valida **MIME por magic numbers** (`detectMime()`) e tamanho (R2 10MB, GitHub 3.5MB base64).
- **seo:** slug único = slug original; redirect 301 só quando slug muda; `heroImage` URL absoluta (Schema.org).
- **dedup/integrity:** por `contentHash`; conteúdo vazio/corrompido, encoding, links quebrados (HEAD).

**Gate categoria↔enum centralizado [CORRIGIDO]:** `posts/[slug]/sync.ts` commita direto em `main` **sem validar o enum**. Se o Engine (ou o painel) reusa esse caminho com categoria fora de `CATEGORIAS`, o build quebra **fora do controle do pipeline**. Por isso a validação é embutida em um **wrapper obrigatório `commitPost()`** (ou no próprio `buildMarkdown`) que **TODO** caminho de commit (publish, sync, import) atravessa — nenhum `.md` com categoria fora do enum pode ser gravado por qualquer rota. Acrescenta-se um **teste de CI** que falha rápido se algum `.md` referenciar categoria inexistente.

### 2.9 Storage (R2 / Cloudflare Images) e sync por hash

```typescript
export interface StoragePort { head(key: string): Promise<MediaLocation | null>; put(key: string, blob: MediaBlob): Promise<MediaLocation>; url(key: string): string; }
export interface ImagesPort { ingest(blob: MediaBlob): Promise<{ id: string; variants: VariantSet }>; variantUrl(id: string, v: string): string; }
```
- **Chave R2:** `posts/legacy/<file>` (legado) e `YYYY/MM/<uuid>.<ext>` (novos).
- **Variantes [CORRIGIDO]:** `sharp` **só no CLI** (Anel 3) OU **Cloudflare Images** (ativado, com custo). **Nunca em Worker puro.** Sem CF Images → R2-raw + WebP/AVIF gerados uma vez no CLI.
- **Sync por hash:** `contentHash`(corpo) + `media.hash`(bytes) vs. `source_map` no D1; importa só diffs.

### 2.10 Camada de IA (opcional)

```typescript
export interface EnrichmentProvider { readonly id: string; suggest(post: CanonicalPost, kinds: EnrichmentKind[]): Promise<AiEnrichment>; }
export type EnrichmentKind = 'metaTitle'|'metaDescription'|'faq'|'jsonLd'|'tldr'|'keyPoints'|'headings'|'internalLinks'|'entities'|'altText'|'captions'|'summary'|'readability'|'seoGeoAeo';
```
- **Nunca altera o original sem aprovação:** produz `AiEnrichment` separado, persistido em D1, aplicado **só após aprovação humana** (`POST /api/imports/:id/approve`). ALT por IA respeita o limite de 200 chars.
- Provedor agnóstico até decisão do dono (§6). Se Anthropic/Claude, validar model id/preço na doc oficial antes de fixar.

### 2.11 Sistema de relatório

`core/reports/` agrega métricas **por chunk** (não em memória total), espelhando o `migration-report.md` real: totais (artigos/páginas/imagens), tempo, erros, avisos, redirects, SEO preservado, enriquecido por IA, ignorado, duplicado. Persistido em `import_reports` (D1), exportável.

---

## 3. INTEGRAÇÃO COM A CORE PLATFORM

### 3.1 Introduzir `packages/` sem quebrar o app atual

```jsonc
// package.json (raiz) — adição cirúrgica
{ "workspaces": ["packages/*"] }
```
- **Risco de hoisting [CORRIGIDO]:** habilitar `workspaces` altera o hoisting de `node_modules` e **pode** mudar versões resolvidas que o Cloudflare Pages instala no build. A afirmação "build permanece verde mesmo se o pacote estiver incompleto" só vale se (a) o app **não importa** o pacote e (b) o hoisting não muda nada. **Ação obrigatória:** validar `astro build` **no ambiente do Cloudflare Pages** (não só local) após habilitar; garantir que `packages/migration-engine` não introduza conflito de `zod`/`astro`.
- **Alternativa de menor compromisso (§6):** adiar workspaces; começar o pacote como pasta TS compilada por script, migrando para workspace na Fase 2.

### 3.2 Plugar no D1, no pipeline D1→Git e no R2

- **D1:** mesmas migrations (`0014+`). Adapters reusam `env.DB` e o tipo `Env`.
- **D1→Git:** passo 14 chama `buildMarkdown()` + `commitFile()`. Para lotes, **GraphQL `createCommitOnBranch`** (múltiplos arquivos/commit). **Limites reais [CORRIGIDO]:** `createCommitOnBranch` envia a árvore de adições em base64 no body → **100k arquivos NÃO cabem em 1 commit**; pagina-se em centenas de commits. **Secondary rate limit** do GitHub estrangula bulk (403/429 sem `Retry-After` consistente) → backoff respeitando abuse detection. **Sharding de diretórios** obrigatório (ex.: `src/content/blog/<ano>/`) — diretórios >1k-10k arquivos degradam a API e `astro build` (o **glob loader não foi pensado para 100k entradas** — provável gargalo final; validar tempo de build em escala). Repos GitHub: soft-limit ~1GB, hard ~5GB.
- **R2:** `StoragePort`→`env.MEDIA.put` com `HEAD` idempotente e `PUBLIC_R2_DOMAIN` para URLs absolutas.

### 3.3 Contrato com o formato nativo (sem violar build verde)

- **Frontmatter [CORRIGIDO]:** o renderer `canonical-to-markdown` **espelha `buildMarkdown` exatamente** — e `buildMarkdown` **emite** `focusKeyword`/`metaTitle`/`metaDescription` no frontmatter (tolerados pelo Astro como campos extra, ignorados pelo Zod e pelo render). Não há contradição com "reusar buildMarkdown": esses campos **vão para o `.md`** mas são inertes para SEO até `BaseHead` ser estendido (decisão §6).
- **Enum como gate — UM commit, com lock [CORRIGIDO]:** a race read-modify-write de `categorias/sync.ts` (que faz seu **próprio** commit isolado e regenera a seção inteira lendo TODAS as categorias do D1) é eliminada assim: o pré-flight de taxonomia é feito **UMA vez no início do job** (mapeamento completo antes de qualquer commit de post); categorias novas aprovadas entram em `src/lib/categorias.ts` **no MESMO `createCommitOnBranch`** dos `.md` (nunca dois pushes sequenciais → sem rebuild-storm de enum, sem janela de build vermelho). Regeneração serializada com lock/retry-on-409 no SHA de `categorias.ts`. Categoria no D1 ainda não aprovada **não** entra no enum.
- **Redirects 301 — formato REAL [CORRIGIDO]:** a regra da v1.0 `/(blog/)?OLD /NEW 301` é **inválida** — `_redirects` do Cloudflare **não suporta regex/grupos opcionais**. O `public/_redirects` real usa **duas linhas literais por slug**, fonte **sem** barra final, destino **com** barra final (config `trailingSlash:'ignore'` + `build.format:'directory'`):
  ```
  /blog/OLD-SLUG /NEW-SLUG/ 301
  /OLD-SLUG /NEW-SLUG/ 301
  ```
  Geradas **no mesmo commit** do post, validadas anti-loop/duplicata contra as 241 regras existentes (lógica de `invert-redirects.mjs` — que faz regex **no script**, não no arquivo). Histórico em `redirects`/`source_map` no D1.
  **Limite de volume [CORRIGIDO]:** `_redirects` do Pages tem teto (~2000 estáticas + 100 placeholder); excedente é **ignorado silenciosamente**. Para imports de 100k com mudança de slug, servir 301 **dinamicamente** via Pages Function consultando a tabela `redirects` (D1), reservando `_redirects` para baixo volume crítico.
- **SEO invariantes:** domínio `https://paulgomes.com.br` e `@id` de JSON-LD imutáveis; o Engine **lê** a config (`src/config/site.ts`; bindings expõem `SITE_URL`/`PUBLIC_R2_DOMAIN`) mas nunca a altera. **JSON-LD da origem é descartado e regenerado pela plataforma** (§2.3).

---

## 4. IMPACTOS NO PAINEL ADMINISTRATIVO

### 4.1 Novas rotas `/painel`
`/painel/conectores`, `/painel/conectores/:type/auth` (token OAuth → KV cifrado, **não** Secret estático nem D1 plaintext), `/painel/importacoes/nova` (wizard: conector → upload/URL → **mapear categorias→enum (gate, com UI)** → mapear autores → IA on/off), `/painel/importacoes/:id` (progresso por **polling** — ver §4.5), `/painel/importacoes/:id/{relatorio,preview,enriquecimento}`.

### 4.2 Novos endpoints `/api`
| Endpoint | Função |
|---|---|
| `POST /api/imports` | cria job (valida schema/MIME); **só enfileira**, responde `import_id` |
| `GET /api/imports/:id` | progresso `{processed, total, errors[], warnings[]}` |
| `POST /api/imports/:id/preview` | diff sem commit |
| `POST /api/imports/:id/approve` | aplica (passo 14) após QA |
| `POST /api/imports/:id/{enrich,resume,cancel}` · `PUT /api/posts/:slug/enrich` | IA / controle de fila |
| `GET /api/exports?status&format` · `GET /api/connectors` · `POST /api/connectors/:type/auth` | export / conectores |

Cargas pesadas **nunca** rodam síncronas no request: o endpoint enfileira (CF Queue → Worker consumer) ou delega ao CLI.

### 4.3 Novas tabelas D1 (migrations `0014+`) [CORRIGIDO — sem tenant_id]
- `import_jobs` (id, connector_id, mode, status, totals JSON, cursor, created_by, timestamps)
- `import_checkpoints` (job_id, stage, chunk_index, last_source_id, state JSON, created_at)
- `source_map` (connector_id, source_id, dest_slug, content_hash, media_hash, **media_status** `downloaded|stored|failed`) — idempotência/sync/dedup + checkpoint por imagem
- `redirects` (old_url, new_url, status 301, job_id, created_at) — **servidos dinamicamente em volume alto**
- `audit_logs` (user_id, action, entity, before JSON, after JSON, timestamp) — **com política de retenção/anonimização (LGPD, §6)**
- `import_reports` (job_id, metrics JSON, generated_at)
- `ai_enrichments` (slug, kind, suggestion JSON, status `pending|approved|rejected`, approved_by)
- **alteração de `posts_meta`:** `git_sync_status`, `sync_retry_count` (§2.5)

**Limites D1 em escala [CORRIGIDO]:** máx. ~10GB/banco, single-writer (escritas serializam), batch de statements limitado. `source_map` com 100k posts + 1M imagens = >1,1M linhas + índices → **estimar que cabe nos 10GB** e medir throughput de INSERT (gravar 1,1M linhas pode rivalizar com o tempo das imagens). **Decisão:** `posts_meta` no bulk **referencia o Git, não duplica `content_md`** (100k × conteúdo somaria GBs). INSERTs em batches de ~100 (padrão existente).

### 4.4 RBAC, middleware, segurança/rate-limit (pré-requisito de produção)
- **RBAC (Fase 0):** `requireRole('admin'|'editor')` em `require-auth.ts`, **sem regressão** nas APIs existentes que só chamam `requireAuth` (wrapper aditivo). **Matriz completa [CORRIGIDO]** cobrindo as operações NOVAS, não só "iniciar import":

  | Operação | admin | editor | author |
  |---|---|---|---|
  | iniciar import / resume / cancel | ✓ | ✓ | ✗ |
  | aprovar enriquecimento IA | ✓ | ✓ | ✗ |
  | `categorias/sync` (muda enum global, dispara rebuild) | ✓ | ✗ | ✗ |
  | `connectors/auth` | ✓ | ✗ | ✗ |
  | ver próprios drafts | ✓ | ✓ | ✓ |

  **Nota de ownership:** conteúdo publicado vive no Git (sem dono); import/sync escrevem globalmente → "author vê só os próprios" aplica-se a `drafts`/`posts_meta.author_id`, **não** ao conteúdo Git.
- **Rate-limit [CORRIGIDO]:** KV (contador IP/usuário, 429) mitiga abuso externo — **mas o vetor dominante é a avalanche de rebuilds**, não IP. A arquitetura **impõe batching de commits como invariante** (1 commit por chunk via `createCommitOnBranch`, com debounce; o import **NUNCA** faz 1 commit por post) e define teto de commits/min. Se um rebuild intermediário falhar num import multi-commit, o **site fica vermelho até o próximo commit verde** → cada commit deve ser auto-suficiente (enum+posts+redirects juntos).
- **Auditoria:** insert em `audit_logs` antes de cada mutation.

### 4.5 Progresso de jobs [CORRIGIDO]
**Polling (`GET /api/imports/:id`) é o padrão**, com intervalo dimensionado para não sobrecarregar o D1 single-reader. WebSocket exige **Durable Objects** (estado de conexão) — não é "opcional casual", é item explícito de infra (§0), adotado só se necessário.

---

## 5. PLANO INCREMENTAL DE IMPLEMENTAÇÃO

### Fase 0 — Fundação (segurança + pré-provisionamento, bloqueante)
- **Objetivo:** RBAC + audit + rate-limit + infra mínima antes de qualquer escrita em massa.
- **Entregáveis:** `requireRole()` (matriz §4.4); migration `audit_logs` + `0014` (`git_sync_status`); **provisionar KV** (rate-limit); allowlist revisada; **wrapper `commitPost()` com gate de enum** (cobre publish/sync/import); teste de CI "nenhum `.md` com categoria fora do enum".
- **Pronto quando:** APIs existentes seguem checando role sem regressão; build verde.
- **Decisão humana:** confirmar matriz de papéis.

### Fase 1 — MVP (scaffolding + WordPress-XML + export Markdown + relatório)
- **Objetivo:** importar um export WP XML ponta-a-ponta reusando o `.py`, com fidelidade 1:1.
- **Entregáveis:** workspace (validado no Pages, §3.1); `SourceConnector` + `CanonicalPost`; conector `wordpress/xml`; transformers HTML→canonical + Gutenberg/shortcodes mínimos (incl. `table`/`figure`/`hr`); `canonical-to-markdown` **espelhando `buildMarkdown` byte-a-byte** (com data original + normalização UTC); pipeline 14 passos (**mídia ainda como URL externa**); **gate categoria↔enum no mesmo commit**; redirects 301 **no formato real (2 linhas, destino com barra)**; relatório; `POST /api/imports` + `/api/imports/:id` + `/painel/importacoes`; runner **CLI** (Anel 3).
- **Riscos:** mapeamento categoria livre→enum; handshake UTF-8/base64; ordem Git-primeiro + reconciliação; **autores (decisão de schema, abaixo)**.
- **Pronto quando:** reimportar a fonte de referência reproduz os **130 arquivos (.md + .mdx)** atuais byte-a-byte (golden test) com build verde e relatório coerente.
- **Decisão/credencial humana:** `GITHUB_TOKEN`; mapa de categorias; workspace agora vs. depois; **schema de autores**.

### Fase 2 — Mídia (R2 + variantes)
- **Objetivo:** baixar, dedup por hash, subir a R2, variantes WebP/AVIF.
- **Entregáveis:** `StoragePort`/`ImagesPort`; reescrita 4-pass de URLs; `HEAD` idempotente; **download como sub-job retomável (checkpoint por imagem em `source_map`, backoff por host, URL morta = warning)**; variantes via `sharp` no CLI **ou** CF Images; ALT 3-tier.
- **Riscos:** custo/ativação CF Images; `sharp` indisponível em Worker; **janela de download de 1M imagens (dezenas de horas, rate-limit da origem, hotlink protection)**.
- **Pronto quando:** import traz imagens externas → R2 com URLs absolutas, sem duplicar, retomável.
- **Decisão humana:** ativar Cloudflare Images (custo — ver §6).

### Fase 3 — Sync incremental
- **Entregáveis:** `connector.sync()` + `source_map` + `contentHash`; cursores; **reconciliação Git→D1 definida** (ver §6); webhook/cron.
- **Pronto quando:** 2ª rodada não duplica nada e toca só o alterado.
- **Decisão humana:** não (config interna).

### Fase 4 — IA (enriquecimento aprovável)
- **Entregáveis:** `EnrichmentProvider`; `ai_enrichments`; UI de aprovação; `enrich`/`approve`.
- **Pronto quando:** sugestões persistem pendentes e só vão a Git após aprovação.
- **Decisão humana:** escolher provedor/modelo/custo (se Anthropic/Claude, validar na doc oficial).

### Fase 5 — Mais conectores + export
- **Entregáveis:** Ghost, RSS/Atom, JSON, CSV, MD/MDX, GitHub, Notion; export MDX/HTML/JSON/CSV/RSS/WP-XML/ZIP.
- **Pronto quando:** novo conector minimiza o toque no resto (ver superfície real, §6).
- **Decisão humana:** por conector — credenciais/OAuth.

### Fase 6 — Escala 100k+ e automação
- **Objetivo:** carga massiva retomável + webhooks/cron.
- **Entregáveis:** **Worker consumer dedicado** + `[[queues.consumers]]`; chunking de commits via `createCommitOnBranch` **paginado** (não cabe 100k em 1 commit); **sharding de diretórios** (`blog/<ano>/`); **redirects dinâmicos via D1** (estouro do `_redirects`); **desabilitar auto-deploy durante o bulk + 1 rebuild final**; backoff respeitando secondary rate limit; logs estruturados; Cron Triggers.
- **Riscos:** rebuild storms; secondary rate limit; **tempo de `astro build` com 100k entradas (gargalo final provável)**; budget de builds/mês.
- **Pronto quando:** import de >10k retomável após falha sem reprocessar nem estourar memória; build em escala validado.
- **Decisão humana:** bulk em CLI vs. Worker; janela de rebuilds; ativar Images p/ 1M.

---

## 6. RISCOS E DECISÕES EM ABERTO (donos)

1. **Workspace agora vs. depois.** Recomendo npm workspaces mínimo na Fase 1, **mas só após validar `astro build` no ambiente Cloudflare Pages** (hoisting pode mudar versões resolvidas). Alternativa: pasta TS compilada até a Fase 2.
2. **Cloudflare Images vs. R2+sharp (conta concreta, não só "custo").** Para **1M imagens**: (A) **CF Images** = storage recorrente por imagem + custo de delivery/transform (ordem de grandeza significativa, recorrente); (B) **R2 + `sharp` no CLI** gerando WebP/AVIF **uma vez** = storage R2 (muito menor) + zero transform recorrente, **sem** responsive on-the-fly. Recomendo (B) salvo necessidade de variantes dinâmicas. Definir antes da Fase 2.
3. **Bulk em CLI vs. Worker.** CLI Node (sem teto de CPU, `sharp`, `wrangler`) é o caminho comprovado para 100k+; Worker/Queue para imports do painel e sync. Ambos sobre o mesmo `JobState`. Dono decide o default da carga inicial.
4. **Política de categorias.** Mecanismo (mapa + gate + sync no mesmo commit) está desenhado; **a política não:** criar automaticamente, forçar mapeamento manual, ou fallback? **Caso não tratado:** **renomear/remover** categoria — `categorias/sync.ts` regenera lendo o D1; remover do D1 a tira do enum e **quebra o Zod de todos os posts que ainda a referenciam** → exige migrar `posts_meta.categorias` + recommit dos `.md` afetados **antes** de remover. `CATEGORIA_COLORS` de categorias novas são **auto-atribuídas ciclicamente** (não curadas).
5. **Provedor de IA.** Indefinido; `EnrichmentProvider` agnóstico até decidir.
6. **Atomicidade D1↔Git + reconciliação bidirecional.** Sem 2PC. Adotar compensação via `git_sync_status` (migration 0014) + job de reconciliação. **Decisão extra [CORRIGIDO]:** o Git é editável **fora** do painel (e o `.py` escreve `.md` direto sem tocar D1) → **dois fontes de verdade podem divergir silenciosamente**. Definir **"D1 autoritativo, Git derivado"** (ou o inverso) e o que o Engine faz ao encontrar `.md` no Git **sem** linha em `posts_meta` (o caso dos posts legados importados pelo `.py`). A v1.0 só definia D1→Git.
7. **Campos SEO extras (`metaTitle`/`metaDescription`/`focusKeyword`).** `buildMarkdown` **já os emite no frontmatter**, mas o render **não os usa** → hoje **inertes**. Decisão: estender `BaseHead` para que controlem o `<head>`, **ou** declará-los puramente informativos. (Armazená-los em `posts_meta` também os deixa inertes.)
8. **LGPD / true delete.** Soft-delete não purga **Git nem `audit_logs`** (before/after JSON). Para conteúdo com dados pessoais em massa, definir `purge_history` (git filter-repo) e retenção/anonimização de `audit_logs` **antes** do bulk — reescrever histórico de 100k commits depois é proibitivo.
9. **Secrets de conectores.** Senhas estáticas → Workers Secrets. **Tokens OAuth rotativos NÃO cabem em Secrets** (definidos no deploy, não em runtime) → **KV/D1 cifrado** com chave-mestra em Secret. O design "nunca em D1" vale para senhas, não para tokens dinâmicos.
10. **Autores importados (impacto de schema não resolvido).** `users.password_hash` é `NOT NULL` e o fluxo de novo usuário é por convite (token). "Placeholder de autor" colide com isso e com unicidade de email. Decidir: (a) `users` com `password_hash` sentinela + `role='author'` (implica login/segurança), ou (b) **nova tabela `authors`** desacoplada de `users` (exige decidir a FK `posts_meta.author_id`).
11. **Multi-tenancy.** **Removido do design** (plataforma single-blog). Se entrar no roadmap, reintroduzir `tenant_id` é decisão explícita com custo de índices/chaves compostas.
12. **Superfície real de "novo conector" (expectativa de custo).** Não é "custo zero". Cada conector novo **sempre** toca: (1) `connectors/index.ts` (registry); (2) provável transformer em `core/transformers`; (3) `capabilities` que o wizard `/painel` renderiza; (4) rota OAuth/secret + allowlist se aplicável; (5) fixtures + golden files. A arquitetura **minimiza** o acoplamento (núcleo intacto), mas esses 5 pontos são tocados.

---

## TL;DR — Quadro-resumo

**O que o Engine é:** um conjunto de **pacotes TypeScript puros** (conectores que só leem + transformers que convertem para um **modelo canônico neutro** `CanonicalPost`/`CanonicalBlock[]` AST), executado por **dois drivers** que compartilham o mesmo estado em D1: um **CLI Node** (carga massiva, sem teto de CPU, `sharp`) e um **Worker dedicado consumindo Cloudflare Queue** (imports do painel + sync). Respeita o pipeline existente **D1→Git→Build→Deploy**, reusa os helpers reais (`buildMarkdown`/`commitFile`/`getFileSha`/`slugify`/`detectMime`/`migrate-wordpress.py`) e trata o **enum de categorias** e o **build verde** como invariantes de 1ª classe.

**Primeira fatia (MVP recomendado) — Fase 0 + Fase 1:**
1. **Fase 0:** RBAC (`requireRole`), `audit_logs`, rate-limit KV, e — o item técnico central — um **wrapper `commitPost()` que embute o gate categoria↔enum em TODOS os caminhos de commit** (publish/sync/import) + teste de CI.
2. **Fase 1:** workspace `packages/migration-engine`; conector **WordPress-XML** (porta/subprocess do `.py`); `canonical-to-markdown` que **reproduz os 130 arquivos `.md/.mdx` atuais byte-a-byte** (com data **original** preservada, sem drift UTC); commit **Git-primeiro** (ordem real) com enum+posts+redirects **no mesmo commit**; redirects no **formato real** (duas linhas, destino com barra); runner **CLI**; relatório. **Mídia ainda como URL externa** (R2 entra na Fase 2).

**3-5 decisões do dono ANTES de codar:**
1. **Política de categorias livres→enum:** auto-criar (aprovado) vs. forçar mapeamento manual vs. fallback — e o procedimento de renomear/remover sem quebrar o Zod.
2. **Direção de reconciliação D1↔Git:** declarar "D1 autoritativo, Git derivado" (ou inverso) e o tratamento dos `.md` legados sem linha em `posts_meta`.
3. **Campos SEO extras (`metaTitle`/`metaDescription`):** estender o render (`BaseHead`) para usá-los, ou declará-los informativos (hoje são inertes).
4. **Schema de autores importados:** sentinela em `users` (NOT NULL `password_hash`) vs. nova tabela `authors` (e a FK `posts_meta.author_id`).
5. **Workspace agora vs. depois** — condicionado a validar `astro build` no ambiente Cloudflare Pages (risco de hoisting).

*(Decisões 2/3-da-Fase-2-em-diante — Cloudflare Images vs. R2+sharp para 1M imagens, provedor de IA, janela de rebuilds em escala — não bloqueiam o início da codificação do MVP.)*

---

## 7. Decisões do dono — RESOLVIDAS (defaults recomendados · 2026-06-28)

As 5 questões em aberto da Seção 6 ficam resolvidas com os defaults abaixo (ajustáveis a qualquer momento). São o ponto de partida da Fase 0 + MVP.

1. **Política de categorias livres → enum.** Mapeamento **manual no wizard** (cada categoria da origem → uma de `CATEGORIAS`, ou "ignorar"). Criar categoria nova do enum **só com aprovação explícita do admin**, entrando no **mesmo commit** dos posts. **Nunca auto-criar.** Renomear/remover: migrar todos os posts que referenciam **antes** de tirar do enum (jamais quebrar o Zod / build).

2. **Direção da reconciliação D1 ↔ Git.** **Git é autoritativo para conteúdo publicado** (é a fonte do build); **D1 é a camada de edição/índice**. Ao encontrar um `.md` no Git sem linha em `posts_meta` (os legados importados pelo `.py`), o Engine faz **backfill** da linha no D1. Drafts não publicados vivem só no D1.

3. **Campos SEO extras (`metaTitle`/`metaDescription`/`focusKeyword`).** **Manter inertes/informativos por enquanto** (alinhado ao ADR-008, que adiou ativá-los por causa de valores legados truncados). O Engine grava no frontmatter (o `buildMarkdown` já faz), mas o render não os usa até a **Fase 5.1** (tarefa separada de conteúdo: declarar no schema + limpar legados + estender `BaseHead`).

4. **Schema de autores importados.** **Nova tabela `authors`** desacoplada de `users` (evita o `password_hash NOT NULL` e o acoplamento com login/convite). `posts_meta.author_id` passa a referenciar `authors`. Como o blog é efetivamente single-author, autores importados mapeiam para um autor default ou viram metadados.

5. **Workspace agora vs. depois.** **Adiar `npm workspaces`** — começar `packages/migration-engine` como **pasta TS compilada** na Fase 1, validar `astro build` no ambiente do Cloudflare Pages, e só então (Fase 2) habilitar workspaces. Evita o risco de *hoisting* derrubar o build em produção.

> **Não bloqueiam o MVP** (resolver na Fase 2+): **Cloudflare Images vs. R2+sharp** → recomendado **R2 + `sharp` no CLI** (gera WebP/AVIF uma vez, custo muito menor, sem transform recorrente para 1M imagens); **provedor de IA** → decidir na Fase 4.

---

*Decisões registradas por Claude (Opus 4.8) em 2026-06-28 como defaults recomendados, pendentes de validação final do dono antes de iniciar a codificação da Fase 0.*
