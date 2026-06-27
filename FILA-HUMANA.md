# FILA-HUMANA

Tudo que depende de você (acessos, segredos, DNS, contas, decisões de negócio, deploy).
Resolva em lote, de forma assíncrona. Eu sigo trabalhando no que não depende disso.

> Status: 🔴 pendente · 🟡 opcional · ✅ resolvido

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
