# FILA-HUMANA

Tudo que depende de você (acessos, segredos, DNS, contas, decisões de negócio, deploy).
Resolva em lote, de forma assíncrona. Eu sigo trabalhando no que não depende disso.

> Status: 🔴 pendente · 🟡 opcional · ✅ resolvido

---

## 🔴 6. Aprovar o push desta sessão (CMS /painel — FASE 1 parcial)
- **Contexto:** modo autônomo deixou tudo pronto e **build verde**, mas a regra é não pushar sem você (ADR-001). Inclui também um endpoint NOVO (`/api/posts/:slug/duplicate`) que só passa a existir em produção após deploy.
- **O que fazer:** revisar o diff e dar o OK pro push. Mensagens de commit sugeridas no resumo do chat.

## ✅ 7. Agendamento de posts — RESOLVIDO (2026-07-04)
- **Contexto:** a coluna `scheduled_at` e o status `scheduled` já existiam, mas nenhum job disparava a publicação. A GitHub Action `publish-scheduled.yml` nunca funcionou (secret `CRON_SECRET` não configurado nos GitHub Actions secrets + agendador instável do GitHub).
- **Feito:** criado o Worker **`paulgomes-cron`** (pasta `cron-worker/`) com **Cron Trigger `*/15`** que chama `/api/cron/publish-scheduled` autenticado por `CRON_SECRET` (rotacionado no Pages e no Worker). Independe do GitHub Actions. Validado ponta a ponta: um draft `scheduled` vencido foi publicado sozinho (commit no Git + deploy) e depois removido. Ver **ADR-011**.
- **Pendência menor:** a GitHub Action antiga ficou redundante (responde 401 com o secret antigo, não publica nada). Pode ser desabilitada/removida quando quiser.

## 🟡 10. Mídia da /palestras — hero e vídeo resolvidos; galeria travada por identidade
- **Contexto:** os arquivos estavam em `C:\Users\Paul\Desktop\PAULGOMES-BLOG\palestrante\editadas`, fora do repositório, e a sessão na nuvem não alcançava o disco local. Resolvido em sessão local (2026-08-18), que pôde **abrir as imagens** — coisa que a sessão da nuvem não fez ao redigir este item.
- **Feito:** `11.png` → `src/assets/palestrante/hero.jpg`; `parallax.mp4` → `citacao.mp4` (sem áudio, marca d'água do Gemini removida com `delogo`, `+faststart`); faixa da citação ganhou parallax.
- **🔴 Pendente — decisão do dono.** As fotos que este item mandava pôr na galeria "No palco" (`1`, `2`, `3`, `IMG_7486`, `IMG_7517`, `IMG_7529`, evento Exness) **não são do Paul Gomes**: mostram outra pessoa. Conferido contra `src/assets/brand/paul-gomes.webp`, `paul-avatar.png` e as quatro fotos pessoais da raiz de `PAULGOMES-BLOG` — todas batem entre si e com a `11`/`33`, e nenhuma bate com as de palco. A galeria gera `alt="Paul Gomes — …"` a partir do nome do arquivo, então publicá-las afirmaria que é ele.
  - **O que fazer:** dizer de quem são. Se forem de outro palestrante/parceiro, a galeria precisa de legenda com crédito (hoje não tem esse campo). Se existirem fotos de palco do próprio Paul, são essas que entram.
  - Enquanto não decidir, a galeria não é renderizada — a página não mostra grade vazia.
- **Recomendação registrada (mantida):** deixar de fora as imagens de banco (`business-executives…`, `waiting-room…`, `young-girl…`) e as da parede "Thinking Forward". Numa página que promete "projeto entregue, não leitura de relatório", foto de banco enfraquece o argumento.
- **Nota sobre o vídeo:** `parallax.mp4` é gerado por IA (metadata `encoder=Google`, marca d'água do Gemini) e mostra um rosto que não é o do Paul. Fica de pé como **fundo decorativo** porque é o mesmo papel que a imagem anterior (`paul-ai.jpeg`) já cumpria ali, e o `<video>` é `aria-hidden`. Se a intenção for mostrar o palestrante nessa faixa, o arquivo é o errado.
- **Alternativa sem Git:** subir no `/painel/midia` e passar as URLs do `media.paulgomes.com.br`.

## 🟡 11. Números reais para a faixa de evidência da /palestras
- **Contexto:** a faixa mostra 4 itens, e três são calculados do próprio conteúdo (artigos publicados, ano do primeiro texto, anos desde a fundação). Não há nenhum número de audiência, evento ou empresa atendida — esses não têm como ser verificados a partir do repositório, e número inventado em página comercial só aparece quando um cliente cobra a fonte.
- **O que fazer:** se existirem números auditáveis (pessoas impactadas, eventos realizados, empresas atendidas), passar que eles entram na mesma lista `evidencias` em `src/pages/palestras.astro`.
- **Relacionado:** o `AUTHOR_CARD` em `src/consts.ts` tem contagens de seguidores marcadas como placeholder no próprio código. Também precisam dos números reais ou de remoção.

## 🟡 12. Auto Ads do AdSense na /palestras
- **Contexto:** o loader do AdSense está no `BaseHead`, então carrega em todas as páginas, inclusive na landing. Não há bloco de anúncio na `/palestras`, mas **se o Auto Ads estiver ligado no painel do AdSense**, o Google pode injetar anúncio ali — competindo com o CTA numa página cujo único objetivo é o formulário.
- **O que fazer:** decidir. Se quiser, dá para excluir `/palestras` do Auto Ads pelo painel do AdSense.

## 🟡 8. Métricas reais de acesso (FASE 3 — estatísticas avançadas)
- **Contexto:** `GET /api/stats` só tem contadores (total/publicados/rascunhos…). Não há views/pageviews/bounce/top-posts.
- **O que fazer:** escolher a fonte — **Cloudflare Web Analytics** (já ativo no site, mas sem API de leitura fácil) vs **Analytics Engine**/GA4 — e me dar acesso/credencial. Sem isso, a UI de "estatísticas avançadas" fica só scaffolding.

## ✅ 9. Histórico de versões dos posts — RESOLVIDO (2026-06-29)
- **Decisão (autônoma):** usar o **histórico de commits do GitHub** (fonte da verdade do build), sem tabela nova.
- **Feito:** `GET /api/posts/:slug/history` (read-only, lista commits que tocaram o `.md`) + painel **"Histórico de versões"** no editor (data/autor/mensagem + link pro commit). Deployado.

> Item 8 é a dependência de backend que ainda trava parte das FASES 2-3 do CMS (itens 7 e 9 já resolvidos). A camada visual/estrutural pode ser entregue com `// TODO` enquanto isso.

---

## ✅ 1. Autorizar push/deploy para produção — RESOLVIDO (2026-06-27)
- Autorizado e publicado: 11 commits (`b5e857f..f8fe824`). Deploy verificado em produção (grafo JSON-LD, "Leia também", headers de segurança, canonical intacto).
- Próximos pushes voltam a aguardar seu aviso (ADR-001 segue valendo).

## 🔴 2. Search Console — validar correções (após o deploy do item 1)
- **Onde:** Google Search Console → Indexação → Páginas.
- **O que fazer:** nos relatórios *"Página com redirecionamento"* e *"Página alternativa com tag canônica adequada"*, clicar **"Validar correção"**.
- **Por quê:** força o re-rastreamento depois do fix de redirects/canonical já publicado.

## 🟡 3. Número de WhatsApp real para os CTAs da LP de Sorocaba
- **Contexto:** a LP `/agencia-de-marketing-em-sorocaba/` aponta os CTAs ("Falar com especialista") para `https://agenciawys.com.br`. Se houver um WhatsApp comercial, troco por um link `wa.me` com mensagem pré-preenchida (mais conversão).
- **O que fazer:** me passar o número (formato +55 11 9XXXX-XXXX).

## 🟡 4. (Futuro) Cloudflare KV namespace para rate-limiting
- **Contexto:** quando eu implementar rate-limit em `/api/contact` e `/api/newsletter` (hardening), preciso de um KV namespace.
- **O que fazer:** criar o namespace no painel Cloudflare e me passar o binding, OU autorizar eu criar via `wrangler` (precisa de acesso autenticado).

## 🟡 5. (Futuro multi-tenant) Decisões de negócio
- Modelo de onboarding de novos blogs (tenants): 1 repo por tenant vs. 1 repo multi-tenant com config por domínio?
- Estratégia de domínios (subdomínio `*.plataforma` vs. domínio próprio por tenant).
- Essas decisões entram no `ARQUITETURA-PROPOSTA.md` como opções; você escolhe.
