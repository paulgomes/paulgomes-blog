---
title: "Red-teaming e jailbreaks: como se testa a segurança de um modelo"
description: "Como se testa a segurança de um LLM: red-teaming, jailbreaks e a corrida assimétrica entre quem defende e quem contorna as travas do modelo."
pubDate: 2026-07-04
categorias:
  - Cybersecurity
  - IA
focusKeyword: "jailbreak de LLM"
metaTitle: "Red-teaming e jailbreaks: testando a segurança do LLM"
metaDescription: "Como funciona o jailbreak de LLM, por que as travas são contornáveis e por que a defesa sempre corre atrás do ataque. Análise técnica de Paul Gomes."
---

Todo modelo de linguagem grande carrega uma contradição no próprio projeto. Ele foi treinado para ser útil ao máximo, para completar qualquer texto de forma plausível, e depois foi ensinado a recusar uma fração específica desses pedidos. A recusa não é uma propriedade fundamental do sistema. É uma camada de comportamento aprendida, colada por cima de uma máquina que, no fundo, ainda quer continuar qualquer sequência que você comece. O jailbreak de LLM explora exatamente essa colagem. Não quebra o modelo: convence a máquina a voltar a ser o que ela sempre foi por baixo do alinhamento.

Entender isso é o primeiro passo para entender por que testar segurança de modelo é uma disciplina tão estranha. Você não está procurando um bug de estouro de buffer que, uma vez corrigido, some. Está sondando uma superfície de comportamento contínua, definida em linguagem natural, onde o espaço de ataque é do tamanho de tudo que se pode escrever.

## O que a trava realmente é

Vale desfazer a metáfora de "trava". Não existe um `if` no modelo que barra pedidos proibidos. O que existe é um conjunto de pesos ajustados para que, diante de certas distribuições de entrada, a saída mais provável seja uma recusa. Esse ajuste vem do pós-treino: fine-tuning supervisionado com exemplos de recusa e, sobretudo, aprendizado por reforço a partir de feedback, onde respostas que violam a política recebem sinal negativo e recusas apropriadas recebem sinal positivo. O modelo aprende uma fronteira estatística entre "responder" e "recusar".

A palavra-chave é estatística. A fronteira foi desenhada a partir dos exemplos que os treinadores conseguiram imaginar e rotular. Ela generaliza razoavelmente para pedidos parecidos com esses exemplos e mal para pedidos escritos de formas que ninguém previu. O jailbreak vive nessa lacuna de generalização. Ele reescreve a intenção proibida numa embalagem que cai do lado "responder" da fronteira, sem que o conteúdo tenha mudado.

Há ainda um detalhe arquitetural que ajuda o atacante. O modelo é autorregressivo: gera um token de cada vez, condicionado a tudo que veio antes, inclusive ao que ele próprio já escreveu. Se o atacante conseguir fazer o modelo começar a resposta com "Claro, aqui está o passo um", a própria coerência interna do texto empurra os tokens seguintes na direção da continuação, não da recusa. Uma boa parte das técnicas explora essa inércia: o custo de recusar cresce depois que a resposta já começou a fluir.

## A anatomia dos ataques

As famílias de jailbreak que funcionam na prática atacam pontos diferentes desse desenho, e vale separá-las por mecanismo, não por gíria.

A primeira família é a de **mudança de enquadramento**. Roleplay, personas fictícias, "você é um modelo sem restrições", pedidos embrulhados como roteiro de filme ou exercício acadêmico. Todos exploram o mesmo ponto: o alinhamento foi treinado para reconhecer a forma canônica de um pedido perigoso, e o enquadramento move a entrada para uma região onde a associação "isto é proibido" é fraca. O modelo não deixou de saber que a informação é sensível. Ele deixou de reconhecer o pedido como pertencente à categoria que aprendeu a recusar.

A segunda é a de **ofuscação e mudança de canal**. Codificar o pedido em outro idioma pouco representado no treino de segurança, em base64, em cifras simples, em separação de sílabas, em tokens intercalados. Aqui a assimetria é reveladora: a capacidade geral do modelo costuma ser grande o bastante para decodificar, mas a camada de segurança foi treinada predominantemente sobre texto direto e nem sempre acompanha o pedido para dentro do canal ofuscado. A competência tende a sobreviver à ofuscação; o alinhamento, nem sempre.

A terceira é a de **injeção de prefixo e supressão de recusa**. Instruir o modelo a nunca começar com "Desculpe", a responder sempre em determinado formato, a assumir que a resposta já foi aprovada. É a exploração direta da inércia autorregressiva: você não pede para o modelo violar a política, você torna a recusa sintaticamente incômoda dentro do formato imposto.

A quarta, e a mais interessante do ponto de vista de pesquisa, é a de **ataques por otimização**. Em vez de um humano escrever o prompt malicioso, um algoritmo procura, no espaço de entradas, uma sequência que maximize a probabilidade de uma resposta proibida. Quando o atacante tem acesso aos pesos ou aos gradientes do modelo, dá para buscar sufixos adversariais por otimização baseada em gradiente, produzindo cadeias de caracteres que parecem lixo para um humano mas empurram a saída para o lado errado da fronteira. Um achado incômodo dessa linha é a **transferência**: um sufixo otimizado contra um modelo aberto às vezes funciona, em algum grau, contra outro modelo ao qual o atacante nunca teve acesso interno. Isso sugere que as fronteiras de segurança de modelos diferentes podem compartilhar geometria, e que atacar a mais barata pode render, em parte, acesso à mais cara.

## Como o red-teaming testa tudo isso

Red-teaming é o processo de gerar esses ataques de forma sistemática, antes que outra pessoa o faça em produção. Na prática, opera em camadas.

A camada manual é feita por pessoas com criatividade adversarial, muitas vezes especialistas de domínio, que exploram os cantos que a política nem sabia que precisava cobrir. É cara, não escala, e é insubstituível: humanos encontram o tipo de ataque conceitualmente novo que nenhum gerador automático teria proposto, porque o gerador costuma recombinar o que já existe.

A camada automatizada usa modelos para atacar modelos. Um sistema gera milhares de variações de prompts de ataque, outro tenta classificar se a resposta obtida violou a política, e o ciclo realimenta as variações que mais se aproximaram de furar a defesa. É essencialmente busca adversarial sobre linguagem, e é o que permite cobrir volume. O gargalo silencioso aqui é o **classificador de sucesso**: decidir automaticamente se uma resposta é ou não uma violação é, em si, um problema de linguagem natural difícil e sujeito a erro. Muito da qualidade de um programa de red-teaming está na qualidade desse juiz, não só na esperteza dos ataques.

Um ponto técnico que quem mede segurança precisa respeitar: a taxa de sucesso de ataque depende de amostragem. O mesmo prompt, rodado várias vezes com temperatura acima de zero, produz saídas diferentes. Uma trava que segura em uma tentativa pode ceder em outra. Por isso, medir "o modelo resiste a este jailbreak" com uma única execução não significa quase nada. O que importa é a probabilidade de furar sob repetição, e um atacante real repete.

## Por que a defesa corre atrás por construção

A assimetria é estrutural, não uma falha de esforço. Quem defende precisa fechar todas as reformulações possíveis de uma intenção proibida. Quem ataca precisa achar uma que passe. O espaço de reformulações em linguagem natural é praticamente ilimitado, então o atacante joga um jogo de busca num espaço gigante, e a busca é barata; o defensor joga um jogo de cobertura no mesmo espaço, e a cobertura é cara.

Pior: as duas capacidades crescem juntas. Modelos mais competentes seguem instruções mais complexas, o que torna os enquadramentos de ataque mais eficazes; e ao mesmo tempo entendem melhor a política, o que torna a defesa melhor. Não há razão para acreditar que uma das curvas ultrapasse a outra de forma permanente. Cada geração de modelo fecha classes inteiras de jailbreaks antigos e abre superfícies novas — janelas de contexto maiores, uso de ferramentas, entrada multimodal, memória entre turnos. A injeção de prompt indireta, em que a instrução maliciosa vem escondida num documento ou numa página que o modelo lê enquanto executa uma tarefa, é o exemplo atual de superfície que mal existia quando os modelos só respondiam texto e hoje é um dos vetores mais perigosos, justamente porque o modelo agente age no mundo.

As defesas de verdade, por isso, não são um único muro. São camadas: alinhamento nos pesos, um classificador de entrada que barra pedidos suspeitos antes de chegarem ao modelo, um classificador de saída que inspeciona a resposta antes de ela sair, limites sobre o que as ferramentas conectadas podem fazer. Cada camada é furável sozinha; juntas, elevam o custo do ataque. Segurança de modelo é gestão de custo do atacante, não erradicação do ataque.

## Minha posição

Acho um erro tratar jailbreak como bug a ser eliminado. Enquanto um modelo for útil o bastante para raciocinar sobre qualquer assunto, existirá um caminho linguístico para extrair dele o que ele sabe, porque a competência e a recusa moram nos mesmos pesos e não dá para amputar uma sem ferir a outra. A pergunta honesta não é "o modelo é jailbreakável", é "quanto custa jailbreakar e o que acontece depois". Um sistema sério assume que a trava do modelo vai ceder eventualmente e coloca as consequências reais fora do modelo: limitando o que o agente pode executar, registrando o que ele faz, exigindo confirmação para ações de impacto.

Quem vende um LLM prometendo que "não pode ser contornado" ou não entende o sistema que está vendendo ou aposta que você não entende. A postura defensável é a oposta: o modelo é uma camada de segurança probabilística e valiosa, nunca a última. Red-teaming não existe para provar que a trava é perfeita. Existe para descobrir, antes do adversário, o preço exato de furá-la — e para garantir que, no dia em que alguém pagar esse preço, o estrago não passe da conversa.
