# Formulário de contato + Cloudflare Email Service (beta)

Documentação do formulário de contato em `/contato` que envia e-mails pelo
**Cloudflare Email Service — Email Sending** (public beta), via **API REST**.

> Status: ✅ funcionando em produção desde 02/06/2026.

---

## Visão geral

- **Página:** [src/pages/contato.astro](../src/pages/contato.astro) — formulário + validação no cliente.
- **Endpoint:** [functions/api/contact.ts](../functions/api/contact.ts) — `POST /api/contact`, valida, sanitiza e envia.
- **Entrega:** e-mail vai para `paulgomes@wys.com.br`, remetente `contato@paulgomes.com.br`, `reply_to` = e-mail do visitante.
- **Serviço de envio:** Cloudflare Email Service (beta) pela **API REST** (não pelo binding — ver gotcha abaixo).

---

## Como o envio funciona

O endpoint chama a API REST do Email Service:

```
POST https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/email/sending/send
Authorization: Bearer {EMAIL_API_TOKEN}
Content-Type: application/json
```

Body **(schema correto da API REST)**:

```json
{
  "to": "paulgomes@wys.com.br",
  "from": { "address": "contato@paulgomes.com.br", "name": "Site Paul Gomes" },
  "reply_to": "visitante@exemplo.com",
  "subject": "Contato: ...",
  "html": "...",
  "text": "..."
}
```

---

## Configuração necessária (no painel Cloudflare)

1. **Domínio remetente verificado**
   Cloudflare → **Email → Envio de Email (beta)** → `paulgomes.com.br` deve estar
   **Habilitado** + **DNS Configurado**. O `from` precisa usar esse domínio.

2. **Plano Workers Paid** — o Email Service exige plano pago.

3. **Token de API** (permissão `Conta → Envio de emails → Editar`)
   Criado em **Email → Envio de Email → API REST → "Criar token de Envio de email"**.

4. **Secret no projeto Pages**
   Workers e Pages → `paulgomes-blog` → Settings → **Variáveis e segredos** →
   **Adicionar** → tipo **Segredo** → nome `EMAIL_API_TOKEN` → valor = o token.
   (Depois de salvar, fazer um **redeploy** pra valer.)

5. **Variável `CLOUDFLARE_ACCOUNT_ID`** — está em [wrangler.toml](../wrangler.toml) (`[vars]`).

---

## ⚠️ Os 4 erros que enfrentamos (e as soluções)

Guardar isto — economiza horas em projetos futuros de **Pages + Email Service**.

### 1. O binding `send_email` NÃO funciona em projetos Pages
O exemplo oficial da Cloudflare (`env.EMAIL.send()`) só funciona em **Workers**.
Em **Pages**, o build de produção falha com:
```
✘ Configuration file for Pages projects does not support "send_email"
```
**Solução:** não usar `[[send_email]]` no wrangler.toml. Usar a **API REST** do
mesmo serviço (endpoint acima). Mesma entrega, sem binding.
> Curiosidade: `wrangler pages dev` LOCAL aceita o binding e simula o envio —
> mas o build de produção rejeita. Não confiar só no teste local.

### 2. Variáveis de ambiente travadas no painel
Como o projeto gerencia env vars pelo `wrangler.toml`, o painel **bloqueia** editar
variáveis de **texto**. Mas a própria mensagem do painel diz:
*"Somente segredos podem ser gerenciados através do Dashboard."*
**Solução:** adicionar o token como **Segredo** (não Texto) — esse tipo é liberado.

### 3. Schema da API REST é diferente do schema de Workers
Primeiro envio deu `400 invalid_request_schema` (código 10001) porque usei o
formato da API de Workers. Diferenças:

| Campo | API Workers | API REST (correto) |
|-------|-------------|--------------------|
| `from` objeto | `{ email, name }` | `{ address, name }` |
| reply-to | `replyTo` (camelCase) | `reply_to` (snake_case), string |
| `to` | string/obj/array | string/obj/array (ok) |

**Solução:** usar `from: { address, name }` e `reply_to: "<email>"`.

### 4. A Cloudflare mascara status 502/504 do origin
Quando o endpoint retornava `502`, a Cloudflare substituía a resposta pela página
genérica `error code: 502` (text/plain), quebrando o `res.json()` no cliente
(aparecia "Erro de conexão"). **Solução:** em caso de falha de envio, retornar
**`503`** (passa direto) em vez de 502.

---

## Camadas de segurança implementadas

- **Anti-XSS:** todo conteúdo é escapado (`esc()`) antes de virar HTML no e-mail —
  `<script>` chega como texto literal, não executa.
- **Anti header-injection:** caracteres de controle (`\n`, `\r`, etc.) são removidos
  dos campos de 1 linha antes de montar o e-mail.
- **Sem SQL injection / malware:** o endpoint não toca no banco e não aceita upload.
- **Honeypot:** campo oculto `company`; se preenchido (bot), finge sucesso sem enviar.
- **Content-Type obrigatório** (`415` se não for JSON).
- **Validação de formato/tamanho** server-side (espelha o cliente):
  nome 2–100 com letra, e-mail válido, mensagem 10–5000.

---

## Pendências / próximos passos

- [ ] **Rotacionar o `EMAIL_API_TOKEN`** — o token usado foi exposto durante o setup;
      criar um novo e atualizar o secret (depois revogar o antigo).
- [ ] **Cloudflare Turnstile** (opcional) — CAPTCHA invisível nativo contra spam/flood
      automatizado, protegendo a cota de 1000 e-mails/dia. Precisa de site key + secret.
- [ ] **Entregabilidade** — se cair em spam, revisar DMARC/SPF/DKIM do domínio.

---

## Teste rápido (produção)

```bash
curl -sS -X POST https://paulgomes.com.br/api/contact \
  -H "Content-Type: application/json" \
  -d '{"name":"Teste","email":"voce@exemplo.com","subject":"Oi","message":"Mensagem de teste com mais de dez caracteres."}'
# Esperado: {"message":"Mensagem enviada ✓ Em breve retorno o contato."}
```
