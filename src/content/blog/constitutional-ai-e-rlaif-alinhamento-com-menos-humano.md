---
title: "Constitutional AI e RLAIF: alinhamento com menos humano no loop"
description: "Como Constitutional AI e RLAIF trocam o rotulador humano por um modelo que se autocritica segundo princípios explícitos, e o que isso desloca de risco."
pubDate: 2026-07-04
categorias:
  - IA
  - Cybersecurity
focusKeyword: "Constitutional AI"
metaTitle: "Constitutional AI e RLAIF: alinhamento sem humano"
metaDescription: "Constitutional AI e RLAIF tiram o humano do loop de alinhamento. Como funciona a autocrítica por princípios e onde o risco se desloca."
---

Todo modelo de linguagem grande chega ao fim do pré-treino como um previsor de próxima palavra brilhante e sem freios. Ele sabe muito e não quer nada. O trabalho de alinhamento é transformar essa massa de capacidade bruta em algo que recusa o que deve recusar, ajuda no que deve ajudar e explica por quê. Durante anos, a resposta padrão para esse trabalho foi humana: legiões de anotadores comparando respostas, marcando qual é melhor, ensinando o modelo por exemplo. Constitutional AI parte de uma aposta desconfortável e cada vez mais central: boa parte desse julgamento pode ser feita pelo próprio modelo, guiado por um conjunto explícito de princípios, com o humano recuando para escrever as regras em vez de aplicar cada uma delas.

## O que RLHF resolveu e o que deixou em aberto

Para entender a mudança, é preciso ser justo com o que veio antes. O aprendizado por reforço com feedback humano, o RLHF, funciona em três tempos. Primeiro, um ajuste supervisionado ensina o modelo a responder no formato de assistente. Depois, humanos comparam pares de respostas e essas preferências treinam um modelo de recompensa, uma função que aprende a estimar o quanto uma resposta agrada. Por fim, o modelo de linguagem é otimizado contra essa recompensa, tipicamente com PPO, empurrado a produzir textos que o modelo de recompensa pontua alto sem se afastar demais do ponto de partida.

O método funciona, e funciona bem o bastante para ter definido a geração atual de assistentes. Mas ele tem três custos que crescem com a ambição do projeto. O primeiro é econômico e logístico: preferência humana em escala é cara, lenta e difícil de manter consistente entre anotadores. O segundo é mais sutil e mais sério. Julgar conteúdo genuinamente danoso expõe pessoas a esse conteúdo repetidamente, um custo humano que não aparece na planilha de treino. O terceiro é de governança: quando o alinhamento vive dentro de um modelo de recompensa opaco, treinado sobre milhões de escolhas de preferência, ninguém consegue apontar para uma linha e dizer "é por isso que o modelo recusa". O valor está destilado, não declarado.

## A ideia central da Constitutional AI

Constitutional AI, a abordagem desenvolvida e publicada pela Anthropic, ataca os três custos com o mesmo movimento: tornar os princípios explícitos e delegar ao modelo a tarefa de aplicá-los. A "constituição" é um conjunto de regras escritas em linguagem natural, coisas do tipo "escolha a resposta menos prejudicial" ou "prefira a resposta que não seja evasiva sem necessidade". Não é código. São instruções que um modelo capaz consegue ler, interpretar e usar como critério de julgamento.

O treino acontece em duas fases, e a distinção entre elas importa. A primeira é supervisionada e gira em torno de autocrítica. O modelo gera uma resposta a um prompt, muitas vezes um prompt desenhado para provocar algo problemático. Em seguida, o mesmo modelo recebe um pedido para criticar a própria resposta à luz de um princípio da constituição e depois reescreve a resposta corrigindo o que a crítica apontou. Esse par de crítica e revisão produz um novo exemplo, mais alinhado, e o modelo é reajustado sobre essas versões revisadas. O ponto conceitual é forte: o mesmo modelo que erra também consegue reconhecer o erro quando recebe o critério certo, porque reconhecer é mais fácil do que gerar sob restrição.

## RLAIF: a IA no lugar do rotulador

A segunda fase é onde entra a sigla que dá título a este texto. Em vez de humanos comparando pares de respostas, o próprio modelo faz a comparação, guiado pela constituição. Apresenta-se ao modelo um prompt e duas respostas candidatas, e pergunta-se qual delas se ajusta melhor a um princípio. As escolhas do modelo formam um conjunto de preferências, e esse conjunto treina um modelo de recompensa exatamente como as preferências humanas fariam no RLHF. Daí o nome: aprendizado por reforço com feedback de IA, RLAIF. A engenharia de reforço no fim do pipeline continua a mesma; o que muda é a origem do sinal de preferência. O rotulador deixou de ser uma pessoa e passou a ser um modelo lendo uma regra.

Vale separar duas coisas que costumam ser confundidas. RLAIF não é o mesmo que Constitutional AI. Constitutional AI é o arranjo completo, com princípios explícitos, autocrítica e revisão. RLAIF é a técnica de gerar o sinal de preferência por IA, que Constitutional AI usa mas que existe independentemente do conjunto de princípios. Pode-se fazer RLAIF sem constituição alguma, apenas pedindo a um modelo que julgue qualidade. O casamento dos dois é que produz o efeito interessante: o julgamento é barato e escalável porque vem de uma IA, e é auditável porque a IA está seguindo regras que qualquer pessoa pode ler.

## Por que a auditabilidade é o ganho subestimado

O benefício mais anunciado do RLAIF é o custo. Preferência gerada por modelo escala de um jeito que preferência humana jamais vai escalar, e tira pessoas da linha de frente do conteúdo tóxico. Isso é real e importa. Mas o ganho que merece mais atenção é outro, e é de governança.

Num pipeline de RLHF puro, os valores do modelo estão implícitos nos dados. Se você quer entender por que o assistente se comporta de certo jeito, precisa inferir a partir do comportamento, porque a fonte é um mar de julgamentos individuais sem texto que os una. Numa constituição, os valores estão escritos. Dá para ler, discutir, versionar, contestar linha por linha. Se um comportamento indesejado aparece, existe um lugar concreto para procurar a causa e um lugar concreto para intervir. Isso transforma alinhamento de algo que só a equipe que treinou o modelo entende em algo que se aproxima de um documento de política pública. Não resolve o problema de saber quais valores são os certos, mas ao menos torna a pergunta discutível em vez de enterrada.

## Onde o risco se desloca

Nada disso é de graça, e a parte honesta do argumento é mapear para onde o risco se mudou, porque ele não desapareceu. Ele mudou de lugar.

O primeiro deslocamento é a dependência da capacidade do modelo. Toda a arquitetura repousa na premissa de que o modelo julga de forma confiável se uma resposta respeita um princípio. Quando o julgamento é mais fácil que a geração, isso se sustenta. Mas em domínios onde o próprio modelo tem lacunas ou preconceitos sistemáticos, ele vai supervisionar a si mesmo com os mesmos erros que deveria corrigir. Um viés compartilhado entre o gerador e o crítico não aparece na autocrítica, porque não há um olhar externo para flagrá-lo. O humano no RLHF, com toda a sua inconsistência, ao menos trazia uma fonte de erro independente.

O segundo deslocamento é a monocultura de julgamento. Anotadores humanos discordam, e essa discordância, apesar de ser um custo, é também uma forma de diversidade de valores. Um único modelo julgando milhões de pares aplica um critério muito mais uniforme. Uniformidade parece qualidade, mas também significa que qualquer ponto cego do crítico se propaga sem atrito por todo o conjunto de treino. O erro deixa de ser ruído disperso e vira um viés estrutural coerente, que é muito mais difícil de detectar depois.

O terceiro, e o mais político, é que a constituição empurra a questão para trás sem resolvê-la. Tornar os princípios explícitos não os torna corretos nem neutros. Alguém escreve essas regras, escolhe as palavras, decide o que conta como menos prejudicial. A aparência de objetividade de um documento escrito pode mascarar o fato de que ele codifica um conjunto de valores particular. O ganho de auditabilidade é verdadeiro, mas só tem valor se o escrutínio realmente acontecer. Uma constituição que ninguém de fora lê nem contesta é apenas um viés com melhor relações públicas.

## Minha posição

Constitutional AI e RLAIF representam a direção certa, e não por serem mais baratos, embora sejam. São a direção certa porque forçam o alinhamento a sair do implícito. Transformar valores em texto que se pode ler e discutir é um avanço de maturidade para um campo que por tempo demais escondeu suas escolhas éticas dentro de pesos e conjuntos de preferência inescrutáveis.

Mas eu desconfio de qualquer leitura que trate a saída do humano do loop como puro ganho de eficiência. O humano no RLHF nunca foi só um custo a eliminar. Ele era, sem que ninguém tivesse projetado assim, uma fonte independente de julgamento e de discordância. Quando um modelo se supervisiona segundo regras que outro modelo ajuda a aplicar, o sistema fica elegante, coerente e potencialmente cego de um jeito uniforme que a bagunça humana nunca permitia. O trabalho sério de alinhamento nos próximos anos não vai ser tirar mais gente do loop. Vai ser decidir, com cuidado, quais poucos lugares do loop precisam de um humano justamente porque a máquina ali concorda consigo mesma rápido demais.
