---
title: "1 milhão de tokens: o que o Fable 5 faz com uma janela de contexto gigante"
description: "Janela de 1 milhão de tokens e até 128 mil de saída. Mais importante do que o tamanho é o que a Anthropic afirma sobre manter o foco ao longo dela."
pubDate: 2026-07-03
categorias:
  - IA
  - Tecnologia
focusKeyword: "1 milhão de tokens Fable 5"
metaTitle: "1 milhão de tokens: o contexto gigante do Fable 5"
metaDescription: "Fable 5 tem janela de 1 milhão de tokens e 128 mil de saída. Entenda o que muda quando o modelo mantém o foco ao longo de contexto enorme."
---

Toda geração de modelos tem uma especificação que vira slogan. Nesta, é a **janela de contexto de 1 milhão de tokens**. O número é grande o bastante para impressionar e vago o bastante para não significar nada — se a gente não entender o que ele realmente destrava. E o ponto interessante do Fable 5 não é o tamanho da janela. É o que a Anthropic afirma sobre o que o modelo faz *dentro* dela.

## Os números, sem mística

O Fable 5 e o Mythos 5 trazem, por padrão:

- **1 milhão de tokens de contexto** — o espaço total que o modelo consegue "ver" de uma vez, somando o que você envia e o que ele já gerou na conversa.
- **Até 128 mil tokens de saída** por requisição — o tamanho máximo de uma única resposta.

Para dar escala: 1 milhão de tokens é da ordem de milhares de páginas de texto. Cabe um repositório de código inteiro, um contrato com todos os anexos, meses de histórico de uma conversa, uma pilha de artigos de pesquisa. Tudo simultaneamente disponível para o modelo.

## O problema que tamanho, sozinho, não resolve

Aqui está a parte que a maioria dos textos pula. Janela grande não é novidade absoluta, e nunca foi garantia de nada. O problema clássico dos contextos longos é a **perda de foco**: você enche a janela, e o modelo passa a "esquecer" o meio, a se prender ao começo e ao fim, a diluir a atenção. Um modelo com janela de 1 milhão que se perde aos 200 mil tokens é, na prática, um modelo de 200 mil.

Por isso a afirmação relevante do lançamento não é o tamanho. É esta: o Fable 5 **"mantém o foco ao longo de milhões de tokens em tarefas de longa duração"**. Se isso se sustentar no uso real, é a diferença entre uma janela que é vitrine e uma janela que é ferramenta.

## Onde isso muda o trabalho de verdade

Contexto longo com foco preservado destrava classes inteiras de tarefa que antes eram inviáveis:

- **Código:** refatorar coerentemente um sistema que se espalha por dezenas de arquivos, sem que o modelo perca de vista as dependências do outro extremo do projeto.
- **Jurídico e contratos:** analisar um documento longo cruzando cláusulas distantes entre si — a cláusula 3 contradiz a 47? — sem picotar o texto.
- **Pesquisa:** sintetizar dezenas de fontes de uma vez, mantendo rastreável de onde veio cada afirmação.
- **Agentes de longo horizonte:** executar uma missão de muitos passos sem esquecer, no passo 40, qual era o objetivo declarado no passo 1.

É esse último ponto que conecta a janela ao propósito declarado do Fable: trabalho agêntico de longa duração. Um agente que perde o foco no meio da tarefa não é autônomo — é um gerador de retrabalho. A janela grande com foco é o que torna a autonomia longa possível.

## O custo que vem junto

Vale o lembrete econômico. Encher a janela custa — entrada é cobrada por token, a US$10 por milhão. Mil páginas de contexto não são de graça. A boa notícia é que a entrada é cinco vezes mais barata que a saída, então a estratégia esperta é ser generoso no contexto e disciplinado na resposta. Contexto amplo, saída enxuta.

## Minha posição

O número de 1 milhão de tokens vai estampar todo material de marketing sobre o Fable 5. Ignore o número; observe o comportamento. A pergunta certa não é "quão grande é a janela", e sim "o modelo continua afiado no token 900 mil como estava no token mil?". Se a resposta for sim — e a Anthropic aposta que sim —, o que mudou não foi a memória do modelo. Foi a ambição das tarefas que faz sentido entregar a ele.

*Fontes: [Claude Platform Docs — Introducing Claude Fable 5 and Claude Mythos 5](https://platform.claude.com/docs/en/about-claude/models/introducing-claude-fable-5-and-claude-mythos-5); [Anthropic — Claude Fable 5 and Claude Mythos 5](https://www.anthropic.com/news/claude-fable-5-mythos-5).*
