---
title: "Como se avalia um LLM: benchmarks, suas falhas e a contaminação de dados"
description: "Por que benchmark alto engana: vazamento de dados de teste, contaminação de treino e como avaliar um LLM de forma honesta."
pubDate: 2026-07-04
categorias:
  - IA
  - Tecnologia
focusKeyword: "benchmarks de LLM"
metaTitle: "Como se avalia um LLM: benchmarks e contaminação"
metaDescription: "Benchmark alto engana. Entenda vazamento de dados de teste, contaminação de treino e como avaliar um LLM de forma honesta."
---

Quando um modelo novo chega, a primeira coisa que aparece é uma tabela. Colunas com nomes em maiúscula, uma linha em negrito, um número maior que o do concorrente. Essa tabela é um instrumento de marketing muito antes de ser um instrumento de ciência. E o problema não é que os benchmarks de LLM mintam. O problema é que eles medem uma coisa muito mais estreita do que a palavra "avaliação" sugere, e quase todo mundo lê o número como se ele fosse a coisa toda.

A tese deste texto é simples e desconfortável: um benchmark alto é, na melhor das hipóteses, uma condição necessária e nunca suficiente. E em boa parte dos casos ele nem é necessário.

## O que um benchmark realmente mede

Um benchmark é um conjunto fixo de tarefas com respostas conhecidas e uma métrica de acerto. Você roda o modelo em milhares de perguntas, compara com o gabarito e reporta uma porcentagem. A elegância disso é também a armadilha: para virar número comparável, a tarefa precisa ser fechada, repetível e barata de corrigir. Isso empurra os benchmarks para formatos que a máquina consegue pontuar sozinha, tipicamente múltipla escolha ou verificação de resposta exata.

O efeito colateral é enorme. Uma prova de múltipla escolha não mede raciocínio; mede a capacidade de selecionar a alternativa certa entre quatro ou cinco. São coisas correlacionadas, mas não idênticas. Um modelo pode chegar na resposta certa por eliminação, por viés estatístico das alternativas, ou por ter visto algo parecido durante o treino. A métrica registra "acertou". Ela não registra "como".

Some a isso a sensibilidade a detalhes que nada tem a ver com capacidade. A forma como o prompt é escrito, a ordem das alternativas, se o modelo responde direto ou com cadeia de raciocínio, o parsing que extrai a resposta final do texto gerado: tudo isso mexe no número. Duas avaliações honestas do mesmo modelo no mesmo benchmark podem divergir vários pontos só pela metodologia de execução. Quando alguém te mostra 87 contra 85, a diferença frequentemente está dentro da margem de ruído do próprio protocolo.

## A contaminação de dados: o vazamento que ninguém controla

Aqui está o furo mais grave, e o mais estrutural. LLMs são treinados raspando a internet em escala massiva. Benchmarks vivem na internet. Suas perguntas, respostas, discussões em fóruns, repositórios com o gabarito, artigos que citam exemplos: tudo isso tem chance real de estar no corpus de treino.

Quando o conjunto de teste vaza para o conjunto de treino, o benchmark deixa de medir generalização e passa a medir memorização. O modelo não resolve a questão; ele lembra dela. E memorização infla a nota exatamente nas provas mais famosas, porque quanto mais citado o benchmark, mais cópias dele circulam pela web e maior a probabilidade de contaminação. O sucesso do benchmark corrói o benchmark.

Isso é o que se chama de contaminação de dados, e ela é traiçoeira por três motivos. Primeiro, é difícil de detectar: os corpora de treino são gigantescos, muitas vezes não são públicos, e a questão pode aparecer parafraseada, traduzida ou fragmentada, escapando de qualquer busca por correspondência exata. Segundo, ela não precisa ser intencional. Ninguém precisa "colar" o gabarito de propósito; basta a internet ser a internet. Terceiro, ela produz exatamente o sintoma que engana: nota alta com competência real menor.

Existem técnicas para estimar contaminação. Reescrever as perguntas mantendo a estrutura lógica e ver se a nota despenca. Trocar nomes, números e contexto de um problema para checar se o modelo entendeu o método ou decorou a instância. Comparar desempenho em versões antigas e novas de uma mesma prova, quando a nova foi publicada depois do corte de treino. Nenhuma dessas técnicas é definitiva, mas todas apontam para o mesmo padrão recorrente: quando você perturba levemente uma questão conhecida, modelos que pareciam brilhantes às vezes tropeçam de um jeito que um humano competente jamais tropeçaria. Isso é a assinatura da memorização se disfarçando de raciocínio.

## Otimizar para a prova não é aprender a matéria

Há um segundo mecanismo, mais sutil que o vazamento direto, que a economia dos benchmarks torna quase inevitável. Quando uma métrica vira o placar público pelo qual um modelo é julgado, ela deixa de ser uma boa medida. É a lei de Goodhart aplicada a IA.

Os laboratórios sabem quais benchmarks a imprensa vai citar. É racional, do ponto de vista competitivo, ajustar dados de treino, curar exemplos e afinar o modelo em direção aos formatos e domínios que essas provas cobrem. Nada disso é trapaça no sentido criminal. Mas o resultado é um modelo calibrado para a paisagem específica dos testes populares, que pode não transferir para o seu problema real. O número sobe; a utilidade para o seu caso de uso não necessariamente acompanha. Você está comprando desempenho num exame que não é o seu.

## O que os benchmarks não capturam

Mesmo sem contaminação e sem overfitting, o formato tem limites duros de nascença. Benchmarks de resposta única lidam mal com tarefas abertas, onde existe um espectro de respostas boas em vez de um gabarito. Escrever, resumir com julgamento editorial, projetar arquitetura de software, conduzir uma conversa longa mantendo coerência: nada disso reduz a uma célula de planilha sem perder o essencial.

Foi essa lacuna que empurrou o campo para duas saídas imperfeitas. Uma é a avaliação humana por comparação, onde pessoas escolhem qual das duas respostas preferem e um ranking emerge das preferências agregadas. Isso captura qualidade percebida, mas mistura substância com estilo, e recompensa respostas que soam bem, longas e confiantes, ainda que erradas. A outra saída é usar um modelo forte como juiz de outros modelos. Barato, escalável, e traz seus próprios vieses: o juiz tende a favorecer o próprio estilo, a se deixar levar pela fluência e a herdar pontos cegos de quem o treinou. Nenhuma das duas é neutra. Ambas medem algo real e algo espúrio ao mesmo tempo.

## Como avaliar de forma honesta

Se benchmark público é um sinal ruidoso e contaminável, a saída não é abandonar medição. É mudar o que você mede e para quem. A avaliação honesta começa por parar de perguntar "qual modelo é melhor" e começar a perguntar "qual modelo é melhor na minha tarefa, com os meus dados, sob as minhas restrições".

Isso significa, na prática, construir seu próprio conjunto de avaliação com exemplos que o modelo comprovadamente nunca viu, de preferência coletados ou escritos depois do corte de treino e mantidos privados. Um conjunto privado é a única defesa real contra contaminação, porque ele não pode ter vazado para um corpus se nunca esteve na internet. Significa avaliar a tarefa final que importa para você, ponta a ponta, e não um proxy acadêmico dela. Significa medir também o que os benchmarks costumam ignorar: custo por resposta, latência, taxa de alucinação, comportamento sob prompt adversarial, consistência quando a mesma pergunta é feita de dez formas diferentes.

E significa desconfiar sistematicamente de qualquer número que você não possa reproduzir. Se você não sabe o prompt exato, a forma de extrair a resposta, a temperatura, o número de tentativas e a data de coleta dos dados, aquele número não é um resultado. É uma alegação.

## Minha posição

Eu leio tabelas de benchmark do jeito que leio o velocímetro de um carro no comercial: informa alguma coisa, mas foi filmado em pista fechada por um profissional. O número alto merece a mesma pergunta que qualquer resultado extraordinário merece: em que condições, e o que aconteceria se eu mexesse um pouco no cenário.

Na prática, confio muito mais numa bateria de testes pequena, privada e desenhada em cima do meu problema do que em qualquer ranking público, por mais prestigiado que seja. Benchmark serve para descartar candidatos claramente fracos e para acompanhar tendências grosseiras ao longo do tempo. Ele não serve para decidir. A decisão vem de rodar o modelo no seu contexto, com seus dados, e olhar não só o acerto médio, mas os erros: como ele falha, com que cara de confiança ele erra, e o que isso custaria se acontecesse com um cliente seu na frente. Um modelo que acerta 90 por cento com falhas silenciosas e catastróficas é pior que um que acerta 85 e avisa quando não sabe. Nenhuma tabela de benchmark vai te contar isso. Só a sua própria avaliação conta.
