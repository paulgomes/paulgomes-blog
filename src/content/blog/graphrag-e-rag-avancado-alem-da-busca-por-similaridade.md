---
title: "GraphRAG e RAG avançado: além da busca por similaridade"
description: "Por que RAG baseado só em similaridade falha em perguntas complexas — e como GraphRAG, reranking e recuperação multi-hop resolvem isso."
pubDate: 2026-07-04
categorias:
  - IA
  - DevOps
focusKeyword: "GraphRAG"
metaTitle: "GraphRAG e RAG avançado: além da similaridade"
metaDescription: "GraphRAG, reranking e recuperação multi-hop: por que a busca por similaridade não basta e como estruturar recuperação para perguntas complexas."
---

A maioria dos sistemas de RAG em produção resolve o problema errado com muita competência. Eles são ótimos em achar o parágrafo mais parecido com a pergunta. O problema é que uma quantidade enorme de perguntas úteis não tem resposta em nenhum parágrafo isolado — a resposta está na relação entre trechos que nunca se parecem entre si. É aí que a busca por similaridade, sozinha, para de funcionar, e é aí que entra a conversa sobre GraphRAG e recuperação avançada.

## O que a similaridade realmente mede

O RAG clássico funciona assim: você quebra os documentos em pedaços, gera um vetor (embedding) para cada pedaço, guarda tudo num índice vetorial e, na hora da pergunta, transforma a pergunta em vetor e busca os pedaços mais próximos por similaridade de cosseno. Simples, barato, e surpreendentemente forte para uma classe inteira de perguntas: "o que a política de reembolso diz sobre prazo?", "qual a dosagem recomendada?". Perguntas cuja resposta mora, inteira, num único trecho.

O detalhe é entender o que o embedding otimiza. Ele aproxima textos que são *semanticamente parecidos* — que falam do mesmo assunto, com vocabulário próximo. Isso não é a mesma coisa que aproximar textos que, juntos, *respondem* à pergunta. São dois objetivos diferentes, e a maior parte das falhas silenciosas de RAG vem de confundir os dois.

Considere a pergunta: "quais fornecedores da nossa unidade de São Paulo também aparecem como clientes de um concorrente que foi adquirido em 2023?" Não existe um parágrafo com essa resposta. Existe um trecho sobre fornecedores da unidade, outro sobre a carteira de clientes de um concorrente, e um terceiro, numa nota de rodapé qualquer, sobre a aquisição. Nenhum deles é *parecido* com a pergunta inteira. A similaridade vai trazer, na melhor das hipóteses, um dos três, e o modelo vai alucinar o resto com toda a confiança do mundo.

## O problema é a topologia, não o modelo

A tentação, quando o RAG erra, é trocar o modelo de embedding ou aumentar o número de trechos recuperados (o famoso *top-k*). Isso ajuda na margem e mascara o diagnóstico. O problema não é que o embedding é ruim; é que a informação relevante está distribuída num grafo de relações, e você está tratando o corpus como um saco de vetores independentes.

Perguntas assim — que exigem juntar fatos de fontes diferentes através de uma cadeia de relações — são chamadas de multi-hop. Cada "hop" é um salto de um fato para outro por meio de uma ligação: fornecedor → unidade → concorrente → aquisição. A busca vetorial não tem noção de ligação. Ela mede proximidade no espaço semântico, não conectividade num grafo de fatos. Aumentar o top-k para 50 não cria os saltos; só entope o contexto com ruído e piora o sinal que o modelo precisa isolar.

## GraphRAG: recuperar sobre estrutura, não sobre distância

A ideia central do GraphRAG é construir, a partir do corpus, um grafo de conhecimento explícito: nós são entidades (pessoas, empresas, produtos, conceitos) e arestas são as relações entre elas (fornece, adquiriu, pertence a, contradiz). Esse grafo normalmente é extraído com o próprio LLM, que lê os trechos e emite triplas do tipo entidade–relação–entidade, depois consolidadas para unificar menções à mesma entidade escrita de formas diferentes.

Com o grafo no lugar, a recuperação muda de natureza. Em vez de perguntar "quais trechos são parecidos com a pergunta?", você pergunta "quais entidades a pergunta menciona, e o que está conectado a elas a um, dois, três saltos de distância?". A resposta passa a ser um *subgrafo* — um recorte conectado do conhecimento — em vez de uma lista solta de parágrafos. O multi-hop, que era impossível por similaridade, vira uma travessia natural de arestas.

Há um segundo movimento que costuma acompanhar o GraphRAG e que resolve o outro fim do espectro: perguntas globais. "Quais são os grandes temas de risco que atravessam todos os nossos contratos?" não tem resposta local nenhuma — a resposta é uma síntese sobre o corpus inteiro. A abordagem aqui é agrupar o grafo em comunidades de entidades densamente conectadas, resumir cada comunidade de forma hierárquica e responder a partir desses resumos. Você deixa de caçar o trecho certo e passa a navegar uma estrutura que já organizou o corpus por tema.

## Reranking: separar recuperar de ordenar

Antes de idealizar o grafo, vale consertar o que é mais barato de consertar. A recuperação vetorial é rápida porque comprime cada trecho num único vetor, calculado *sem olhar para a pergunta*. Essa compressão é justamente o que a torna imprecisa: nuances que distinguem um trecho relevante de um quase-relevante se perdem no vetor.

O reranking desfaz esse gargalo com uma arquitetura diferente. Um cross-encoder recebe a pergunta e o trecho *juntos*, no mesmo passe, e pontua o quão bem aquele trecho responde àquela pergunta específica. É muito mais caro por par — por isso não dá para rodar sobre o corpus inteiro. A composição que funciona é em dois estágios: o índice vetorial faz a triagem barata e traz, digamos, algumas dezenas de candidatos; o reranker, caro e preciso, reordena esses poucos e entrega os melhores ao modelo. Você ganha a precisão do cross-encoder sem pagar o custo de aplicá-lo a tudo.

Esse padrão de dois estágios é, na prática, o upgrade de maior retorno sobre esforço em quase todo RAG que já passou da prova de conceito. Ele não resolve multi-hop — o candidato que falta continua faltando —, mas resolve o caso frequente em que o trecho certo *estava* entre as dezenas recuperadas e a busca vetorial o enterrou fundo demais no ranking para chegar ao modelo.

## Nada disso é de graça

Convém ser honesto sobre o custo. Construir e manter um grafo de conhecimento é caro em dois eixos. Primeiro, extração: passar o corpus inteiro por um LLM para extrair entidades e relações consome tokens de forma proporcional ao tamanho do corpus, e cada reindexação repete a conta. Segundo, e mais insidioso, qualidade: a extração erra. Ela funde entidades que deviam ser distintas, separa as que eram a mesma, inventa relações que o texto não sustenta. Um grafo com resolução de entidades ruim recupera com confiança conexões que não existem — troca a alucinação do modelo pela alucinação da estrutura, que é mais difícil de auditar porque *parece* fundamentada.

Por isso a decisão é de arquitetura, não de moda. Se as suas perguntas são majoritariamente locais — respondíveis por um único trecho —, GraphRAG é peso morto: você paga a construção do grafo para resolver um problema que a similaridade com reranking já resolvia. O grafo se paga quando as perguntas são genuinamente relacionais ou globais, quando a resposta *exige* conectar fatos dispersos ou sintetizar temas por cima de um corpus grande. Aí ele deixa de ser sofisticação e vira a única topologia que fecha a conta.

## Minha posição

RAG avançado não é uma escada onde cada degrau é estritamente melhor que o anterior, com GraphRAG no topo. É um conjunto de ferramentas que casam com formatos de pergunta diferentes, e o erro caro é adotar a mais complexa por status técnico antes de saber que perguntas o sistema precisa responder.

O caminho que eu recomendo é quase entediante de tão pragmático: comece com busca vetorial bem feita — chunking pensado, embeddings decentes —, adicione reranking de dois estágios cedo, porque o retorno é altíssimo e o custo é modesto, e só então instrumente o sistema para descobrir *que tipo* de pergunta ele está errando. Se as falhas forem de ordenação, o reranker resolve. Se forem de multi-hop e síntese global, aí sim o grafo justifica o investimento. Pular direto para GraphRAG sem esse diagnóstico é resolver com um problema de engenharia de dados o que muitas vezes era um problema de reordenar algumas dezenas de trechos. A similaridade não basta para perguntas complexas — mas a resposta raramente é abandoná-la, e quase sempre é saber exatamente onde ela para de servir.
