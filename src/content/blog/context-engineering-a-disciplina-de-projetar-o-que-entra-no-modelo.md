---
title: "Context engineering: a disciplina de projetar o que entra no modelo"
description: "Prompt é uma linha; context engineering é a arquitetura. Como projetar a janela do modelo: seleção, ordem, compressão e recuperação como engenharia."
pubDate: 2026-07-04
categorias:
  - IA
  - DevOps
focusKeyword: "context engineering"
metaTitle: "Context engineering: projetar o que entra no modelo"
metaDescription: "Além do prompt: seleção, ordem, compressão e recuperação. Por que montar o contexto certo é a disciplina de engenharia que define a qualidade da IA."
---

A qualidade de uma resposta de um modelo de linguagem é decidida antes de o modelo começar a gerar qualquer token. Ela é decidida no momento em que alguém monta a sequência de entrada — o que está lá, em que ordem, com que densidade, e o que ficou de fora. Prompt engineering, o ofício de escrever a instrução certa, é a camada visível dessa decisão. Context engineering é a camada de baixo: a disciplina de projetar toda a janela de contexto como um artefato de engenharia, não como um texto que se digita.

A distinção importa porque muda o objeto de trabalho. No prompt, você otimiza uma frase. No contexto, você projeta um pipeline que decide, a cada chamada, quais pedaços de informação — histórico, documentos, resultados de ferramentas, exemplos, esquemas, instruções — vão preencher um orçamento finito de tokens. É um problema de alocação de recursos escassos sob restrição dura. E, como todo problema de alocação, ele tem trade-offs que não desaparecem só porque a janela ficou maior.

## Por que o contexto é a variável de controle

Um Transformer não tem estado persistente entre chamadas. Cada requisição é, para o modelo, um começo do zero: ele vê a sequência de entrada e nada mais. Toda a "memória" que a aplicação parece ter — o que foi dito antes, o documento que o usuário anexou, o resultado da busca — existe porque alguém a recolocou na entrada. O contexto é, literalmente, o único canal pelo qual informação específica da tarefa chega ao modelo em tempo de inferência. Os pesos carregam conhecimento geral; o contexto carrega o caso concreto.

Isso faz do contexto a principal variável de controle de um sistema de IA em produção. Você não retreina o modelo a cada pergunta. Você monta um contexto diferente a cada pergunta. A engenharia está em fazer essa montagem de forma sistemática, reprodutível e observável — do jeito que se trata qualquer subsistema crítico.

## O mecanismo de atenção não trata todos os tokens igual

Há uma tentação de achar que, com janelas de contexto cada vez maiores, o problema virou trivial: basta jogar tudo dentro. Isso ignora como a atenção realmente funciona. O mecanismo de self-attention compara cada token com todos os outros, e o custo dessa operação cresce de forma quadrática com o comprimento da sequência. Contexto longo é caro em computação e latência, e esse custo não é linear.

Mais sutil que o custo é o efeito sobre a qualidade. A atenção distribui um orçamento finito de "peso" entre os tokens presentes. Quando você enfia dez documentos irrelevantes junto do relevante, o sinal que importa disputa espaço com ruído — e o modelo pode diluir a atenção que deveria ir para o trecho certo. A observação empírica, discutida amplamente na comunidade, é que a posição da informação dentro da janela afeta o quanto ela é de fato usada: material no início e no fim tende a ser melhor aproveitado que material soterrado no meio de um contexto muito longo. Não vou cravar um número aqui porque o efeito varia com modelo, tarefa e como a codificação posicional foi treinada. O ponto conceitual é sólido: ordem e posição são parâmetros de projeto, não detalhes cosméticos. Colocar a instrução crítica ou o documento decisivo em uma posição de destaque é uma decisão de engenharia.

## Recuperação: escolher o que entra

Se o contexto é finito e a posição importa, a primeira pergunta de engenharia é: o que colocar dentro? Essa é a função da recuperação. Em vez de despejar toda a base de conhecimento na janela, você indexa o material fora do modelo e, a cada consulta, seleciona apenas os trechos com maior probabilidade de serem úteis.

A abordagem mais difundida usa embeddings: cada trecho de texto vira um vetor, a consulta vira um vetor, e você recupera os trechos cujos vetores estão mais próximos no espaço semântico. Funciona, mas tem armadilhas que separam um protótipo de um sistema robusto. A granularidade do chunk — quão grande é cada pedaço indexado — define se você recupera contexto suficiente ou fragmentos sem sentido. Similaridade semântica não é o mesmo que relevância para a tarefa: dois textos podem ser parecidos e ambos inúteis. Por isso sistemas maduros combinam busca vetorial com busca lexical e, muitas vezes, uma etapa de reordenação que reavalia os candidatos com um modelo mais criterioso antes de decidir o que efetivamente entra na janela.

Recuperação bem-feita é onde context engineering encosta em recuperação de informação clássica. As perguntas são as mesmas de sempre — precisão, cobertura, ranqueamento — só que agora o consumidor final do resultado é um modelo generativo, não um humano lendo uma lista de links.

## Compressão: caber o que importa

Selecionar os trechos certos não basta se eles, somados ao histórico e às instruções, estouram o orçamento. Aí entra a compressão: reduzir o volume de tokens preservando o que é decisivo para a tarefa.

Compressão assume várias formas. A mais óbvia é a sumarização — condensar um documento longo ou uma conversa extensa em uma versão mais curta que retém os fatos que importam. Em agentes que rodam por muitos passos, é comum comprimir o histórico antigo em um resumo e manter apenas as trocas recentes em texto integral, para que a janela não cresça indefinidamente. Outra forma é estrutural: em vez de colar um JSON gigante devolvido por uma ferramenta, você extrai só os campos que a próxima etapa precisa. Toda compressão é uma aposta sobre o que será relevante depois. Comprimir cedo demais descarta informação que faria falta; comprimir de menos desperdiça espaço e atenção. Não existe compressão neutra — existe compressão bem calibrada para a tarefa.

## Montagem: ordem, formato e fronteiras

Escolhidos e comprimidos os pedaços, resta montá-los. É a etapa mais artesanal e a mais subestimada. A ordem em que instruções, documentos, exemplos e histórico aparecem muda o comportamento do modelo. A formatação — usar delimitadores claros, marcar onde começa e termina cada bloco, separar dados de instruções — reduz a chance de o modelo confundir conteúdo com comando, que é a raiz de muitos problemas de injeção de instrução.

As fronteiras entre blocos são parte do projeto. Um contexto onde o modelo consegue distinguir sem ambiguidade "isto é a pergunta do usuário", "isto é um documento recuperado", "isto é a saída de uma ferramenta" e "isto é a regra que você deve seguir" se comporta de forma mais previsível que um amontoado de texto concatenado. Delimitação explícita não é preciosismo estético; é o que dá ao modelo a estrutura para tratar cada parte pelo papel que ela cumpre.

## Por que isso é engenharia de sistemas, e não escrita

O que separa context engineering de "escrever um prompt melhor" é que a montagem do contexto deixa de ser um texto fixo e vira um programa. Numa aplicação séria, ninguém digita a janela à mão: um pipeline a constrói a cada requisição, puxando de várias fontes, aplicando recuperação, compressão e ordenação segundo regras. Esse pipeline tem entradas, tem estado, tem modos de falha e — se for feito direito — tem observabilidade. Você consegue inspecionar exatamente o que foi enviado ao modelo em cada chamada, medir o impacto de mudar a estratégia de recuperação, e tratar o contexto como código versionado, testado e monitorado.

É também onde ficam as falhas mais insidiosas. Contexto envenenado — um erro que entra no histórico e é reintroduzido a cada passo até contaminar todo o raciocínio. Contexto que estoura silenciosamente e faz o pipeline truncar o pedaço errado. Recuperação que traz o documento parecido mas errado. Nenhum desses problemas se resolve reescrevendo a instrução. Todos exigem tratar o contexto como um subsistema com seu próprio ciclo de projeto, teste e depuração.

## Minha posição

Context engineering é a disciplina que separa demonstrações de produtos. É fácil montar uma demo colando um documento no chat e obtendo uma resposta impressionante. É difícil construir um sistema que, a cada chamada, sob orçamento fixo de tokens, recupera o material certo, comprime o que precisa caber, ordena para maximizar aproveitamento e mantém fronteiras limpas entre dados e instruções — de forma reprodutível e observável.

Aposto que, à medida que os modelos-base convergem em capacidade bruta, a vantagem competitiva vai migrar da escolha do modelo para a qualidade do contexto que se entrega a ele. Janelas maiores não tornam essa disciplina obsoleta; ao contrário, ampliam o espaço de decisões ruins que se pode tomar. Quem trata o contexto como texto vai continuar depurando prompts no escuro. Quem trata o contexto como sistema — com pipeline, métricas e testes — vai construir coisas que funcionam quando a demo acaba e o tráfego real começa. A instrução é a ponta visível. O contexto é a engenharia de verdade.
