# DECISIONS (ADRs)

Decisões arquiteturais relevantes. Formato curto: **Contexto · Decisão · Alternativa descartada**.
Mais recente no topo. Reversível — o humano pode discordar e reverter.

---

## ADR-008 — Adiar uso de `metaTitle`/`metaDescription` do frontmatter (FASE 5.1)
- **Contexto:** a auditoria sugeriu usar `metaTitle`/`metaDescription` do frontmatter no render. Mas o `content.config.ts` (Zod) **não declara** esses campos → eles são descartados no build; e há `metaTitle` truncado com "…" em post(s) legados.
- **Decisão:** **não** habilitar agora. Habilitar exigiria (a) adicionar os campos ao schema e (b) revisar/limpar os valores legados — senão alguns títulos de SERP pioram, violando o princípio #1 (não quebrar SEO).
- **Alternativa descartada:** adicionar ao schema e preferir `metaTitle ?? title` cegamente (degrada títulos ruins).
- **Status:** adiado; entra como tarefa de conteúdo (revisar metaTitle/description antes de ativar).

## ADR-007 — Fonte única de configuração em `src/config/site.ts` (FASE 1)
- **Contexto:** domínio/identidade `paulgomes.com.br` hardcoded em ~19 arquivos — bloqueia multi-tenant e ameaça o limite #1 (canonical/sitemap/RSS quebram se o domínio mudar).
- **Decisão:** um módulo tipado `TenantConfig` como fonte única (domínio, marca, autor, organização, social). Consumidores migram incrementalmente, exigindo **saída de build byte-idêntica** a cada fatia. Multi-tenant depois = trocar/parametrizar este objeto.
- **Alternativa descartada:** ler tudo de env vars (não cobre identidade estruturada nem schema) e refactor big-bang dos 19 arquivos de uma vez (risco ao site no ar).
- **Status:** em execução — fatia 1.1 (`schema.ts`) feita e verificada.

## ADR-006 — i18n: dicionário tipado + roteamento i18n do Astro (PROPOSTA, pós-Fase 0)
- **Contexto:** mandato exige toda string visível internacionalizável (PT-BR/EN/ES), zero hardcode. Hoje as strings PT-BR estão espalhadas nos `.astro`.
- **Decisão (proposta, a confirmar no `ARQUITETURA-PROPOSTA.md`):** camada `src/i18n/` com dicionários tipados por locale + helper `t(key, locale)`, e roteamento i18n nativo do Astro. Migração incremental (componente a componente), nunca big-bang.
- **Alternativa descartada:** biblioteca externa de i18n (viola Princípio 2: nativo > dependência) e refactor big-bang (viola limite de site no ar).
- **Status:** pendente. Não codar antes do `ARQUITETURA-PROPOSTA.md`.

## ADR-005 — Tempo de leitura extraído para `src/lib/reading-time.ts`
- **Contexto:** lógica duplicada em `FeaturedCarousel` e `[...slug]`.
- **Decisão:** fonte única em `lib/` (DRY). Usada nos dois pontos.
- **Alternativa descartada:** manter duplicado (risco de divergência).

## ADR-004 — `_headers` conservador, sem CSP restritiva
- **Contexto:** faltavam headers de segurança; CSP estrita quebraria scripts inline do Astro e futuros embeds (AdSense).
- **Decisão:** headers de hardening seguros (nosniff, Referrer-Policy, X-Frame-Options SAMEORIGIN, Permissions-Policy, HSTS) + cache imutável `/_astro/*`. CSP fica para fase futura (precisa de nonce/allowlist testados).
- **Alternativa descartada:** CSP agressiva agora (alto risco de quebrar render).

## ADR-003 — JSON-LD centralizado em `src/lib/schema.ts`
- **Contexto:** schema espalhado; plataforma multi-tenant vai precisar de grafo de entidades por tenant.
- **Decisão:** grafo base (WebSite+Organization+Person) e helpers (breadcrumb, FAQ) numa lib única, com `@id` cruzados. Hoje hardcoded ao tenant paulgomes; vira parametrizável por tenant na fase multi-tenant.
- **Alternativa descartada:** duplicar JSON-LD por página (acoplamento, difícil evoluir).

## ADR-002 — Fase 0 via auditoria multi-agente paralela
- **Contexto:** plataforma grande; mandato exige entender cada decisão antes de mudar.
- **Decisão:** workflow de 5 agentes read-only mapeando subsistemas → insumo para `ARQUITETURA-ATUAL.md` e `ROADMAP.md`.
- **Alternativa descartada:** leitura linear sequencial (mais lenta, menor cobertura).

## ADR-001 — Push/deploy para produção fica gated (FILA-HUMANA)
- **Contexto:** modo autônomo pede execução sem aprovação a cada passo, MAS há regra permanente "deploy só com aviso" e o deploy afeta o SEO de 115+ posts (ação de alto risco/irreversível).
- **Decisão:** trabalho autônomo + **commits locais** com build verde; **push/deploy só após autorização humana** (registrado em `FILA-HUMANA.md`). Coerente com a própria regra do prompt de rotear ações irreversíveis para a fila.
- **Alternativa descartada:** push automático a cada commit (conflita com a regra permanente e com o risco em produção).
