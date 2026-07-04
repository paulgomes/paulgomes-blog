---
title: "Adaptive thinking, refusals e fallback: o que muda na API do Fable 5"
description: "Quem integra o Fable 5 encontra três comportamentos novos: pensamento adaptativo sempre ligado, recusas como resposta de sucesso e um fluxo de fallback obrigatório."
pubDate: 2026-07-03
categorias:
  - DevOps
  - IA
focusKeyword: "API Fable 5"
metaTitle: "API do Fable 5: adaptive thinking, refusals e fallback"
metaDescription: "O que muda ao integrar o Fable 5 pela API: adaptive thinking sempre ligado, refusals como HTTP 200 e o fluxo de fallback e cobrança que você precisa tratar."
---

O lançamento do Fable 5 vendeu capacidade. Mas quem coloca a mão no código descobre que a API mudou de comportamento em pontos que não aparecem no material de marketing — e que quebram integrações escritas para modelos anteriores se você não estiver atento. Este é o texto que eu queria ter lido antes de trocar o modelo em produção.

## 1. Adaptive thinking está sempre ligado

No Fable 5 e no Mythos 5, o **adaptive thinking é o único modo de raciocínio**. Ele se aplica sempre que você não define o parâmetro `thinking`. E há uma consequência dura para quem migra: **`thinking: {"type": "disabled"}` não é suportado.** Não dá para "desligar o pensamento" como em modelos anteriores.

Se o seu código assumia que podia forçar o modo sem raciocínio para economizar latência ou custo, esse código precisa mudar. O que você controla agora é a *profundidade* do raciocínio, pelo parâmetro de **effort** — não a existência dele.

## 2. O raciocínio bruto nunca volta

Outra mudança para quem depurava lendo a cadeia de pensamento: no Fable 5, o **raciocínio bruto nunca é devolvido**. Você escolhe entre dois comportamentos:

- `"summarized"` — os blocos de pensamento vêm com um resumo legível do raciocínio.
- `"omitted"` — o padrão — os blocos vêm com o campo de pensamento vazio.

E uma regra de ouro para conversas multi-turno: **devolva os blocos de pensamento sem alterá-los**, no mesmo modelo. Mexer neles quebra a continuidade do raciocínio entre turnos.

## 3. Refusals: sucesso que nega

Este é o que mais pega gente desprevenida. O Fable 5 tem classificadores de segurança que podem recusar um pedido. Quando isso acontece, a API **não retorna erro**. Retorna um **HTTP 200 bem-sucedido**, com `stop_reason: "refusal"`, informando qual classificador barrou.

Do ponto de vista do seu código, a chamada deu certo — só que não veio conteúdo. Se o seu tratamento de erros só olha para status HTTP, ele vai considerar a recusa um sucesso silencioso e seguir com uma resposta vazia. Trate `refusal` como um estado de primeira classe. (O Mythos 5 não tem esses classificadores, então isso não se aplica a ele.)

## 4. Fallback: os três caminhos

Um pedido que o Fable recusa geralmente pode ser atendido por outro modelo Claude. Há três formas de fazer o retry:

- **Servidor:** passe o parâmetro `fallbacks` e deixe a API tentar sozinha (em beta na Claude API e na plataforma na AWS).
- **Cliente:** use o middleware do SDK (TypeScript, Python, Go, Java, C#) para reencaminhar do lado do cliente, em qualquer plataforma.
- **Manual:** implemente o retry você mesmo, em qualquer linguagem.

Escolher entre eles é uma decisão de arquitetura: fallback no servidor é o mais simples de manter; no cliente, o mais portável; manual, o mais controlável.

## 5. Cobrança: as duas regras que salvam a conta

Por fim, o que ninguém quer descobrir na fatura. Duas regras específicas do Fable 5:

- Você **não é cobrado** por um pedido recusado antes de gerar qualquer saída.
- Quando você faz o retry em outro modelo, um **crédito de fallback** devolve o custo de cache do prompt — para você não pagar duas vezes pela troca.

Detalhe operacional adicional: Fable 5 e Mythos 5 têm retenção de dados de 30 dias e são classificados como Covered Models — não há opção de retenção zero. Se a sua política de dados exige retenção zero, isso é um bloqueio de conformidade a resolver antes de subir para produção.

## Minha posição

O Fable 5 é mais capaz, mais barato e mais rápido de acordar do que os modelos anteriores. Mas ele não é um drop-in silencioso: trocar o nome do modelo na sua chamada e esperar que tudo funcione é receita para bug sutil em produção. Adaptive thinking obrigatório, refusals como sucesso e o fluxo de fallback são contratos novos. Integração boa lê o contrato antes de assinar. Faça o dever de casa da API antes de celebrar o benchmark.

*Fontes: [Claude Platform Docs — Introducing Claude Fable 5 and Claude Mythos 5](https://platform.claude.com/docs/en/about-claude/models/introducing-claude-fable-5-and-claude-mythos-5).*
