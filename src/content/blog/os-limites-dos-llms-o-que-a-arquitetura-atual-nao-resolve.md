---
title: "Os limites dos LLMs: o que a arquitetura atual não resolve"
description: "Por que raciocínio composicional e generalização fora da distribuição continuam sendo os limites dos LLMs que mais escala não conserta."
pubDate: 2026-07-04
categorias:
  - IA
  - ASI
focusKeyword: "limites dos LLMs"
metaTitle: "Os limites dos LLMs que a escala não resolve"
metaDescription: "Raciocínio composicional e generalização fora da distribuição: os limites dos LLMs que a arquitetura atual não resolve, e por que mais escala não basta."
---

A discussão sobre inteligência artificial hoje é dominada por uma crença implícita: a de que basta continuar escalando. Mais parâmetros, mais dados, mais computação, e os problemas que persistem hoje evaporam amanhã. Essa crença tem uma base empírica real — as leis de escala descrevem ganhos previsíveis conforme aumentamos os recursos. Mas confundir uma curva de melhora contínua com a ausência de limites é um erro categórico. Alguns dos problemas mais fundamentais dos LLMs não são gargalos de tamanho. São propriedades da arquitetura. E arquitetura não se conserta com escala.

Este texto é sobre esses limites estruturais. Não os bugs que a próxima geração corrige, mas as coisas que o Transformer, como o construímos hoje, simplesmente não faz por natureza.

## O que "raciocinar" significa para um modelo de linguagem

Precisamos ser precisos sobre o que um LLM faz quando parece raciocinar. A arquitetura Transformer executa, para cada token gerado, uma quantidade fixa de computação. As camadas são fixas, a profundidade é fixa, o mecanismo de atenção compara o token atual com todos os anteriores dentro da janela de contexto. Isso significa uma coisa importante e frequentemente ignorada: um modelo não pode "pensar mais" sobre um token difícil do que sobre um trivial. A profundidade computacional por passo é constante.

O que chamamos de raciocínio no modelo de base é, mecanicamente, a construção de uma continuação estatisticamente plausível. O modelo aprendeu, em escala colossal, quais sequências de símbolos tendem a seguir quais outras. Quando o resultado dessa continuação coincide com uma cadeia de inferência correta, dizemos que ele raciocinou. Às vezes coincide de forma impressionante. Mas o mecanismo subjacente é o mesmo tanto quando acerta quanto quando erra — e essa indistinção é a raiz do problema.

O chain-of-thought e os modelos de raciocínio treinados com reforço mudam parte dessa equação. Ao gerar passos intermediários, o modelo transforma um problema de profundidade fixa em um problema de comprimento variável: ele empurra a computação do eixo da profundidade para o eixo do tempo, usando os próprios tokens gerados como uma espécie de memória de trabalho externa. Isso é genuinamente poderoso e expande o que a arquitetura consegue fazer. Mas não é gratuito, e não é ilimitado.

## Composição: onde a colagem de padrões falha

O raciocínio composicional é a capacidade de combinar regras conhecidas para resolver problemas que nenhuma delas resolve isoladamente. Se sei aplicar a operação A e sei aplicar a operação B, deveria conseguir aplicar A seguida de B seguida de A novamente, mesmo que essa combinação específica nunca tenha aparecido no meu treino. É isso que sustenta a matemática, a programação, a lógica — qualquer domínio em que peças finitas geram possibilidades infinitas.

Aqui os LLMs exibem um padrão característico. Eles são excelentes quando a composição já está, de alguma forma, presente na distribuição de treino — quando a combinação de passos que o problema exige se parece com combinações que o modelo já viu. E degradam de forma acentuada quando a profundidade de composição cresce ou quando a combinação exigida é estruturalmente nova, mesmo que cada passo individual seja trivial.

O caso mais didático é a multiplicação de números grandes. Um LLM sabe a tabuada, entende o algoritmo, consegue descrever o procedimento em detalhes. Mas multiplicar dois números longos exige aplicar o mesmo passo com fidelidade perfeita muitas vezes seguidas, propagando resultados intermediários sem erro. É exatamente aí que a colagem de padrões falha: não existe padrão a colar para "este número específico vezes este outro". Existe apenas o algoritmo, aplicado com disciplina. E aplicar um algoritmo com disciplina por muitos passos é o que a computação de profundidade fixa não garante. O erro se acumula porque cada passo é uma predição aprendida, sem garantia de correção — não uma execução verificada.

Escala melhora isso na margem — modelos maiores memorizam mais casos e generalizam padrões mais amplos. Mas ela ataca o sintoma, não a causa. O que falta não é capacidade de armazenar mais combinações vistas; é um mecanismo que garanta a aplicação correta e repetida de uma regra a entradas arbitrárias. Memorizar mais nunca vira execução confiável.

## Fora da distribuição: o ponto cego que não se preenche

A generalização fora da distribuição — o comportamento diante de entradas sistematicamente diferentes do que se viu no treino — é o segundo limite duro. E aqui a natureza do treinamento trabalha contra nós.

Um LLM aprende otimizando desempenho sobre a distribuição dos seus dados. Tudo que ele "sabe" é uma estatística dessa distribuição. Quando uma entrada cai dentro dela, ou perto o suficiente da envoltória de tudo que foi visto, o modelo interpola com competência notável. O problema é que o mundo real produz constantemente entradas que não estão nessa envoltória: uma estrutura de raciocínio mais longa que qualquer exemplo de treino, uma combinação de restrições inédita, um domínio genuinamente novo.

Diante disso, o modelo não sinaliza "não sei". Ele faz o que sempre faz — produz a continuação mais plausível segundo o que aprendeu. E "plausível segundo o treino" pode estar arbitrariamente longe de "correto no caso presente". Essa é a origem mecânica da alucinação. Não é um defeito que se remove com mais dados; é o comportamento esperado de um interpolador estatístico levado para fora da região onde interpolar faz sentido. Você não elimina a fronteira da distribuição adicionando dados — apenas move a fronteira. Sempre há um lado de fora.

A escala expande a envoltória: mais dados significam que mais do mundo cai "dentro". Por isso os modelos parecem generalizar cada vez melhor. Mas expandir a região coberta não é o mesmo que adquirir a capacidade de operar corretamente fora dela. Um sistema que extrapolasse de verdade precisaria de algo que o treino puramente estatístico não fornece: representações de regras que valem por serem regras, não por terem sido observadas com frequência.

## O que a escala realmente conserta, e o que não

Vale ser justo com a escala, porque ela conserta muita coisa. Fluência, amplitude de conhecimento, robustez a variações superficiais de formulação, a capacidade de seguir instruções complexas — tudo isso melhora de forma clara e mensurável com tamanho. Muitas fraquezas que pareciam fundamentais há poucos anos eram, de fato, apenas questão de recursos insuficientes.

A distinção útil é entre limites de capacidade e limites de mecanismo. Limites de capacidade são os que somem quando você dá mais recursos ao modelo: ele sabia menos, agora sabe mais. Limites de mecanismo persistem porque decorrem de como a computação é feita, não de quanta se faz. Execução confiável de algoritmos multi-passo, extrapolação para fora da distribuição, garantia de consistência lógica interna — esses são de mecanismo. Você pode reduzir a taxa de erro empurrando escala, e isso tem valor prático enorme, mas não cruza a linha do "erra menos" para o "não pode errar por construção".

É por isso que o campo se move para arquiteturas híbridas. Modelos que chamam interpretadores de código para calcular em vez de prever o cálculo. Sistemas que integram verificadores externos, provadores, ferramentas simbólicas. A lógica é reveladora: quando o problema exige execução correta e verificável, a resposta não tem sido um Transformer maior — tem sido acoplar o Transformer a algo que executa e verifica de verdade. Estamos, na prática, admitindo em engenharia o que resistimos a admitir em discurso: a rede neural sozinha não fecha essa conta.

## Minha posição

Acho que o debate público sobre IA está mal calibrado nos dois extremos. De um lado, o ceticismo que despreza os LLMs como "papagaios estocásticos" ignora o quanto de raciocínio útil emerge da previsão de próximo token em escala — é mais do que a teoria previa, e desprezar isso é não estar prestando atenção. De outro, o otimismo que trata cada limite como um problema de engenharia a ser resolvido na próxima geração confunde a inclinação de uma curva com o seu destino.

Minha leitura é que os limites que descrevi aqui não são etapas na estrada da escala. São propriedades da estrada. Composicionalidade profunda e extrapolação fora da distribuição não caem porque um modelo é maior; caem, quando caem, porque colamos ao modelo um mecanismo de natureza diferente — que executa, verifica, ou impõe estrutura. O futuro competente da IA aplicada não é um LLM gigante que finalmente pensa sozinho. É um sistema em que o LLM faz o que faz melhor — mediar linguagem, propor, orquestrar — cercado por componentes que fazem o que ele estruturalmente não faz.

Para quem constrói produtos, a implicação é direta e nada abstrata: não aposte a correção do seu sistema em uma capacidade que o modelo não tem por construção. Descubra onde seu problema é de capacidade — e ali a escala é sua amiga — e onde é de mecanismo — e ali você precisa de verificação, de ferramentas, de estrutura externa. Confundir os dois é a diferença entre um sistema que melhora com o próximo modelo e um que continua errando exatamente onde sempre errou, só que com mais confiança.
