---
title: "Modelos de espaço de estados (Mamba): a alternativa ao Transformer"
description: "Por que os modelos de espaço de estados, com Mamba à frente, atacam o gargalo quadrático da atenção e se tornam candidatos a suceder o Transformer."
pubDate: 2026-07-04
categorias:
  - IA
  - Tecnologia
focusKeyword: "modelos de espaço de estados"
metaTitle: "Mamba e modelos de espaço de estados vs. Transformer"
metaDescription: "Por que os modelos de espaço de estados (Mamba) escalam de forma linear no comprimento e ameaçam a atenção quadrática do Transformer."
---

O Transformer venceu por um motivo que raramente é discutido em voz alta: ele trocou eficiência por paralelismo. A atenção compara cada token com todos os outros, e essa comparação total é justamente o que permite treinar em GPUs de forma massiva. O preço dessa escolha é uma conta quadrática. Dobre o comprimento da sequência e o custo da atenção quadruplica. Enquanto os contextos eram de algumas centenas ou poucos milhares de tokens, esse custo era tolerável. Agora que a fronteira se move para dezenas ou centenas de milhares de tokens, a conta quadrática deixou de ser um detalhe de implementação e virou o teto econômico da arquitetura.

É nesse teto que os modelos de espaço de estados batem com uma proposta diferente. Em vez de olhar para todos os tokens de uma vez, eles carregam um estado interno que resume o passado e o atualizam token a token. Custo linear no comprimento. É uma ideia antiga da teoria de controle e do processamento de sinais, reciclada para sequências longas, e é o que faz a família Mamba ser hoje a candidata mais séria a rivalizar com a atenção.

## O que é, de fato, um modelo de espaço de estados

Um modelo de espaço de estados descreve como um sistema evolui no tempo por meio de um estado oculto. Há um vetor de estado que condensa tudo o que importa do passado, uma regra linear que diz como esse estado se transforma a cada passo, e uma regra que lê o estado para produzir a saída. Em termos práticos: a cada novo token, o modelo mistura o estado anterior com a entrada atual, gera uma saída e segue adiante. O estado tem tamanho fixo. Ele não cresce com a sequência.

Essa é a diferença estrutural que muda tudo. Na atenção, para produzir o próximo token você precisa de todos os anteriores disponíveis, o que faz a memória e o trabalho crescerem com o comprimento. No espaço de estados, o passado inteiro vive comprimido dentro de um vetor de tamanho constante. Você não reprocessa a história; você carrega um resumo dela. Gerar o token um milhão é, em custo por passo, igual a gerar o token dez.

## A conta linear e por que ela importa agora

A promessa central é essa: o custo de processar uma sequência cresce de forma linear com o comprimento, não quadrática. Para inferência autorregressiva, cada novo token custa uma quantidade fixa de trabalho, porque só depende do estado atual e da entrada nova. Não há cache que incha a cada token gerado, como acontece com o cache de chaves e valores da atenção, que ocupa memória proporcional ao comprimento já produzido.

Isso reposiciona problemas inteiros. Processar um livro, um genoma, um log de sistema com centenas de milhares de eventos, um áudio longo em alta resolução: são domínios onde a dependência de longo alcance é real e onde a atenção quadrática ou é inviável ou exige truques de janelamento que descartam justamente o contexto distante que se queria capturar. O espaço de estados ataca esse regime pela raiz, não por remendo.

## O problema dos SSMs clássicos e o pulo do Mamba

Se a ideia é tão boa, por que ela não substituiu a atenção anos atrás? Porque os modelos de espaço de estados clássicos, para serem treináveis com eficiência, precisavam ser invariantes no tempo. Ou seja, as matrizes que governam a transição do estado eram fixas, iguais em todos os passos, independentemente do conteúdo do token. Isso permitia calcular a sequência inteira como uma convolução gigante, aproveitando o paralelismo das GPUs no treino. O custo desse truque era conceitual: um sistema com dinâmica fixa não sabe decidir o que lembrar e o que esquecer em função do que está lendo.

A atenção, apesar do custo, tem uma virtude que faltava aí: ela é seletiva por natureza. Cada token escolhe dinamicamente a quais outros prestar atenção. Um SSM de dinâmica fixa não consegue esse gesto. Ele processa "o gato" e "não" com a mesma régua, sem poder amplificar uma negação ou ignorar um token de preenchimento com base no significado.

O salto do Mamba foi tornar o mecanismo seletivo. Em vez de matrizes fixas, os parâmetros que controlam a atualização do estado passam a depender da entrada. O modelo aprende a modular, token a token, quanta informação nova incorporar e quanto do estado anterior preservar ou apagar. Ganha a seletividade que faltava aos SSMs, aproximando-se do que a atenção faz de melhor, sem pagar a conta quadrática.

Só que essa escolha quebra a matemática conveniente. Um sistema que muda os parâmetros a cada passo não pode mais ser resolvido como uma convolução única. É aqui que entra a parte de engenharia que fez o Mamba funcionar de verdade: um algoritmo de varredura projetado para o hardware, que calcula a recorrência de forma paralela e trata a memória das GPUs com cuidado, evitando escrever e ler o estado da memória lenta a todo instante. A ideia teórica é elegante; foi a implementação consciente do hardware que a tornou competitiva no treino.

## A comparação honesta com a atenção

Vale resistir à narrativa de substituição limpa. A atenção tem uma capacidade que o espaço de estados paga caro para imitar: acesso associativo exato ao passado. Quando o modelo precisa buscar um token específico dito muito atrás, uma senha, um nome, um número, a atenção pode ir lá diretamente porque guardou tudo. O SSM guarda um resumo comprimido, e o que foi comprimido pode ter se perdido. Tarefas que exigem cópia literal ou recuperação exata de um detalhe distante são o calcanhar natural de um estado de tamanho fixo.

Não por acaso, a direção mais promissora não é o SSM puro derrubando o Transformer, e sim a arquitetura híbrida. Intercalar camadas de espaço de estados, que dão o processamento linear e barato do fluxo, com algumas camadas de atenção, que dão o acesso preciso quando ele é necessário, tende a combinar o melhor dos dois regimes. É uma leitura mais madura do que "SSM venceu": cada mecanismo resolve bem uma coisa diferente, e a engenharia séria mistura os dois em vez de torcer por um vencedor único.

## Onde isso deixa o Transformer

O Transformer não vai desaparecer porque a atenção continua sendo a ferramenta certa quando o custo é aceitável e a recuperação exata importa. O que muda é que ela deixa de ser a resposta padrão para tudo. Por quase uma década, a pergunta de arquitetura foi respondida antes de ser feita: use atenção. Os modelos de espaço de estados reabrem essa pergunta, e reabri-la já é o resultado relevante.

Minha leitura é que o futuro próximo é híbrido, não uma coroação. Quem trabalha com contexto longo de verdade, áudio, genômica, logs, documentos extensos, deveria estar olhando para o espaço de estados agora, não como aposta exótica, mas como a ferramenta que torna econômico o que a atenção torna caro. E quem constrói modelos de propósito geral vai, na minha visão, convergir para blocos que misturam recorrência linear e atenção, escolhendo cada mecanismo pelo trabalho que ele faz bem. A lição do Mamba não é que a atenção estava errada. É que ela nunca foi a única forma de uma máquina lembrar do passado, e nós tínhamos parado de procurar outras.
