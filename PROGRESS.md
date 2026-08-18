# PROGRESS

Log cronológico do trabalho na Core Platform. Mais recente no topo.

> Convenção: cada entrada tem data, o que foi feito, e estado do build/deploy.

---

## 2026-08-18 — /palestras vira landing page autônoma (design v2 + mecanismo de mídia)

Sessão longa, na nuvem. Tudo commitado e publicado em `main` (`4e5feca`).

### Painel: seletor de categorias (`8a2330d`)
- O campo de categoria do editor era `<input>` de texto livre com valores separados por vírgula. Além da UX, era **risco de build**: `categorias` é `z.enum(CATEGORIAS)` e um erro de digitação derruba o `astro build` — ou seja, o deploy.
- Virou seletor múltiplo: chips, dropdown filtrável, checkbox por item. Lista vem de `GET /api/categorias`, com o enum de build como fallback. `#category` continua existindo como `hidden` com a mesma string, então autosave, validação e preview de SEO seguem sem alteração.
- Categoria que já está no post mas não consta no registro é mantida na seleção — descartar em silêncio apagaria dado ao salvar.

### /palestras reconstruída (`9559ba7` → `4e5feca`)
Três rodadas, nesta ordem:

1. **Landing autônoma.** Saíram `<Header>` e `<Footer>` do blog (o menu completo só oferece caminhos para SAIR antes do formulário). Entraram barra mínima e rodapé curto — curto, e não ausente, porque página sem link para o resto do domínio vira órfã para o rastreador e perde a ligação com a entidade Paul Gomes. Pelo mesmo motivo entrou `BreadcrumbList`.
2. **Roteiro v2** (briefing do dono, 17 seções): prova social com marcas, diagnóstico, "o que a sala leva", filtro de intenção, territórios de domínio, posição "Made by humans", como funciona e 10 perguntas frequentes. H1 virou "Nem toda transformação avisa que começou"; temas foram de 4 para 5.
3. **Elevação de design + UX.** Índice numerado no lugar de cards, marcas como nomes espaçados, filete vertical nas evidências, azul recolhido para poucos pontos (a faixa "Made by humans" é o único bloco de cor cheia, e só funciona como clímax por isso). Barra de ação fixa no celular, régua de progresso, link "pular para o conteúdo", foco visível, `scroll-margin` nas âncoras, FAQ exclusivo via `name`.

**Seção de vídeos removida** a pedido, junto com o import de `videos.json`.

### Mecanismo de mídia: `src/assets/palestrante/`
Pasta varrida no build por `import.meta.glob`. Quem for trocar as fotos **só precisa commitar arquivo lá** — nenhuma linha de código muda. Convenção documentada no `README.md` da pasta:

| Nome | Onde entra |
| --- | --- |
| `hero.*` | foto grande do topo |
| `retrato.*` | bloco "Quem sobe no palco" |
| `citacao.*` | faixa larga da frase de palco |
| `citacao.mp4` / `.webm` | vídeo de fundo daquela faixa |
| qualquer outro nome | galeria "No palco", ordem alfabética |

- Sem os reservados, cai nas fotos de `src/assets/brand`. Sem outras fotos, a galeria não renderiza.
- O `alt` da galeria sai do nome do arquivo — o nome é lido por leitor de tela e pelo buscador.
- O vídeo não tem `autoplay` no HTML: só baixa quando a faixa chega perto da tela, pausa fora dela, e sob `prefers-reduced-motion` não baixa um byte. Tem botão de pausa (WCAG 2.2.2). Se o arquivo falhar, fica o poster.
- Slot do hero tem proporção 4/5 fixa com `object-fit: cover`: a foto é trocável, e sem isso o tamanho do bloco passaria a depender do formato do arquivo que alguém subisse.

### Decisões que não devem ser desfeitas sem motivo
- **Nenhum número de audiência, evento ou empresa foi inventado.** Artigos e ano do primeiro texto são calculados da coleção; os 15 anos derivam do ano de fundação. Nada disso envelhece sozinho.
- O rótulo do ano diz "primeiro texto do arquivo", não "anos de experiência": 2011 vem de dois posts isolados e o volume real começa em 2020.
- A entrada dos blocos ao rolar usa conferência de geometria no handler de rolagem, **não** `IntersectionObserver` — o observador entrega em lote e, sob rolagem rápida, pulou 23 blocos num teste. Bloco pulado aqui não é animação perdida, é pedaço de página invisível. O CSS que esconde só vale sob `html.js`, marcado antes da primeira pintura: sem JavaScript a página aparece inteira.

### Correções de SEO no caminho
- `ciso-as-a-service`: `description` vazia (Zod aceita string vazia, então o build passava e a página saía sem meta description) e dois `h1` na mesma página. Corrigidos (`80bd344`).

### Estado
Build verde (268 páginas), `npm run seo:audit` sem erros, sem estouro horizontal em 390/768/1440px, tema escuro conferido.

---

## 2026-07-08 — Cluster "contratar agência" agendado 1/dia (futuro)

- **5 artigos satélite** da palavra-chave comercial "agência de marketing Sorocaba" (como escolher, quanto custa, perguntas antes de contratar, agência vs. equipe interna, o que uma agência entrega), todos funelando com CTA para a LP `/agencia-de-marketing-em-sorocaba/` — sem canibalizar (intenção informacional; LP segue dona da intenção transacional).
- Verificação adversarial aplicou: disclosure da WYS limitado a 1 menção no fechamento, zero preços de mercado inventados, links só da allowlist.
- Heros de stock no R2 (`blog-agencia-*.jpg`), build verde (253 páginas).
- **Agendados no D1 (fluxo nativo): 1/dia, 09→13/07/2026 às 12:00 UTC (9h BRT)**. O Worker `paulgomes-cron` publica sozinho — mecanismo já validado 2x em produção (teste unitário + dreno dos 31 regionais).

## 2026-07-05 — Seção /ferramentas/ útil + série regional agendada retroativa

### /ferramentas/ (commit `ce75f88`)
- **6 artigos-ferramenta** publicados e linkados nos cards (badge "disponível", zero "em breve"): Glossário de IA (56 termos, 36 links internos p/ os artigos profundos), Glossário de SEO/GEO (59 termos), Biblioteca de 12 prompts, 3 checklists (43 itens), 5 templates, 7 calculadoras com exemplos conferidos aritmeticamente na revisão adversarial.

### Série regional (31 artigos, Sorocaba/Votorantim/Boituva/Araçoiaba da Serra)
- Gerados por workflow (escrita + verificação adversarial de fatos locais), heros de stock (Magnific/Freepik) redimensionados e hospedados no R2 (`media.paulgomes.com.br/2026/07/blog-regiao-*.jpg`).
- **Publicados pelo mecanismo NATIVO de agendamento** (drafts `scheduled` no D1 → Worker `paulgomes-cron` → publishDraft), em lotes de 10/15min (~61 min de dreno). Por decisão do dono, com **datas retroativas 1/dia de janeiro/2026** (pubDate 01–31/jan; `published_at` = dia agendado). Estes 31 estão em `posts_meta` → **visíveis/editáveis no painel** (diferente dos 41 de 2026-07-04, que foram direto no Git).
- Verificação: 31/31 URLs 200, pubDates de janeiro renderizadas, heros ok, sitemap ok, 0 `scheduled` restantes no D1.
- ⚠️ Nota de risco registrada: datas retroativas podem divergir da data de descoberta pelo Google (sinal de spam potencial); reversível editando os posts no painel.

## 2026-07-04 — Publicação em lote (IA avançada) + conserto do agendamento

### Conteúdo publicado
- **11 posts** sobre Claude Fable 5 / Mythos 5 (lançamento + suspensão/retomada pelo governo dos EUA), apurados em fontes primárias.
- **30 artigos** de IA avançada em 10 clusters (arquiteturas, treino/alinhamento, inferência, raciocínio, agentes, RAG, multimodal, interpretabilidade/segurança, avaliação, sistemas), gerados por workflow multi-agente (escrita + verificação factual adversarial) + revisão ortográfica pt-BR. Publicados de uma vez (decisão do dono, pois o cron ainda estava quebrado na hora). Build verde (208 páginas), categorias no enum, canonical/sitemap/RSS ok.

### Agendamento CONSERTADO (resolve item 7 da FILA-HUMANA)
- **Diagnóstico:** a GitHub Action `publish-scheduled.yml` não publicava nada (secret `CRON_SECRET` ausente nos GitHub Actions secrets); endpoint no Pages estava ok.
- **Fix:** Worker **`paulgomes-cron`** (`cron-worker/`) com Cron Trigger `*/15` → `/api/cron/publish-scheduled`; `CRON_SECRET` rotacionado no Pages e no Worker. Ver **ADR-011**.
- **Validação real:** um draft `scheduled` vencido foi publicado sozinho pelo Worker (commit `feat(post): publica…` + deploy), depois removido. D1 limpo (0 `scheduled`).

## 2026-06-29 — CMS /painel: evolução editorial premium (FASE 1 parcial)

### Auditoria (inventário — o que JÁ existe, fonte: repo + D1)
CMS já é **premium (~80%)**. Mapeado por workflow de 5 agentes:
- **Listagem** (`src/pages/painel/posts/index.astro`): card (thumb/status/sync badge/categoria/data/título/desc), filtros por status (pills com contador), categoria, busca (debounce), paginação (50/pág), editar/excluir/restaurar/purgar, empty states, URL state. UNION `posts_meta`+`drafts` via `GET /api/posts`.
- **Editor** (`editor.astro` 1472 linhas + `Editor.tsx` TipTap island): autosave (1.5s, retry), upload R2 (paste/drop), wordcount+readTime, bloco SEO premium (score/SERP/checklist via `seo-analyzer.ts`), hero com preview/alt, datetime + "Agora", destaque com sync, feedback multi-estado.
- **Layout** (`PainelLayout.astro` + `painel.css` 958 linhas): sidebar (10 itens), topbar, drawer mobile, toast/confirm globais, tokens de design, badges, btn-neu.
- **Backend** (`functions/api/**`): publicar, voltar-a-rascunho, sync/sync-all, feature, restore, purge (admin), upload, stats (contadores). RBAC base (requireRole) + audit_logs.
- **Libs**: `seo-analyzer.ts` (analyzeSEO/score/checks/generate*), `categorias.ts` (enum gate), `reading-time.ts`.

### O que foi FEITO nesta sessão (build verde, SEM push)
- **Editor — título cortado CORRIGIDO**: `<input>` (linha única, cortava títulos longos) → `<textarea>` auto-crescente (quebra/wrap + `field-sizing:content` + autoGrow JS + Enter sem newline).
- **Layout premium**: sidebar reorganizada em **grupos** (Conteúdo/Estrutura/Crescimento) com rótulos; **topbar** ganhou **busca global** (form GET → `/painel/posts?q=`), **status de sync** (pill reusando `GET /api/stats.unsynced`: verde "Sincronizado" / âmbar "N pendentes") e CTA **"Novo post"**. Responsivo (mobile esconde busca/sync).
- **Listagem — ações rápidas**: cada post publicado ganhou **Copiar link** (clipboard) e **Duplicar** (`POST /api/posts/:slug/duplicate` → cria rascunho-cópia e abre no editor), além do Excluir. Hover do excluir preservado (vermelho).
- **Listagem — indicadores no card**: badge **★ Destaque** (`is_featured`) e badge **SEO ✓/!** (completo = meta title+description+palavra-chave) por post. `GET /api/posts` passou a retornar `is_featured` + `seo_ok` (colunas aditivas, sem mexer em WHERE/bindings).
- **Backend aditivo**: novo endpoint `functions/api/posts/[slug]/duplicate.ts` (espelha o INSERT de `drafts/index.ts`, cria rascunho cópia, audita).

### O que ficou para próximas fatias (ver `FILA-HUMANA.md`)
Listagem (bulk-select, ⋯ menu completo, indicador SEO/⭐ no card, filtros data/SEO/imagem/destaque, ordenação), editor (accordions na coluna lateral, preview, histórico), agendamento (precisa cron Worker), métricas reais (analytics), newsletter no editor, calendário editorial. **Motivo do recorte:** páginas do painel ficam atrás de login → não dá pra QA visual headless; priorizei o que é verificável por build + baixo risco de quebrar features existentes.

---

## 2026-06-27 — Deploy autorizado e publicado

- Push de **11 commits** (`b5e857f..f8fe824`) → Cloudflare Pages. **Verificado em produção:** grafo JSON-LD (WebSite/Org/Person), "Leia também", headers de segurança (nosniff/Referrer-Policy/X-Frame-Options/Permissions-Policy/HSTS) e canonical intacto (limite #1 preservado). `FILA-HUMANA` item 1 resolvido.

## 2026-06-27 — Modo turbo (execução contínua, sem push)

Fatias entregues (cada uma: build verde + dist-diff em superfície de SEO + commit atômico):
- **Fase 1.2 — domínio→config:** feeds `llms.txt`/`llms-full.txt`/`video-sitemap.xml` e BreadcrumbList (post + categoria) passam a derivar o domínio de `SITE_CONFIG`. Saída byte-idêntica (llms 39 URLs, loc do video-sitemap e breadcrumbs intactos). Commits `067023f`, `4b560f1`.
- **Fase 5.2 — Leia também:** novo `RelatedPosts.astro` (ranqueia por sobreposição de categorias, fallback mais recentes), 3 cards no fim do artigo. Internal linking + dwell time. Commit `5ba5aa5`.
- **Fase 5.1 ADIADA (ver ADR-008):** `content.config.ts` não declara `metaTitle`/`metaDescription` (são descartados no build) e a auditoria achou `metaTitle` truncado com "…" em post(s); habilitar cegamente pioraria títulos → fere o princípio #1 (não quebrar SEO). Precisa de revisão de conteúdo.

Restante do ROADMAP que **não** avancei nesta sessão (motivo): Fase 2 i18n (escopo grande, ~200 strings — próxima sessão), Fase 3.4 rate-limit (⛔ precisa KV, `FILA-HUMANA`), Fase 4 multi-tenant (⛔ decisões de negócio, `FILA-HUMANA`).

## 2026-06-27 — Fase 0 concluída · Fase 1 iniciada (modo autônomo)

- **Fase 0 concluída:** `ARQUITETURA-ATUAL.md` e `ROADMAP.md` produzidos a partir da auditoria de 5 subsistemas. Roadmap priorizado em 6 fases (Fase 1 = fundação de configuração; Fase 2 = i18n; Fase 3 = backend limpo/hardening; Fase 4 = multi-tenant; Fase 5 = SEO/GEO; Fase 6+ = épicos).
- **Fase 1 · fatia 1.1 (feita):** criada a fonte única `src/config/site.ts` (`TenantConfig`) e `src/lib/schema.ts` passou a consumir domínio+identidade dela. **Build verde, saída byte-idêntica** (grafo JSON-LD e canonical inalterados — limite inviolável #1 preservado). Primeiro passo pra eliminar os 19+ literais de domínio.
- ADRs novos: ver `DECISIONS.md`.

## 2026-06-27 — Fase 0 iniciada (modo autônomo Core Platform)

- **Auditoria arquitetural multi-agente** disparada (5 subsistemas: pipeline de conteúdo D1→Git, superfície de API, painel/editor, render/SEO, prontidão multi-tenant/i18n) para gerar `ARQUITETURA-ATUAL.md` + `ROADMAP.md`.
- Inicializados os logs do modo autônomo: `PROGRESS.md`, `DECISIONS.md`, `FILA-HUMANA.md`.
- **Commitado (local, build verde, 152 páginas)** o lote SEO/GEO/segurança em 4 commits atômicos:
  - `feat(lib)`: `reading-time.ts` + `schema.ts` (grafo JSON-LD reutilizável).
  - `feat(post)`: ShareButtons + tempo de leitura no artigo.
  - `feat(geo)`: grafo global WebSite/Organization/Person, BreadcrumbList, FAQPage, Article com `@id`+ImageObject.
  - `fix(sec,seo,perf)`: `public/_headers`, `/parceiros` noindex, preconnect Open-Meteo.
- **NÃO pushado** — push/deploy aguarda autorização humana (ver `FILA-HUMANA.md`, ADR-001).

## 2026-06-25/26 — Sessão anterior (pré-mandato Core Platform)

- Correção do hero mobile (faixa vazia) — **publicada** (commit `4685079`).
- Barra de categorias em loop (marquee), card do autor "São Paulo", widget de tempo (Open-Meteo, sem chave), AdSlot (placeholder banner), selo "Projeto criado por" WYS no rodapé, LP `/agencia-de-marketing-em-sorocaba/` — **publicados** (push `4685079..b5e857f`).
- **Fix de SEO**: `_redirects` com barra final nos alvos (elimina cadeias 301→308, vira 1 hop) + reaproveita 404 com backlink → LP. Verificado em produção. **Publicado.**
- Auditoria técnica de 7 dimensões (SEO/CWV/a11y/schema/segurança/indexação/código) → base do backlock de qualidade.
