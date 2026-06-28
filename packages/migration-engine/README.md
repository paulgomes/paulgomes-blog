# @paulgomes/migration-engine

Subsistema de **migração de conteúdo** (importar / exportar / sincronizar entre CMSs)
por **arquitetura de conectores**. Pacote TypeScript **standalone** e agnóstico de
ambiente — não é importado pelo app Astro (decisão #5: sem `npm workspaces` por ora,
zero impacto no `astro build`).

> Projeto e plano completos: [`../../docs/MIGRATION-ENGINE.md`](../../docs/MIGRATION-ENGINE.md)

## Estado (MVP — Fase 1 parcial)

Implementado e verificável ponta-a-ponta (WordPress XML → Markdown):

- **Core/types** — `CanonicalPost` + AST `CanonicalBlock[]`, `SourceConnector`/`Exporter` (ISP), ports, jobs, reports.
- **Conector `wordpress-xml`** — lê o WXR, entrega `RawEntity` cru (streaming `AsyncIterable`).
- **Transformers** — HTML/Gutenberg → Markdown (turndown + pré-processo) → AST → Markdown nativo.
- **Validators** — **gate de categorias** (nunca commita fora do enum), sanitização, `detectMime`.
- **Renderer** — `canonical-to-markdown` espelha o `buildMarkdown` do projeto (data original preservada).
- **CLI** (Anel 3) — `runImport` ponta-a-ponta, escreve preview em `.out/` (nunca em `src/content/blog`).

## Rodar

```bash
cd packages/migration-engine
npm install
npm run build            # tsc -> dist/
node dist/cli/import.js --connector wordpress-xml --source ../../migration/wordpress-export.xml --out .out --limit 5
```

Saída: `.out/src/content/blog/*.md` (preview) + `.out/migration-report.json`.

## O que falta (próximas fatias — ver doc)

- Fase 0 (produção): RBAC (`requireRole`), `audit_logs`, wrapper `commitPost()` com gate em **todos** os caminhos de commit. *(Não aplicado ao painel ao vivo sem teste — passo de deploy do dono.)*
- Fase 2: mídia (download → R2 → variantes), `heroMedia` via attachment.
- Fase 3: sync incremental por hash. Fase 4: IA aprovável. Fase 5: mais conectores + export. Fase 6: Worker/Queue/checkpoint p/ 100k+.
