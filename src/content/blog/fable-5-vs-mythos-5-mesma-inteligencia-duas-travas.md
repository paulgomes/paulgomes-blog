---
title: "Fable 5 vs. Mythos 5: a mesma inteligência, dois níveis de trava"
description: "Fable e Mythos compartilham os mesmos pesos. A diferença está nos classificadores de segurança — e é essa camada, e não a inteligência, que separa os dois."
pubDate: 2026-07-03
categorias:
  - IA
  - Tecnologia
focusKeyword: "Fable 5 vs Mythos 5"
metaTitle: "Fable 5 vs. Mythos 5: mesma inteligência, duas travas"
metaDescription: "Fable e Mythos são o mesmo modelo. A diferença são os classificadores de segurança do Fable. Entenda refusals, fallback e o que isso muda na prática."
---

A pergunta que mais aparece desde o lançamento é a mais direta: qual dos dois é melhor? A resposta desmonta a pergunta. Nenhum é melhor, porque são o mesmo modelo. O Fable 5 e o Mythos 5 compartilham os mesmos pesos e a mesma capacidade. O que os separa não é inteligência — é uma camada de decisão montada sobre o Fable.

## A camada que faz a diferença

O Fable 5 inclui **classificadores de segurança**: componentes que avaliam o pedido antes de deixar o modelo responder e podem recusá-lo. O Mythos 5 não os inclui. Só isso. Toda a diferença de comportamento entre os dois nasce dessa camada.

Na prática, os classificadores do Fable cobrem três domínios onde o risco de uso indevido é considerado alto:

1. **Cibersegurança** — pedidos ligados a descobrir e explorar vulnerabilidades de software.
2. **Biologia e química** — pedidos ligados a armas biológicas e pesquisa de uso duplo.
3. **Destilação** — tentativas de extrair a capacidade do modelo para treinar concorrentes.

Quando um pedido cai numa dessas áreas, o Fable não tenta contornar nem inventa uma meia-resposta. Ele recusa de forma explícita.

## O que "recusa" significa para quem integra

Aqui está o detalhe de engenharia que muita gente vai descobrir do jeito difícil. Quando o Fable 5 recusa, a API **não retorna um erro**. Retorna um HTTP 200, bem-sucedido, com `stop_reason: "refusal"` — e informa qual classificador barrou o pedido. Ou seja: do ponto de vista do código, a chamada deu certo; o conteúdo é que foi negado.

Isso obriga quem integra a tratar três coisas novas:

- **Recusas** como um estado válido de resposta, não como falha.
- **Fallback**: reencaminhar o pedido recusado para outro modelo Claude. Há três caminhos — do lado do servidor (a própria API tenta de novo, em beta), do lado do cliente (via middleware do SDK) ou manual.
- **Cobrança**: você **não é cobrado** por um pedido recusado antes de gerar qualquer saída. E quando faz o retry em outro modelo, um crédito de fallback devolve o custo de cache do prompt, para você não pagar duas vezes pela troca.

Detalhe importante: quando o Fable recusa, quem costuma assumir a resposta é o Opus 4.8, o modelo anterior. Segundo a Anthropic, isso ocorre em menos de 5% das sessões. Para a esmagadora maioria dos usos legítimos, a coleira é invisível.

## Por que o Mythos existe

Se o Fable resolve 95% dos casos sem atrito, por que manter uma versão sem classificadores? Porque nos 5% restantes mora um problema real: um defensor cibernético tentando entender como um atacante exploraria a própria infraestrutura precisa exatamente da capacidade que o classificador bloqueia. A trava que protege contra o abuso também atrapalha a defesa legítima.

O Mythos 5 é a resposta para esse dilema: o mesmo poder, sem os classificadores, entregue apenas a um grupo aprovado, sob o guarda-chuva do Project Glasswing. É uma aposta de que dá para separar quem usa para defender de quem usaria para atacar — controlando o acesso, e não a capacidade.

## Minha leitura

O par Fable/Mythos é a materialização de uma tese: a de que segurança em IA não é só o que o modelo sabe, mas o que ele tem permissão de fazer, e para quem. É uma abordagem madura. Também é frágil, porque transfere o peso da segurança da capacidade para o controle de acesso — e controle de acesso, como toda a história da cibersegurança mostra, é exatamente a parte que falha. O capítulo seguinte dessa história, aliás, veio rápido, e não foi a Anthropic quem escreveu.

*Fontes: [Claude Platform Docs — Introducing Claude Fable 5 and Claude Mythos 5](https://platform.claude.com/docs/en/about-claude/models/introducing-claude-fable-5-and-claude-mythos-5); [Anthropic — Claude Fable 5 and Claude Mythos 5](https://www.anthropic.com/news/claude-fable-5-mythos-5).*
