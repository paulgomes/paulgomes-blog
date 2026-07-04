---
title: "KV cache: o gargalo de memória que define o custo da inferência"
description: "Por que a memória do KV cache cresce com o contexto e o batching, e como isso vira a conta de custo real da inferência de LLMs em produção."
pubDate: 2026-07-04
categorias:
  - IA
  - DevOps
focusKeyword: "KV cache"
metaTitle: "KV cache: o gargalo que define o custo da inferência"
metaDescription: "Entenda por que o KV cache cresce com o contexto e o batch, e por que ele, não a GPU, define o custo real da inferência de LLMs em produção."
---

Quando um time discute o custo de rodar um modelo de linguagem em produção, a conversa quase sempre vai para o lugar errado. Fala-se de FLOPs, de tamanho do modelo, do preço da GPU por hora. Tudo relevante, nada decisivo. O que de fato governa quanto você paga por token gerado não é a capacidade de cálculo da placa. É a memória. E, dentro da memória, um convidado que cresce sozinho e não pede licença: o KV cache.

Entender o KV cache é entender por que a inferência autoregressiva é cara de um jeito estranho, que não aparece em nenhuma tabela de especificação de hardware. É onde a arquitetura do Transformer encontra a economia de operar o modelo.

## O que o KV cache resolve

O mecanismo de atenção do Transformer, para cada token que gera, olha para todos os tokens anteriores. Ele computa três projeções: query, key e value. A query do token atual é comparada com as keys de todos os tokens já vistos, e o resultado pondera os values correspondentes. Essa é a essência da atenção.

O problema surge na geração autoregressiva. O modelo produz um token de cada vez, e cada novo token precisa atender a toda a sequência anterior. Sem otimização, a cada passo você recalcularia as keys e os values de todos os tokens já gerados. Isso é trabalho redundante gigantesco: a key e o value de um token não mudam depois que ele foi processado.

O KV cache é a resposta óbvia. Você calcula key e value de cada token uma única vez e guarda na memória da GPU. No passo seguinte, só processa o token novo e lê o resto do cache. A conta de compute por passo despenca. Em troca, você assume um passivo: manter em memória, o tempo todo, as keys e os values de cada token de cada camada de cada requisição ativa.

Foi essa troca que transformou a inferência de LLM de um problema de compute em um problema de memória.

## Por que a memória cresce com o contexto

O tamanho do KV cache é linear no número de tokens. Cada token novo no contexto adiciona um bloco de key e value, por camada, ao cache. Dobrar o contexto dobra o cache. Vale contrastar com o compute da própria atenção, que é quadrático no comprimento da sequência: atender a todos os anteriores custa mais a cada token adicionado. A memória do cache, essa, cresce de forma linear e acumulada, e é justamente essa linearidade que vai corroendo a capacidade de servir.

Vale explicitar de onde vem o volume. O cache guarda, para cada token, dois tensores (key e value), em cada camada do modelo, para cada cabeça de atenção, com a dimensão interna daquela cabeça. Multiplique: número de tokens vezes número de camadas vezes número de cabeças vezes dimensão por cabeça vezes dois, vezes o número de bytes por elemento. Modelos grandes têm dezenas de camadas e muitas cabeças. O produto explode rápido.

O detalhe que engana muita gente: esse cache existe por requisição. Não é um custo fixo do modelo. É um custo que se multiplica por quantas conversas simultâneas você mantém vivas. E aqui entra o batching.

## O batching e a conta que não fecha

Servir LLM em produção é um exercício de amortização. Os pesos do modelo ocupam a maior parte da VRAM e são fixos. Para diluir esse custo, você quer processar muitas requisições ao mesmo tempo, no mesmo lote. Quanto maior o batch, mais tokens por segundo você extrai da mesma placa, e mais barato fica cada token.

Só que cada requisição no batch traz seu próprio KV cache. E o cache de cada uma cresce enquanto a geração continua. Você está somando passivos de memória que incham ao longo do tempo. A memória disponível para caches é o que sobra depois dos pesos, e ela é finita. Existe, portanto, um teto de quantas sequências você consegue manter vivas simultaneamente. Esse teto é o seu batch máximo real, e ele não é ditado pelo compute da GPU. É ditado pelo espaço que o KV cache ocupa.

O resultado é uma tensão permanente. Você quer batch grande para amortizar os pesos e maximizar throughput. Mas contexto longo por requisição encolhe quantas requisições cabem. Um punhado de conversas com contexto enorme pode saturar a mesma placa que serviria centenas de conversas curtas. Duas cargas com o mesmo número de requisições por segundo podem ter custos radicalmente diferentes só pela distribuição de comprimento de contexto.

## Prefill e decode não custam a mesma coisa

Há ainda uma assimetria que separa as duas fases da inferência. No prefill, o modelo processa o prompt inteiro de uma vez e popula o cache. Essa fase tende a ser limitada por compute: há muito cálculo em paralelo, a GPU trabalha perto do pico. No decode, gerando token a token, o gargalo vira a memória. A cada passo o modelo lê todo o KV cache para produzir um único token. Pouco cálculo, muita leitura de memória.

Por isso a fase de geração é frequentemente limitada por largura de banda de memória, não por FLOPs. A placa passa mais tempo movendo o cache de lá para cá do que de fato calculando. Isso explica um fenômeno que confunde quem olha só o preço de tabela: prompts longos com respostas curtas têm um perfil de custo, respostas longas sobre prompts curtos têm outro, e a mesma infraestrutura entrega números de throughput completamente diferentes conforme essa proporção muda.

## O que a indústria fez a respeito

O KV cache virou o alvo principal da engenharia de inferência moderna, e vale reconhecer as direções de ataque sem inventar números.

A primeira é reduzir o volume na origem, mudando a arquitetura da atenção. Compartilhar keys e values entre grupos de cabeças, em vez de manter um conjunto por cabeça, corta o tamanho do cache proporcionalmente ao fator de compartilhamento. Essa é a razão prática por trás de variantes de atenção com menos cabeças de key e value: pouca qualidade sacrificada, muito menos cache.

A segunda é usar menos bits por elemento. Quantizar o cache para precisão mais baixa reduz linearmente o espaço ocupado, ao custo de alguma degradação numérica que precisa ser controlada.

A terceira é a gestão de memória em si. Alocar o cache em blocos, em vez de reservar um espaço contíguo máximo por requisição, reduz a fragmentação e o desperdício de memória reservada e não usada. Essa ideia, de tratar o cache como páginas gerenciadas em vez de um bloco monolítico, foi o que destravou ganhos grandes de throughput na geração recente de servidores de inferência. É também o que permite compartilhar prefixos de cache entre requisições que começam com o mesmo prompt de sistema, evitando recomputar e rearmazenar o que é idêntico.

Nenhuma dessas técnicas elimina o problema. Todas o adiam ou o comprimem. O passivo linear continua lá.

## Por que isso é a conta de custo

Junte as peças. O custo por token em produção é, no fundo, o custo de manter os pesos amortizados dividido pelo número de tokens que você consegue gerar por unidade de tempo naquela placa. O numerador é razoavelmente fixo. O denominador depende de quantas requisições você empacota e de quanto contexto cada uma arrasta. E os dois são limitados pelo KV cache.

É por isso que o preço cobrado por tokens de entrada e de saída costuma diferir, e por isso que contexto longo pesa. Tokens de entrada passam pelo prefill, denso em compute. Tokens de saída passam pelo decode, denso em memória, e cada token de saída adicional incha o cache que precisa ser lido em todos os passos seguintes daquela requisição. Contexto que fica vivo entre turnos de uma conversa é cache que permanece ocupando espaço que poderia servir outra pessoa. O cache de prefixo compartilhado e o caching de prompt existem exatamente para monetizar essa reutilização.

O gargalo, no fim, não é filosófico. É o espaço em bytes que sobra na placa depois dos pesos, dividido pelo apetite de memória de cada conversa ativa.

## Minha posição

Continuamos raciocinando sobre custo de IA com a intuição errada, herdada da era em que compute era o recurso escasso. Compramos GPU por TFLOPs e depois descobrimos, em produção, que a métrica que importava era largura de banda e capacidade de memória. O KV cache é o lugar onde essa mudança de regime fica visível.

A consequência prática é clara: quem projeta produtos sobre LLM precisa tratar comprimento de contexto como uma variável de custo de primeira ordem, não como um detalhe de qualidade. Cada mil tokens de contexto que você mantém vivo tem um preço de oportunidade em requisições que a placa deixou de servir. Janelas de contexto gigantes são um recurso de marketing sedutor e uma armadilha operacional quando usadas sem disciplina. A pergunta certa em arquitetura de produto raramente é "cabe no contexto". É "quanto cache isso me custa manter, multiplicado por todos os usuários ao mesmo tempo". Quem internalizar essa conta vai operar IA com margem. Quem ignorar vai pagar a fatura sem entender de onde ela veio.
