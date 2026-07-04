---
title: "Transformers por dentro: como a atenção realmente funciona"
description: "Como o mecanismo de atenção (query, key, value) funciona por dentro e por que os Transformers capturam dependências longas e superaram as RNNs."
pubDate: 2026-07-04
categorias:
  - IA
  - Tecnologia
focusKeyword: "mecanismo de atenção"
metaTitle: "Transformers por dentro: como a atenção funciona"
metaDescription: "Self-attention explicada: query, key e value, por que o mecanismo de atenção captura dependências longas e destronou as RNNs."
---

Toda a revolução da IA generativa dos últimos anos repousa sobre uma operação de álgebra linear que cabe em uma linha de código. O mecanismo de atenção não é magia, não é consciência e não é nada que se pareça com pensamento. É uma média ponderada. O que muda tudo é *como* esses pesos são calculados: dinamicamente, em função do próprio conteúdo, e todos de uma vez. Entender essa operação por dentro é a diferença entre usar um modelo de linguagem como caixa-preta e saber por que ele acerta, por que ele erra e onde ele vai bater no teto.

## O problema que a recorrência nunca resolveu direito

Antes de 2017, processar linguagem significava processar sequência. As redes recorrentes (RNNs, e suas variantes mais espertas como LSTM e GRU) liam texto como você lê uma frase: uma palavra por vez, carregando um estado oculto que resumia tudo que veio antes. Elegante na teoria. Frágil na prática.

O primeiro problema é o gargalo do estado. Toda a informação de cem tokens anteriores precisa ser comprimida em um único vetor de tamanho fixo. Quando o modelo chega na palavra que precisa concordar com um sujeito mencionado trinta palavras atrás, boa parte dessa informação já vazou. Esse é o famoso problema das dependências de longo alcance: o gradiente que deveria conectar duas palavras distantes atravessa dezenas de passos de multiplicação e desaparece pelo caminho. LSTMs amenizaram isso com portões que decidem o que lembrar e o que esquecer, mas amenizar não é resolver.

O segundo problema é estrutural e, no fim, foi o que matou a recorrência: ela é inerentemente sequencial. Você não pode calcular o estado do token dez sem antes ter calculado o do token nove. Isso torna impossível paralelizar o treinamento ao longo do tempo, e paralelismo é exatamente o que uma GPU faz de melhor. A recorrência deixava silício ocioso.

## Atenção é uma busca associativa

A ideia central da atenção é abandonar a compressão sequencial e deixar cada token olhar diretamente para todos os outros. Nada de intermediários, nada de estado que vaza. Se a palavra que estou processando precisa de informação que está quarenta posições atrás, ela vai buscar essa informação diretamente, em um único passo.

A metáfora que os próprios criadores usaram é a de um sistema de recuperação de informação, e ela é precisa. Pense em como você consulta um banco de dados. Você tem uma *consulta* (query): o que estou procurando. O banco tem *chaves* (keys): rótulos que descrevem cada registro. E tem *valores* (values): o conteúdo de fato. Você compara sua consulta com todas as chaves, encontra as que combinam e recupera os valores correspondentes.

A atenção faz exatamente isso, com uma diferença crucial: em vez de recuperar apenas o valor da chave que melhor combina, ela recupera uma mistura ponderada de *todos* os valores, onde o peso de cada um é proporcional a quão bem sua chave combinou com a consulta. É uma busca associativa suave, contínua, diferenciável. E por ser diferenciável, o modelo pode aprender, via gradiente, o que colocar em cada query, key e value.

## Query, key e value: três projeções do mesmo token

Aqui está o ponto que costuma escapar. Query, key e value não são três coisas diferentes que existem no mundo. São três projeções lineares do mesmo vetor de entrada. Cada token, representado por um embedding, é multiplicado por três matrizes de pesos distintas, produzindo três vetores: o que esse token *pergunta*, o que ele *oferece como rótulo* e o que ele *entrega como conteúdo*.

Essas três matrizes são os parâmetros aprendidos. É nelas que o modelo codifica, ao longo do treinamento, as regras de que um verbo deve procurar seu sujeito, que um pronome deve procurar seu antecedente, que um adjetivo deve procurar o substantivo que qualifica. Ninguém programou essas regras. Elas emergem do ajuste dessas projeções contra bilhões de exemplos.

## A mecânica, passo a passo

Com os três vetores em mãos para cada token, a operação é direta. Para descobrir quanta atenção o token A deve dar ao token B, você calcula o produto escalar entre a query de A e a key de B. Produto escalar mede alinhamento: quanto mais dois vetores apontam na mesma direção, maior o número. Um valor alto significa "essa chave é muito relevante para o que estou perguntando".

Você faz isso para todos os pares. O resultado é uma matriz de compatibilidades: cada token contra cada token. Em seguida, aplica-se um softmax em cada linha, o que transforma aqueles números brutos em uma distribuição de probabilidade — pesos positivos que somam um. Agora cada token tem uma receita de mistura: 60% de atenção neste token, 25% naquele, o resto espalhado.

O passo final é usar essa receita para combinar os *values*. A saída para cada token é a soma dos values de todos os tokens, ponderada pelos pesos de atenção. Um token que não recebeu quase nenhum peso quase não contribui; um token que dominou a distribuição domina o resultado. Esse vetor de saída é a nova representação do token, agora enriquecida com contexto colhido de toda a sequência.

Há um detalhe técnico que não é decorativo: antes do softmax, os produtos escalares são divididos pela raiz quadrada da dimensão dos vetores de key. Sem isso, à medida que a dimensão cresce, os produtos escalares crescem em magnitude e empurram o softmax para regiões saturadas, onde ele vira quase um degrau — atenção concentrada em um único token e gradientes minúsculos em todo o resto. A divisão mantém a distribuição em uma faixa saudável para o aprendizado. É o tipo de ajuste que separa uma ideia que funciona no quadro-branco de uma que funciona na GPU.

## Por que isso resolve o longo alcance

Repare no que aconteceu com a distância. Na recorrência, conectar dois tokens distantes exigia atravessar todos os passos entre eles. Na atenção, a query do token A fala diretamente com a key do token B, não importa se estão a duas ou a duzentas posições de distância. O caminho entre quaisquer dois tokens tem comprimento constante. A dependência de longo alcance deixa de ser um exercício de sobreviver ao esquecimento e vira apenas mais uma entrada na matriz de compatibilidades.

E como todos esses produtos escalares são independentes entre si, todos podem ser calculados de uma vez, em uma única multiplicação de matrizes. Foi aí que a recorrência perdeu a guerra. A atenção troca a economia da recorrência por uma operação massivamente paralela que a GPU devora. O custo é quadrático no comprimento da sequência — cada token contra cada token —, e esse é o preço que ainda pagamos hoje, a razão pela qual janelas de contexto muito longas seguem caras. Mas foi um preço que valeu a pena.

## Múltiplas cabeças e o que falta para virar Transformer

Uma única operação de atenção força o modelo a resolver todas as relações com um mesmo conjunto de projeções. É pouco. A solução foi a atenção multi-cabeça: rodar várias atenções em paralelo, cada uma com suas próprias matrizes de query, key e value, sobre subespaços diferentes da representação. Uma cabeça pode se especializar em concordância sintática, outra em correferência, outra em proximidade posicional. As saídas são concatenadas e projetadas de volta. Na prática, o modelo ganha vários olhares simultâneos sobre a mesma frase.

Falta um último detalhe que não é menor. A atenção, sozinha, é cega à ordem. Como ela olha todos os tokens ao mesmo tempo, embaralhar a sequência não muda o cálculo — para o mecanismo, uma frase é um saco de palavras. Por isso os Transformers injetam informação de posição na entrada, seja por codificações somadas aos embeddings, seja por esquemas que modulam as relações em função da distância relativa, como o RoPE que domina os modelos recentes. Sem posição, não há sintaxe.

## Minha leitura

O que me impressiona no mecanismo de atenção não é a sofisticação, é a economia conceitual. Não há nada de barroco aqui: projeções lineares, um produto escalar, um softmax, uma média ponderada. A genialidade foi perceber que a relevância entre dois tokens podia ser *aprendida* como uma comparação geométrica, e que essa comparação podia ser feita para todos os pares ao mesmo tempo. A recorrência tentava ser esperta com memória; a atenção foi burra com força bruta paralela — e a força bruta paralela é exatamente o que o hardware moderno recompensa.

Vale registrar o limite. A atenção não entende relevância no sentido humano; ela ajusta pesos que minimizam um erro de predição. Confundir uma coisa com a outra é a origem de metade das expectativas infladas sobre esses modelos. Mas dentro do seu domínio, foi uma das trocas de paradigma mais limpas que já vi em engenharia: uma operação simples, escalável e diferenciável, que transformou a capacidade de olhar longe de um problema de sobrevivência em um cálculo de matriz. Quem entende a atenção por dentro para de tratar o modelo como oráculo e passa a tratá-lo como o que ele é — uma máquina de correlação afiadíssima, e nada além disso.
