---
title: "Chain-of-thought: como os modelos pensam antes de responder"
description: "O que é chain of thought: por que decompor um problema em passos intermediários melhora as respostas de modelos de linguagem — e por que isso não é pensar."
pubDate: 2026-07-04
categorias:
  - IA
  - Tecnologia
focusKeyword: "chain of thought"
metaTitle: "Chain-of-thought: como os modelos pensam"
metaDescription: "Chain of thought explicado a fundo: por que raciocinar em passos intermediários melhora respostas de LLMs — e por que isso não é pensamento no sentido humano."
---

Quando um modelo de linguagem escreve "vamos pensar passo a passo" antes de resolver um problema, ele não está descrevendo um processo mental que já aconteceu por dentro. Ele está construindo o processo agora, em voz alta, na própria saída. Essa distinção é a coisa mais importante que existe sobre chain of thought, e é justamente a que quase todo mundo ignora. O raciocínio em passos não é uma janela para o que o modelo pensa. Ele é o pensamento — ou algo funcionalmente próximo o suficiente para valer a pena entender com precisão.

## O que um modelo faz quando "não pensa"

Um modelo de linguagem gera texto um token de cada vez. A cada passo, ele produz uma distribuição de probabilidade sobre o próximo token, condicionada a tudo que veio antes, e amostra dessa distribuição. Não há memória de trabalho separada, nem um rascunho interno oculto onde contas são feitas e depois apagadas. A única superfície onde o modelo pode "guardar" um resultado parcial é a própria sequência de tokens que ele já escreveu.

Isso tem uma consequência computacional dura. Cada token é produzido por uma quantidade fixa de profundidade de computação — o número de camadas do Transformer é constante, e a passagem para frente que gera um token atravessa sempre a mesma pilha de camadas. Se você pede a resposta final direto, você está exigindo que toda a cadeia de deduções necessárias caiba dentro dessa única passagem de profundidade fixa. Para problemas simples, cabe. Para problemas que exigem várias etapas encadeadas — aritmética com transporte de dígitos, uma inferência lógica com três premissas, um planejamento com dependências —, não cabe. O modelo é forçado a chutar o final antes de ter espaço para chegar até ele.

## Por que decompor funciona de verdade

Chain of thought resolve isso pela via mais direta possível: transforma computação em comprimento. Quando o modelo escreve os passos intermediários, cada passo vira texto no contexto, e cada token seguinte pode atender a esse texto. O resultado parcial da linha três está literalmente disponível como entrada para a linha quatro. O que antes precisaria acontecer dentro de uma única passagem agora se espalha por dezenas de passagens sucessivas, cada uma com seu próprio orçamento de computação.

É útil pensar nisso como a diferença entre resolver uma conta de cabeça e resolver no papel. O papel não te deixa mais inteligente. Ele te dá um lugar para descarregar estados intermediários para que você não precise segurar todos ao mesmo tempo. Um Transformer autorregressivo tem uma capacidade limitada de "segurar tudo ao mesmo tempo" dentro de uma passagem; o texto gerado é o papel. Formalmente, dá para argumentar que permitir passos intermediários amplia a classe de funções que o modelo consegue computar de maneira confiável, porque a profundidade efetiva do cálculo deixa de ser limitada pela profundidade da rede e passa a ser limitada pelo comprimento da geração.

Há um segundo efeito, mais estatístico. Decompor um problema em subpassos aproxima cada passo individual da distribuição de coisas que o modelo viu muitas vezes no treinamento. "Qual a raiz da equação" é um salto largo e raro. "Isole o termo, divida os dois lados, simplifique" são três movimentos comuns, cada um bem representado nos dados. O modelo é muito melhor em dar passos pequenos e frequentes do que saltos grandes e raros, e a cadeia converte o segundo no primeiro.

## O que isso não é

Aqui é onde o vocabulário engana. Chamamos de "raciocínio" e de "pensamento", e as palavras carregam bagagem que o mecanismo não tem.

Primeiro: a cadeia gerada não é necessariamente uma explicação fiel de por que o modelo chegou à resposta. O modelo pode produzir uma sequência de passos plausíveis e, ainda assim, a resposta final ter sido influenciada por fatores que não aparecem em lugar nenhum na cadeia. Existe pesquisa dedicada exatamente a medir essa infidelidade — casos em que você injeta uma pista no prompt, o modelo claramente usa a pista para decidir, e a cadeia inventa uma justificativa que não menciona a pista. A cadeia é uma racionalização gerada, não um log de execução. Tratá-la como prova do processo interno é um erro de categoria.

Segundo: mais passos não é sinônimo de mais correção. Um modelo pode raciocinar de forma longa, articulada e completamente errada, com cada passo herdando o erro do anterior. A cadeia dá espaço para o cálculo certo acontecer, mas não garante que aconteça. Ela também dá espaço para o modelo se convencer de uma bobagem com muito mais eloquência do que teria numa resposta curta.

Terceiro, e talvez o mais mal compreendido: não há um "eu" fazendo introspecção. Quando o modelo escreve "percebo que errei no passo anterior", isso não é um agente observando seu próprio estado mental. É o mesmo mecanismo de previsão de token operando sobre um contexto que agora contém um erro, e sequências que contêm erros frequentemente são seguidas, nos dados de treino, por correções. O modelo está completando um padrão textual de autocorreção, não exercendo metacognição. Que o resultado seja útil não muda o que ele é.

## Do truque de prompt ao objeto de treino

O ponto mais interessante é que chain of thought deixou de ser apenas uma tática de quem escreve o prompt e virou alvo direto de treinamento. Começou como uma descoberta quase acidental: bastava pedir os passos para a qualidade subir, sem tocar nos pesos. Mas se os passos ajudam, a pergunta natural é otimizar o modelo para produzir passos bons — e não apenas passos que parecem bons.

A virada conceitual é usar o resultado final como sinal. Em domínios onde dá para verificar a resposta de forma barata e objetiva — a conta bate, o código passa nos testes, a prova fecha —, você pode gerar muitas cadeias, ficar com as que levam à resposta certa e ajustar o modelo na direção delas. É aprendizado por reforço com uma recompensa baseada em verificação, e a cadeia se torna a variável que o modelo aprende a otimizar para maximizar acerto. O efeito é que as cadeias ficam mais longas, mais exploratórias, mais dispostas a recuar e tentar de novo — comportamentos que emergem porque ajudam a acertar, não porque alguém os escreveu num template.

Isso reforça a tese central em vez de contrariá-la. A cadeia continua não sendo introspecção. O que mudou é que ela virou o meio onde a computação acontece e, agora, o objeto que o treino molda. O "pensamento" do modelo é exatamente esse texto intermediário — reforçado, quando dá para verificar, pelo único juiz que importa nesses domínios: o resultado estava certo ou não.

## Minha posição

Acho que a metáfora do "pensamento" é ao mesmo tempo o que popularizou chain of thought e o que mais atrapalha quem tenta usá-lo bem. Ela sugere um processo interno confiável que a técnica simplesmente não entrega. O que a técnica entrega é mais concreto e mais respeitável: um jeito de converter computação sequencial em texto, driblando o limite de profundidade fixa de uma única passagem, e um substrato treinável onde acertar pode ser recompensado.

Na prática, isso pede duas disciplinas opostas. De um lado, aproveitar o mecanismo sem cerimônia — decompor, deixar o modelo escrever os passos, dar comprimento a problemas que exigem profundidade. Do outro, nunca confundir a cadeia com uma auditoria do raciocínio. Se você precisa de garantia, verifique o resultado, não a narrativa que levou até ele. A cadeia é onde o cálculo mora, não a confissão de como ele foi feito. Quem entende essa diferença extrai o que a técnica tem de melhor sem cair na ilusão que o nome dela convida.
