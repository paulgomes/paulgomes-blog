---
title: "Tool use e function calling: como modelos operam ferramentas externas"
description: "Como modelos de linguagem operam ferramentas externas via function calling: o LLM emite chamadas estruturadas, o runtime executa e devolve o resultado."
pubDate: 2026-07-04
categorias:
  - IA
  - DevOps
focusKeyword: "function calling"
metaTitle: "Function calling: como LLMs operam ferramentas externas"
metaDescription: "Function calling explica como um LLM emite chamadas estruturadas e o runtime executa. O mecanismo que conecta o modelo ao mundo real."
---

Um modelo de linguagem, sozinho, não faz nada além de prever o próximo token. Ele não consulta um banco de dados, não envia e-mail, não lê o clima de hoje, não executa código. Tudo o que parece "ação" quando você usa um assistente moderno acontece fora do modelo. O que o modelo faz é mais modesto e mais interessante: ele decide *que* ação pedir e escreve esse pedido num formato que outro sistema sabe executar. O nome dessa ponte é function calling, e entender como ela funciona é entender por que os LLMs deixaram de ser geradores de texto para virar operadores de sistemas.

## O modelo não executa nada

A confusão mais comum é achar que o modelo "chama a função". Ele não chama. Ele emite uma estrutura — tipicamente um objeto com o nome da função e os argumentos — e para de gerar. Quem executa é o runtime: seu código, o SDK, o servidor que orquestra a conversa. O modelo é a parte que decide e formata; o mundo real é a parte que roda.

Isso importa porque separa duas responsabilidades que costumam ser confundidas. O modelo tem a competência linguística e de raciocínio para saber que, diante de "qual o clima em Sorocaba amanhã?", a resposta certa não é inventar uma temperatura, e sim pedir uma consulta a uma ferramenta de previsão do tempo. Ele não tem — e nem deveria ter — acesso direto à API de meteorologia. Essa fronteira é o que torna o sistema controlável. Você decide quais ferramentas expõe, com que permissões, e o modelo opera dentro desse conjunto.

## Como o modelo aprende a formatar a chamada

Aqui está o ponto que quase todo material superficial pula. O modelo não tem uma "capacidade nativa" mágica de gerar JSON válido para chamar funções. Function calling é resultado de treinamento. Durante o pós-treinamento, o modelo é exposto a exemplos em que, dado um conjunto de definições de ferramentas e uma pergunta do usuário, a saída correta é uma chamada estruturada em vez de prosa. Ele aprende a associar a forma da definição (nome, descrição, esquema de parâmetros) à forma da chamada.

As definições de ferramentas normalmente chegam ao modelo como parte do contexto, descritas num esquema — na prática, algo próximo de JSON Schema: nome da função, uma descrição em linguagem natural do que ela faz, e a tipagem de cada parâmetro (string, número, enum, obrigatório ou não). Essa descrição não é decoração. É o principal sinal que o modelo usa para decidir quando e como usar a ferramenta. Uma descrição vaga produz chamadas erradas na mesma proporção em que um bom nome de variável evita bugs. O modelo lê "obtém a previsão do tempo para uma cidade e uma data" e mapeia intenções do usuário contra isso.

Do lado da geração, muitos runtimes reforçam a correção da saída com decodificação restrita — constrained decoding. Em vez de deixar o modelo produzir qualquer token, o decodificador mascara, a cada passo, os tokens que violariam o esquema esperado. Se o próximo campo deve ser um número, tokens que não formam um número recebem probabilidade zero. É por isso que a saída estruturada de function calling tende a ser mais confiável do que "peça pro modelo responder em JSON no prompt": no primeiro caso, quando há decodificação restrita, a gramática da saída é imposta na geração; no segundo, você está apenas torcendo. Vale a ressalva de que nem todo provedor usa constrained decoding — parte da confiabilidade vem só do treinamento —, mas o princípio de impor a forma na decodificação é o que dá a garantia mais forte.

## O laço: emitir, executar, devolver, continuar

Function calling raramente é um evento único. É um laço. O fluxo canônico tem quatro tempos.

Primeiro, o modelo recebe a pergunta e as ferramentas disponíveis e, em vez de responder, emite uma ou mais chamadas. Segundo, o runtime intercepta essas chamadas, executa o código real correspondente — a consulta HTTP, a query no banco, o cálculo — e captura o resultado. Terceiro, o resultado é devolvido ao modelo como uma nova mensagem no contexto, marcada como saída daquela ferramenta específica. Quarto, o modelo, agora de posse do dado que não tinha, ou emite outra chamada (porque a tarefa exige mais um passo) ou redige a resposta final em linguagem natural.

Esse laço pode dar várias voltas. Uma pergunta como "compare o clima de Sorocaba e Campinas amanhã e me diga onde levar guarda-chuva" gera, no mínimo, duas chamadas à ferramenta de clima antes de qualquer texto de resposta. O modelo sequencia isso sozinho, e é essa sequência — planejar, chamar, ler o retorno, replanejar — que sustenta o que hoje chamamos de agentes. Um agente é, em boa medida, um LLM preso nesse laço com um conjunto de ferramentas e um critério de parada.

## Paralelismo, erros e o que o retorno carrega

Modelos mais capazes emitem chamadas em paralelo quando as ferramentas são independentes: pedem clima de duas cidades numa tacada só, e o runtime executa ambas antes de devolver. Isso reduz latência e reflete uma compreensão de que os dois pedidos não dependem um do outro. Quando há dependência — o resultado de A é entrada de B — o modelo tende a serializar, chamando A, lendo o retorno, e só então formulando B.

O retorno da ferramenta é tão importante quanto a chamada. Ele volta para o contexto como texto, e o modelo o trata como qualquer outra informação: pode interpretá-lo errado, pode confiar demais nele, pode precisar de tratamento de erro. Se a ferramenta falha e devolve uma mensagem de erro, um modelo bem treinado lê isso, entende que a chamada não deu certo e ou tenta de novo com argumentos corrigidos ou explica ao usuário que não conseguiu. O erro não é exceção fora do fluxo; é só mais um dado no laço. Essa é uma das partes mais subestimadas do design: a qualidade das mensagens de retorno — inclusive as de falha — molda o comportamento do modelo tanto quanto a definição da ferramenta.

## MCP e a padronização da ponte

Function calling resolve como *um* modelo fala com *suas* ferramentas. Sobra o problema de escala: cada integração era, até recentemente, um contrato ad hoc entre uma aplicação e um conjunto de funções. O Model Context Protocol (MCP) ataca exatamente isso. Ele padroniza como ferramentas, recursos e prompts são expostos a modelos, de modo que um servidor MCP escrito uma vez possa ser consumido por qualquer cliente que fale o protocolo.

Conceitualmente, MCP não muda o mecanismo que descrevi — ainda há definição de ferramenta, chamada estruturada, execução no runtime, retorno ao contexto. O que ele muda é a interoperabilidade. Em vez de reescrever a mesma integração de banco de dados para cada assistente, você expõe um servidor MCP e qualquer cliente compatível passa a operá-la. É a diferença entre cada aplicativo ter seu próprio driver e existir um padrão de driver. A ponte function calling continua a mesma; MCP é a padronização das cabeças dessa ponte.

## O que ainda quebra

Nada disso é infalível, e vale ser honesto sobre onde trinca. O modelo pode chamar a ferramenta errada porque duas descrições se sobrepõem. Pode preencher um argumento com um valor plausível porém inventado quando o usuário não forneceu o dado — a alucinação não desaparece, ela migra para dentro dos argumentos. Pode entrar em laços improdutivos, chamando a mesma ferramenta repetidamente sem convergir. E pode ser induzido, por conteúdo malicioso vindo *dentro* do retorno de uma ferramenta, a executar ações que você não autorizou — a superfície de injeção de prompt cresce a cada ferramenta conectada.

Esses não são bugs a serem corrigidos com um patch; são propriedades do arranjo. Conectar um preditor de tokens a sistemas que agem no mundo significa que a competência de raciocínio e a fragilidade do raciocínio chegam juntas ao runtime.

## Minha posição

Function calling é a transição mais importante que os LLMs fizeram depois da própria escala, e é subestimada justamente por ser discreta. Ela não aparece como uma capacidade nova e brilhante; aparece como uma mudança de papel. O modelo deixou de ser o oráculo que tenta saber tudo e virou o operador que sabe *pedir* — que reconhece os limites do próprio conhecimento e delega ao sistema certo. Essa humildade arquitetural é o que torna o resto viável.

O erro estratégico que vejo em muita equipe é investir no modelo e tratar as ferramentas como encanamento. É o contrário. Num sistema de agentes, a inteligência do produto mora tanto nas descrições das ferramentas, na granularidade delas e na qualidade dos retornos quanto no modelo que as opera. Quem escreve boas definições de ferramenta está programando o comportamento do agente de forma tão determinante quanto quem escolhe o modelo. Function calling não conectou o LLM ao mundo real por acaso — conectou porque alguém, do lado de fora, desenhou bem a ponte.
