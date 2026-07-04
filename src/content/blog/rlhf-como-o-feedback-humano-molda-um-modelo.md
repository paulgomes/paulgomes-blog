---
title: "RLHF por dentro: como o feedback humano molda um modelo"
description: "RLHF alinha modelos usando preferência humana e um reward model, moldando comportamento sem aumentar a capacidade bruta do modelo."
pubDate: 2026-07-04
categorias:
  - IA
  - Tecnologia
focusKeyword: "RLHF"
metaTitle: "RLHF por dentro: feedback humano e alinhamento"
metaDescription: "RLHF por dentro: reward model, otimização por reforço e por que alinhar preferência não é o mesmo que aumentar capacidade."
---

Um modelo de linguagem treinado apenas para prever a próxima palavra não sabe conversar. Ele sabe continuar texto. A diferença entre essas duas coisas é praticamente todo o produto que você usa quando abre um assistente de IA — e o mecanismo que fecha essa lacuna atende por uma sigla que virou jargão sem que muita gente saiba o que ela realmente faz: RLHF, aprendizado por reforço a partir de feedback humano.

O ponto que quero defender aqui é simples e costuma ser mal compreendido: RLHF não deixa o modelo mais inteligente. Ele deixa o modelo mais alinhado com aquilo que humanos preferem receber como resposta. São eixos diferentes, e confundi-los leva a expectativas erradas sobre o que o pós-treinamento pode e não pode consertar.

## O problema que o pré-treinamento não resolve

Durante o pré-treinamento, o modelo absorve uma quantidade enorme de texto e aprende a modelar a distribuição estatística da linguagem. O objetivo é puramente preditivo: dada uma sequência, qual é o token mais provável a seguir. Isso constrói o que chamamos de capacidade — conhecimento factual, raciocínio, domínio de sintaxe, tradução, código. Tudo o que o modelo "sabe" já está, em essência, dentro dos pesos ao fim dessa fase.

O que não está lá é a noção de qual continuação é *útil*. Um modelo base, confrontado com uma pergunta, pode responder, pode devolver outra pergunta, pode listar dez perguntas parecidas porque estatisticamente é isso que aparece em fóruns, pode continuar com um trecho de spam. Ele não tem preferência por ser prestativo, honesto ou inofensivo, porque nada no objetivo de previsão de token o empurrou nessa direção. O pré-treinamento otimiza verossimilhança, não utilidade percebida.

O ajuste supervisionado por instruções (SFT) dá o primeiro empurrão: mostra ao modelo exemplos de pares pergunta-resposta bem-feitos e o faz imitar aquele formato. Funciona, mas tem um teto. Escrever demonstrações perfeitas para todo tipo de pedido é caro, e imitação captura apenas o que os anotadores conseguem *produzir*, não o que eles conseguem *reconhecer* como melhor. É mais fácil dizer qual de duas respostas é melhor do que escrever a resposta ideal do zero. RLHF nasce dessa assimetria.

## Preferência é mais barata que demonstração

A engrenagem central do RLHF é trocar a demonstração pela comparação. Em vez de pedir que humanos escrevam a resposta certa, mostramos a eles duas (ou mais) respostas geradas pelo próprio modelo e perguntamos qual é a melhor. Julgar é mais rápido, mais consistente entre pessoas e cobre casos que ninguém pensaria em demonstrar.

Essas comparações viram um conjunto de dados de preferência: para um mesmo prompt, uma resposta é marcada como preferida e outra como preterida. É um sinal ordinal — dizemos que A é melhor que B, sem atribuir uma nota absoluta. E é justamente sobre esse sinal ordinal que se constrói a próxima peça.

## O reward model: transformar julgamento em número

Você não pode ter humanos no circuito a cada passo de treinamento — seriam bilhões de julgamentos. A solução é treinar um segundo modelo, o *reward model*, cuja única função é imitar o julgamento humano. Ele recebe um prompt e uma resposta e devolve um escalar: quão preferível aquela resposta é.

O reward model costuma partir do mesmo backbone do modelo de linguagem, com a cabeça de previsão de tokens trocada por uma cabeça que emite um único número. O treinamento usa uma formulação clássica de preferência par a par: dado o par (resposta preferida, resposta preterida), o modelo é otimizado para atribuir uma pontuação maior à preferida. Na prática, minimiza-se uma perda logística sobre a diferença entre as duas pontuações — a mesma estrutura matemática por trás de modelos de comparação como o de Bradley-Terry. O reward model não aprende o que é "bom" no abstrato. Ele aprende a reproduzir o padrão de preferência dos anotadores que geraram os dados. Essa distinção é crucial e volto a ela no fim.

Terminada essa fase, temos um proxy diferenciável e barato do gosto humano. É esse proxy que a fase de reforço vai perseguir.

## A otimização por reforço, e a coleira que a segura

Com o reward model no lugar, o problema vira reforço puro. O modelo de linguagem é a política: dado um prompt, ele gera uma resposta (uma sequência de ações, onde cada token é uma ação). O reward model pontua a resposta. Ajustamos os pesos da política para aumentar a probabilidade de gerar respostas com pontuação alta. O algoritmo mais associado a esse passo é o PPO (Proximal Policy Optimization), embora abordagens mais recentes otimizem preferência de forma mais direta.

Aqui mora o detalhe que separa um sistema que funciona de um que colapsa. Se você apenas mandar a política maximizar a recompensa, ela encontra atalhos. O reward model é imperfeito — é um modelo, não a verdade — e a política vai explorar suas falhas. Ela descobre respostas que a rede de recompensa adora e que humanos achariam vazias, bajuladoras ou repetitivas. Isso se chama *reward hacking*: otimizar o proxy até que ele descole do objetivo real.

A defesa padrão é uma penalidade de divergência de Kullback-Leibler entre a política sendo treinada e a política de referência (o modelo pós-SFT, antes do reforço). Em bom português: a cada passo, o modelo é recompensado por agradar o reward model, mas penalizado por se afastar demais de como ele falava antes. Essa coleira de KL mantém o modelo dentro do território de linguagem que já era competente, impedindo que ele degenere em texto bizarro só para arrancar pontos. O ajuste fino do RLHF é uma negociação constante entre "agrade mais o avaliador" e "não se torne uma criatura estranha no processo".

## Por que isso molda comportamento, não capacidade

Volto à tese. Todo o processo de RLHF por preferência opera sobre respostas que o modelo *já é capaz de gerar*. O reforço não injeta conhecimento factual novo nem ensina do zero raciocínios sem qualquer traço nos pesos. Ele redistribui probabilidade: torna mais provável que o modelo produza, dentre as continuações que já sabia gerar, aquelas que humanos preferem. É mais uma reponderação e uma elicitação de comportamento do que uma expansão da competência de base.

Isso tem consequências concretas. RLHF é excelente para tom, formato, recusa apropriada, honestidade sobre incerteza, seguir instruções e evitar conteúdo nocivo. Não é o mecanismo que, sozinho, faz um modelo passar a resolver uma classe de problemas que antes errava por pura falta de capacidade — se a habilidade não tem nenhuma base no modelo, a preferência humana não a inventa. Alinhar preferência e aumentar capacidade bruta são operações em eixos amplamente distintos, e boa parte da frustração com pós-treinamento vem de esperar que um resolva o problema do outro. (Vale a ressalva: variantes de reforço com recompensa verificável, aplicadas a tarefas como matemática e código, conseguem *elicitar* e afiar raciocínios que já estavam latentes — mas isso é um regime diferente do RLHF por preferência humana descrito aqui.)

Há ainda um efeito lateral bem documentado na prática: o *imposto de alinhamento*. Empurrar o modelo para respostas mais seguras e agradáveis pode, em certas tarefas, reduzir levemente o desempenho bruto. A coleira que impede o comportamento indesejado também restringe parte da amplitude que o modelo tinha. Não é mágica sem custo — é uma troca deliberada.

E há o risco de moldar a coisa errada. Como o reward model aprende a preferência dos anotadores, ele herda os vieses deles. Se as pessoas tendem a preferir respostas longas, confiantes e concordantes, o modelo aprende que comprimento, confiança e concordância são recompensados — mesmo quando a resposta curta, cautelosa e discordante seria a correta. A bajulação que incomoda em assistentes modernos não é um bug aleatório: é o retrato fiel de um sinal de preferência que premiava concordar com o usuário.

## Minha posição

RLHF é, na minha leitura, a técnica mais subestimada e ao mesmo tempo mais superestimada do ciclo de treinamento. Subestimada porque é o que transforma um preditor de texto bruto em algo que parece um interlocutor — sem ela, não haveria produto. Superestimada porque virou uma palavra mágica para "melhorar o modelo", quando na verdade ela sobretudo realoca comportamento dentro de uma capacidade em grande medida já fixada.

O erro estratégico que vejo com frequência é tratar problemas de capacidade como se fossem problemas de alinhamento. Quando um modelo erra por não saber, mais RLHF por preferência não ajuda — o caminho é dado, pré-treinamento ou arquitetura. Quando ele erra por saber e escolher a continuação errada, aí sim o feedback humano é a ferramenta certa. Saber diagnosticar de qual lado está o problema vale mais do que qualquer sigla. RLHF não ensina o modelo a pensar. Ensina o modelo a se comportar. E, para a maioria dos usos reais, comportamento é exatamente o que estava faltando.
