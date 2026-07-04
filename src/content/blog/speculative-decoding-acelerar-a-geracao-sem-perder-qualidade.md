---
title: "Speculative decoding: acelerar a geração sem perder qualidade"
description: "Como o speculative decoding acelera a geração de LLMs: um rascunhador propõe tokens e o modelo grande verifica, sem alterar a distribuição de saída."
pubDate: 2026-07-04
categorias:
  - IA
  - DevOps
focusKeyword: "speculative decoding"
metaTitle: "Speculative decoding: velocidade sem perder qualidade"
metaDescription: "Um modelo rascunhador propõe, o grande verifica. Entenda o speculative decoding: mais velocidade na geração de LLMs sem mudar a saída."
---

A geração de texto em um Transformer tem um gargalo que nenhuma quantidade de GPU resolve por força bruta: ela é sequencial. Cada token depende do anterior, então o modelo precisa de uma passada completa pela rede para produzir uma única palavra. Você tem bilhões de parâmetros ociosos esperando o resultado de um único passo para começar o próximo. É o pior tipo de subutilização: hardware caríssimo travado pela dependência de dados, não pela falta de capacidade de cálculo.

O speculative decoding ataca exatamente esse ponto. E o faz com uma ideia que, na primeira leitura, parece boa demais para ser verdade: usar um modelo pequeno e barato para adivinhar vários tokens de uma vez, e um modelo grande para conferir todos eles em paralelo. O ganho de velocidade é real e mensurável. E, o detalhe que separa isso de um truque qualquer, a saída final é estatisticamente idêntica à que o modelo grande produziria sozinho.

## Por que a geração autorregressiva é lenta

Vale entender onde o tempo se perde. Gerar um token com um modelo grande é, na prática, uma operação limitada por memória (*memory-bound*), não por processamento. O grosso do custo não está nas multiplicações de matriz em si, mas em carregar os pesos do modelo da memória para os núcleos de cálculo. Uma passada para um token move gigabytes de parâmetros. Uma passada para processar dez tokens de entrada em paralelo move os mesmos gigabytes — o custo de leitura dos pesos é praticamente o mesmo.

Aí está a assimetria que o speculative decoding explora. Verificar dez tokens de uma vez custa quase o mesmo que gerar um. Processar um prompt (a fase de *prefill*) é rápido justamente porque acontece em paralelo. A lentidão é da fase de *decode*, token a token, onde essa capacidade de paralelismo fica parada. Se houvesse um jeito de dar ao modelo grande vários tokens candidatos para avaliar de uma só vez, o hardware voltaria a trabalhar no regime em que é eficiente.

## O rascunhador propõe, o verificador decide

O mecanismo tem duas peças. Um modelo rascunhador (*draft model*), pequeno e rápido, e o modelo alvo (*target model*), grande e caro — aquele cuja qualidade você quer preservar. O rascunhador gera uma sequência curta de tokens candidatos de forma autorregressiva, como faria qualquer modelo. Digamos que ele proponha cinco tokens à frente. Como é pequeno, faz isso rápido.

Em seguida, o modelo grande recebe esses cinco candidatos e os processa **em uma única passada paralela**. Numa só chamada, ele calcula as distribuições de probabilidade que teria produzido em cada uma daquelas posições. É a mesma passada que ele daria para avaliar um prompt de cinco tokens — barata em termos relativos, porque paga a leitura dos pesos uma vez só.

Agora vem a parte que garante a correção. Para cada token proposto, compara-se a probabilidade que o rascunhador atribuiu àquele token com a probabilidade que o modelo grande atribui ao mesmo token. Se o modelo grande concorda — se ele daria àquele token uma probabilidade igual ou maior —, o token é aceito. Se discorda, entra um passo de rejeição probabilística: o token é aceito com probabilidade igual à razão entre a probabilidade do modelo grande e a do rascunhador, e, quando rejeitado, o modelo grande amostra um substituto a partir de uma distribuição corrigida — a diferença entre as duas, renormalizada. A aceitação percorre a sequência do começo ao fim e para no primeiro token rejeitado. Tudo depois dele é descartado.

## Por que a distribuição de saída não muda

Esse é o ponto que costuma ser mal contado por aí, então vale ser preciso. O speculative decoding não é uma aproximação. Não é "quase igual" nem "bom o suficiente". A regra de aceitação-rejeição é construída de forma que a distribuição final dos tokens aceitos seja matematicamente idêntica à distribuição do modelo alvo. É um caso de amostragem por rejeição: o rascunhador funciona como uma distribuição-proposta, e o critério de aceitação corrige qualquer viés que ele introduza.

Traduzindo o que isso significa na prática: se você amostrasse do modelo grande sozinho e amostrasse com o esquema especulativo, com a mesma temperatura, os tokens viriam da mesma distribuição de probabilidade nas duas rotas. O rascunhador nunca tem a palavra final. Ele só sugere. Quando acerta a sugestão, você economizou tempo. Quando erra, o modelo grande corrige de graça — porque a passada de verificação já produziu a distribuição correta naquela posição, e o token substituto sai dali.

Essa é a elegância do método. O rascunhador ruim não degrada a qualidade — ele apenas é ineficiente, porque suas propostas são rejeitadas com mais frequência. A qualidade vem inteiramente do modelo grande; a velocidade vem do rascunhador. As duas coisas estão desacopladas.

## De onde vem o ganho — e onde ele evapora

O ganho depende de uma quantidade só: a taxa de aceitação. Quantos dos tokens propostos, em média, sobrevivem à verificação. Se o rascunhador acerta a maior parte das sugestões, cada passada cara do modelo grande rende vários tokens em vez de um. Se ele erra quase tudo, você paga a passada de verificação e ainda arca com o custo de rodar o rascunhador, sem retorno.

Por isso a escolha do rascunhador é o coração da engenharia. Ele precisa ser barato o bastante para que gerar candidatos seja quase gratuito, e alinhado o bastante com o modelo grande para que os candidatos sejam aceitos. Existe uma tensão aqui: um rascunhador maior acerta mais, mas custa mais por token proposto. O ponto ótimo varia com o modelo alvo, com o tipo de texto e até com o trecho específico sendo gerado.

E há uma dependência que raramente se comenta: **o conteúdo importa**. Texto previsível — código com boilerplate, formatação repetitiva, continuações óbvias — tem taxa de aceitação alta, e o método voa. Texto de alta entropia, onde cada token é uma decisão genuína e o modelo grande hesita entre muitas opções, derruba a aceitação. O speculative decoding não acelera uniformemente; ele acelera as partes fáceis da geração, que por acaso são boa parte do que os modelos produzem no dia a dia.

## Variações sobre o mesmo tema

A ideia central gerou uma família de técnicas. Uma direção elimina o modelo rascunhador separado e faz o próprio modelo grande propor múltiplos tokens à frente, usando cabeças de predição adicionais treinadas para isso — evitando a complexidade de manter e servir dois modelos. Outra troca a sequência linear de candidatos por uma árvore de propostas: em vez de apostar em um único caminho de cinco tokens, o esquema propõe várias ramificações e verifica todas na mesma passada, com máscaras de atenção que mantêm os ramos independentes. Isso eleva a chance de que ao menos um caminho longo seja aceito.

O que todas essas variações preservam é o contrato fundamental: a etapa de verificação garante que a saída venha da distribuição do modelo alvo. Muda-se como os candidatos são propostos e como são organizados. Não se mexe na garantia de correção. É isso que permite tratar o speculative decoding como uma otimização de infraestrutura, e não como um novo modelo com comportamento próprio a ser reavaliado.

## Minha posição

O speculative decoding é o tipo de avanço que eu mais respeito em engenharia de IA: ele não pede que você aceite um *trade-off*. A conversa usual sobre eficiência em LLM é uma negociação — quantização, poda, destilação, todas trocam um naco de qualidade por velocidade ou custo, e você fica administrando a perda. Aqui não há perda a administrar. A saída vem da mesma distribuição. O que se otimiza é o uso do hardware, e só.

Para quem toma decisões de produto e infraestrutura, isso muda o enquadramento. Speculative decoding não é uma escolha de qualidade — é uma escolha de latência e custo que você pode ligar sem auditar o comportamento do modelo depois. O risco não está na saída; está na engenharia de servir dois modelos, calibrar o rascunhador e lidar com o fato de que o ganho é irregular ao longo do texto. É trabalho de plataforma, não de pesquisa de modelo.

A lição mais ampla é que ainda há muita margem escondida na forma como executamos os modelos que já temos, antes de precisar de modelos maiores. O gargalo da geração autorregressiva parecia uma lei da natureza. Não era. Era uma suposição de que cada token exige uma passada, e essa suposição caiu no momento em que alguém percebeu que verificar é mais barato que gerar. Aposto que há outras suposições parecidas ainda de pé, esperando o mesmo tipo de olhar.
