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
