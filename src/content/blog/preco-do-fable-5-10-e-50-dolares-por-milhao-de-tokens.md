---
title: "Preço do Fable 5: US$10 e US$50 por milhão de tokens e o que isso muda"
description: "O modelo mais capaz da Anthropic custa menos da metade do que custava seu antecessor. A queda de preço não é detalhe — é a notícia econômica do lançamento."
pubDate: 2026-07-03
categorias:
  - Negócios
  - IA
focusKeyword: "preço Fable 5"
metaTitle: "Fable 5: quanto custa por milhão de tokens"
metaDescription: "Fable 5 custa US$10 por milhão de tokens de entrada e US$50 de saída — menos da metade do Mythos Preview. O que a queda de preço muda para o negócio."
---

Todo lançamento de modelo vem com uma tabela de benchmarks. Poucos vêm com a informação que realmente decide se aquilo entra no seu produto: o preço. No caso do Fable 5, o número é surpreendente por descer, não subir. O modelo mais capaz que a Anthropic já liberou custa **menos da metade** do que custava seu antecessor. Isso muda o cálculo de qualquer projeto de IA.

## Os números

O Fable 5 e o Mythos 5 têm o mesmo preço:

- **US$10 por milhão de tokens de entrada.**
- **US$50 por milhão de tokens de saída.**

Para referência, isso é descrito pela Anthropic como menos da metade do preço do Mythos Preview, o modelo classe Mythos anterior. Um modelo mais forte, mais barato. A direção da curva importa tanto quanto o valor absoluto.

## Por que entrada e saída têm preços diferentes

Quem está chegando agora estranha os dois números. A lógica é simples: **entrada** é tudo que você manda para o modelo (seu prompt, o contexto, os documentos anexados); **saída** é tudo que ele gera de volta. Gerar custa mais do que ler — por isso a saída é cinco vezes mais cara que a entrada.

Isso tem uma consequência de design que muita gente ignora. Encher o modelo de contexto é relativamente barato. O que pesa na conta é pedir respostas longas. Um sistema bem desenhado aproveita a janela gigante de 1 milhão de tokens na entrada e é econômico na saída — respostas objetivas, estruturadas, sem prolixidade. Verbosidade, no Fable 5, é literalmente dinheiro queimado.

## O detalhe da cobrança que salva orçamento

Há uma regra específica do Fable 5 que merece atenção de quem vai colocá-lo em produção. Como o Fable pode **recusar** pedidos em áreas sensíveis, a Anthropic definiu que **você não paga por um pedido recusado antes de gerar qualquer saída**. E, quando você reencaminha esse pedido para outro modelo (o fallback), um crédito devolve o custo de cache do prompt — para você não pagar duas vezes pela mesma troca.

Parece minúcia contábil. Não é. Em escala, com milhões de chamadas, essas regras são a diferença entre uma conta previsível e um vazamento silencioso de custo.

## O que a queda de preço realmente sinaliza

Preço em IA não é só preço. É sinal de estratégia. Quando o modelo de fronteira fica mais barato a cada geração, a mensagem para o mercado é: *a inteligência está deixando de ser o gargalo, e o gargalo passa a ser o que você constrói em volta dela.*

Enquanto o custo por token cai, o valor migra para outro lugar — para a qualidade do produto, para a experiência, para os dados proprietários, para a distribuição. O modelo vira commodity de alta performance. Quem apostava que a vantagem competitiva estava em "ter acesso ao melhor modelo" descobre que todo mundo tem, e mais barato a cada trimestre.

## Minha posição

Para quem toma decisão de negócio, a leitura é direta: pare de tratar o modelo como o produto. Ele é insumo, e insumo barateando. A vantagem defensável não está no acesso à inteligência — está no que só a sua empresa sabe, tem ou faz em volta dela. O Fable 5 não deixou a IA mais cara. Deixou a desculpa de "é caro demais" mais difícil de sustentar.

*Fontes: [Claude Platform Docs — Introducing Claude Fable 5 and Claude Mythos 5](https://platform.claude.com/docs/en/about-claude/models/introducing-claude-fable-5-and-claude-mythos-5); [Anthropic — Claude Fable 5 and Claude Mythos 5](https://www.anthropic.com/news/claude-fable-5-mythos-5).*
