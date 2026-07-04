---
title: "Claude Fable 5 e Mythos 5: o que a Anthropic lançou e por que muda o jogo"
description: "O modelo mais capaz que a Anthropic já liberou ao público chegou em duas versões. O que é Fable, o que é Mythos, e por que a diferença entre eles é a notícia."
pubDate: 2026-07-03
categorias:
  - IA
  - Em Alta
focusKeyword: "Claude Fable 5"
metaTitle: "Claude Fable 5 e Mythos 5: o que a Anthropic lançou"
metaDescription: "A Anthropic lançou o Fable 5, seu modelo mais capaz já liberado, e o Mythos 5, o mesmo cérebro sem as travas. Entenda o que muda de verdade."
---

Em 9 de junho de 2026, a Anthropic anunciou dois modelos ao mesmo tempo: o Claude Fable 5 e o Claude Mythos 5. A primeira leitura foi tratada pela imprensa como um lançamento único, mais um degrau na escada dos modelos de fronteira. É uma leitura incompleta. O que a Anthropic fez de fato foi separar, pela primeira vez com essa clareza, a capacidade do modelo do que ele tem permissão de fazer. E é nessa separação que mora a história.

## Os dois modelos, em uma frase cada

O **Fable 5** é o modelo mais capaz que a Anthropic já liberou para uso geral. Ele foi construído para raciocínio pesado e para trabalho agêntico de longo horizonte — tarefas que não cabem em uma resposta, e sim em uma sequência longa de passos autônomos. Está disponível na API da Claude, na plataforma na AWS, no Amazon Bedrock, no Google Cloud e no Microsoft Foundry.

O **Mythos 5** é o mesmo modelo. Mesma inteligência, mesmos pesos, mesma capacidade. A diferença é que o Mythos não carrega os classificadores de segurança que o Fable carrega. Ele não é liberado ao público: circula apenas em disponibilidade limitada, dentro do chamado Project Glasswing, para um grupo restrito de defensores cibernéticos e provedores de infraestrutura crítica.

Guarde essa frase, porque ela é o eixo de tudo: **Fable e Mythos são o mesmo cérebro. O que muda é a coleira.**

## Por que isso é diferente de "lançar um modelo maior"

O padrão da indústria, até aqui, foi tratar segurança como uma propriedade interna do modelo — algo treinado dentro dele, inseparável dele. A Anthropic desacoplou isso. A capacidade bruta é uma coisa; a camada de classificadores que decide o que responder é outra, montada por cima.

Isso tem uma consequência prática enorme. Significa admitir, publicamente, que o modelo *sabe* fazer coisas que a versão pública *se recusa* a fazer. Não é que o Fable seja menos inteligente. É que ele foi instruído a desviar certos pedidos. Quando um pedido cai numa área sensível, o Fable não improvisa: ele devolve uma recusa explícita e, na prática, a resposta passa a ser gerada por um modelo anterior, o Opus 4.8. Segundo a própria Anthropic, isso acontece em menos de 5% das sessões.

## Os números que importam

Para quem vai usar, três especificações definem o terreno:

- **Janela de contexto de 1 milhão de tokens**, por padrão. É espaço para segurar bases de código inteiras, contratos longos, arquivos de pesquisa — sem perder o fio.
- **Até 128 mil tokens de saída** por requisição. O modelo pode devolver documentos, refatorações e relatórios longos de uma vez.
- **Preço de US$10 por milhão de tokens de entrada e US$50 por milhão de saída** — menos da metade do que custava o Mythos Preview, o antecessor.

Não são números incrementais. São a diferença entre "dá para experimentar" e "dá para colocar em produção".

## O que eu observo aqui

O lançamento do Fable e do Mythos não é só sobre desempenho. É sobre governança de capacidade — sobre quem decide o que uma inteligência pode fazer, e com base em quê. A Anthropic escolheu tornar essa decisão visível, com dois nomes e duas portas de acesso. É uma honestidade rara no setor, e também uma exposição: ao dar nome ao Mythos, a empresa admitiu em voz alta que existe uma versão sem freios do mesmo modelo.

Como se verá nas semanas seguintes ao lançamento, essa admissão teve preço. Mas antes de chegar lá, vale entender bem a mecânica da diferença entre os dois — é o assunto do próximo texto.

*Fontes: [Anthropic — Claude Fable 5 and Claude Mythos 5](https://www.anthropic.com/news/claude-fable-5-mythos-5); [Claude Platform Docs — Introducing Claude Fable 5 and Claude Mythos 5](https://platform.claude.com/docs/en/about-claude/models/introducing-claude-fable-5-and-claude-mythos-5).*
