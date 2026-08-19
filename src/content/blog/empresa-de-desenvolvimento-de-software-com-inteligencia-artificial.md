---
title: "Empresa de desenvolvimento de software com inteligência artificial"
description: "Construir software com IA embarcada é outra disciplina de engenharia: o comportamento deixa de ser determinístico e o teste tradicional deixa de bastar."
pubDate: 2026-08-19
categorias:
  - IA
  - Tecnologia
focusKeyword: "empresa de desenvolvimento de software com inteligência artificial"
metaTitle: "Software com IA embarcada: o que muda na engenharia"
metaDescription: "Construir software com IA embarcada muda a engenharia: comportamento não determinístico, eval no ciclo, custo por token e contenção de alucinação."
faq:
  - q: "O que muda ao contratar uma empresa de desenvolvimento de software com inteligência artificial?"
    a: "Muda o critério de pronto. Em software tradicional, pronto é a suíte de testes passando com saídas exatas. Em software com IA embarcada, a saída é probabilística, então o critério passa a ser uma taxa de acerto medida sobre um conjunto de casos representativos, com um limite explícito de erro tolerado. Sem esse conjunto de casos construído antes do código, nenhuma versão pode ser comparada com a anterior."
  - q: "Por que testes automatizados tradicionais não bastam em produtos com LLM?"
    a: "Porque o teste tradicional compara a saída com um valor esperado, e um modelo de linguagem produz respostas diferentes para a mesma entrada. O que se testa deixa de ser a string e passa a ser a propriedade: a resposta cita uma fonte real, respeita o formato exigido, não afirma algo fora da base. Isso é avaliação (eval), não asserção de igualdade."
  - q: "Quanto custa manter um sistema de RAG atualizado?"
    a: "O custo não está na primeira indexação, está na manutenção. Documentos mudam, versões conflitam, conteúdo antigo continua recuperável e o sistema responde com informação obsoleta com a mesma confiança de sempre. Manter RAG é operar um pipeline contínuo de ingestão, versionamento e expurgo, com dono definido dentro da empresa."
  - q: "Latência e custo por token devem entrar na arquitetura desde o início?"
    a: "Sim. São restrições de projeto, não otimizações posteriores. O tamanho do contexto, o número de chamadas por interação e a escolha do modelo definem simultaneamente o tempo de resposta e o custo unitário. Descobrir isso depois do produto pronto costuma exigir refazer a arquitetura, não ajustar parâmetros."
  - q: "Como se versiona prompt, modelo e base de conhecimento sem quebrar o que já funcionava?"
    a: "Tratando os três como código versionado. O prompt de produção vive no repositório, a versão do modelo e os parâmetros ficam fixados explicitamente, e a base indexada tem snapshot datado. Cada alteração roda contra o mesmo conjunto de avaliação e a taxa nova é comparada com a anterior, com queda acima do limite acordado bloqueando o merge. Sem esse par versão-medida, ninguém consegue dizer se a regressão veio da frase trocada no prompt, do modelo atualizado ou de um documento novo na base."
---

Uma **empresa de desenvolvimento de software com inteligência artificial** não é uma fábrica de software que passou a usar modelos. A diferença é de natureza: o artefato entregue deixou de ter comportamento fixo. Software convencional é uma máquina de estados que você especifica, testa contra saídas exatas e considera pronto quando a suíte fica verde. Software com um modelo de linguagem no caminho crítico produz saídas diferentes para a mesma entrada, degrada silenciosamente quando o fornecedor atualiza o modelo e falha de formas que nenhum caso de teste antecipou. Quem trata isso como "mais uma integração de API" descobre o problema em produção.

A mudança é de engenharia, não de prompt, e duas consequências puxam todas as outras. O critério de pronto deixa de ser a asserção de igualdade e vira uma taxa de acerto medida sobre casos representativos, com limite explícito de erro tolerado — o que arrasta avaliação sistemática para dentro do ciclo de desenvolvimento, no lugar que o teste automatizado ocupa hoje. E alucinação deixa de ser defeito à espera de correção numa versão futura para virar um modo de falha permanente que o produto precisa conter, porque o modelo sozinho não contém.

## O código continua determinístico, o produto não

Vale ser preciso sobre onde mora a indeterminação, porque o mal-entendido gera arquitetura ruim. Seu código continua determinístico. O que não é determinístico é uma função específica dentro dele — a chamada ao modelo — cujo domínio de saída é, na prática, todo o espaço de textos possíveis. Você pode fixar temperatura em zero e ainda assim ver variação entre execuções, entre versões de modelo e entre pequenas mudanças de contexto que pareciam irrelevantes.

A consequência arquitetural é que essa função precisa ser tratada como fronteira de confiança, do mesmo modo que se trata entrada de usuário. Nenhum engenheiro sênior escreve uma query concatenando texto vindo do navegador sem validação. Mas é comum ver saída de LLM sendo passada direto para uma chamada de API, um `eval`, uma escrita em banco ou uma resposta ao cliente final sem nenhuma camada de verificação no meio. **O modelo é uma fonte não confiável dentro do seu próprio sistema**, e a arquitetura tem que refletir isso: schema validado na saída, validação semântica onde o schema não alcança, e um caminho de degradação definido para quando a validação falha.

Isso vale com força redobrada quando o modelo não apenas responde, mas age. Sistemas que fecham o ciclo entre decidir e executar — o assunto de [agentes de IA e o loop de planejamento](/agentes-de-ia-do-prompt-unico-ao-loop-de-planejamento/) — compõem erro a cada passo. Uma taxa de acerto que parece excelente numa resposta isolada vira uma taxa de conclusão medíocre quando encadeada dez ou vinte vezes. Encurtar horizontes e verificar entre passos não é conservadorismo, é aritmética.

## Sua suíte de testes vira um detector que nunca dispara

O teste unitário clássico compara valores. Com IA embarcada, comparar strings não funciona: a resposta correta pode ser escrita de dez maneiras, e a resposta errada pode ser sintaticamente idêntica à certa em tudo, menos no fato relevante. Times que insistem no modelo antigo caem em um de dois extremos. Ou congelam a saída esperada e passam a receber falhas em toda execução, até que alguém desliga o teste. Ou testam apenas que a chamada retornou 200, o que equivale a não testar nada.

A substituição correta é testar propriedades, não valores. A resposta respeita o schema? Cita apenas fontes que existem no contexto fornecido? Recusa quando deveria recusar? Mantém o idioma pedido? Fica abaixo do limite de tokens? Cada uma dessas perguntas vira uma verificação executável sobre um conjunto de casos, e o resultado agregado — a taxa — é o que se compara entre versões. É aqui que a maioria dos projetos falha antes de nascer: sem um conjunto de casos representativos construído com quem entende do domínio, não existe régua, e sem régua qualquer mudança de prompt é uma aposta.

## Avaliação não é fase de QA, é o ciclo de desenvolvimento

Eval precisa estar no lugar que os testes automatizados ocupam hoje: rodando a cada alteração, bloqueando merge quando a taxa cai, versionado junto com o código. Trocar uma frase do prompt do sistema, incluir mais um documento na base, migrar de um modelo para outro mais barato — qualquer uma dessas ações pode melhorar um caso de uso e piorar três, e sem medição ninguém percebe até o cliente reclamar.

Duas advertências práticas, porque o tema está cercado de mitologia. A primeira é que benchmark público não é eval do seu produto. Um modelo bem posicionado numa tabela genérica pode ter desempenho ruim exatamente no seu domínio, e as tabelas carregam problemas conhecidos — contaminação de dados de treino, otimização para o teste, medida que não se traduz em utilidade. Vale entender [como se avalia um LLM e onde os benchmarks falham](/como-se-avalia-um-llm-benchmarks-falhas-e-contaminacao/) antes de escolher modelo por ranking. A segunda é que usar outro modelo como juiz automático é útil e enviesado ao mesmo tempo: o juiz tem preferências próprias, favorece respostas longas e educadas, e precisa ser calibrado contra julgamento humano em uma amostra. Eval barato demais mede a coisa errada com muita precisão.

## RAG é um sistema de manutenção de conhecimento fantasiado de funcionalidade

Recuperar documentos e injetá-los no contexto é a técnica padrão para dar informação atualizada e proprietária ao modelo, e a demo dela é fácil. Indexar uma pasta de PDFs, gerar embeddings, responder perguntas — isso se monta em dias. O custo real aparece depois, e é operacional. A base muda. Versões antigas continuam indexadas e recuperáveis. Dois documentos se contradizem e o sistema escolhe o errado com convicção. Alguém publica uma política nova e ninguém removeu a anterior, então o produto passa a responder de acordo com uma regra revogada.

Manter [RAG funcionando de verdade](/rag-como-dar-conhecimento-atualizado-a-um-llm/) exige pipeline de ingestão contínua, política de versionamento, expurgo do que saiu de validade, reindexação quando o modelo de embedding muda e monitoramento de qualidade de recuperação separado da qualidade de geração — porque quando a resposta sai errada, é preciso saber se o problema foi o trecho recuperado ou o que o modelo fez com ele. Nada disso é opcional, e quase nada disso aparece em proposta comercial. **Se ninguém foi nomeado dono da base de conhecimento, o sistema tem prazo de validade curto.** Entender [o que embeddings e busca vetorial realmente medem](/embeddings-e-busca-vetorial-a-matematica-do-significado/) ajuda a calibrar a expectativa: proximidade semântica não é relevância, e trechos parecidos com a pergunta nem sempre são os que a respondem.

## Latência e custo por token são requisitos, não detalhes de implementação

Em software tradicional, otimização prematura é vício. Em software com IA, ignorar consumo é irresponsabilidade de projeto, porque as decisões que definem custo e tempo de resposta são estruturais e caras de reverter. Quantas chamadas ao modelo cada interação dispara? Quanto contexto é enviado a cada chamada, e quanto dele é recarregado desnecessariamente? A tarefa exige o modelo mais capaz ou um modelo menor resolve com uma verificação em cima? Existe cache para o que se repete?

O erro típico é dimensionar tudo pelo caso mais difícil. Uma arquitetura que manda todas as requisições para o modelo mais caro porque uma minoria delas é complexa paga o preço do pior caso sobre o volume inteiro: o custo unitário do produto passa a ser o custo da exceção, e quanto mais o uso cresce, mais essa escolha pesa na margem. O caminho é rotear: classificar a dificuldade antes, resolver o trivial com o barato, escalar para o caro quando necessário e medir a taxa de acerto de cada rota separadamente. Isso é decisão de arquitetura, tomada cedo, com número na mão — e é um dos pontos onde se separa quem já levou IA a produção de quem montou provas de conceito.

## Alucinação é modo de falha conhecido, e conter é trabalho do produto

Modelos de linguagem produzem afirmações falsas com a mesma fluência com que produzem verdadeiras, e isso é consequência de como funcionam, não defeito a ser corrigido em uma versão futura. As [causas da alucinação e o que efetivamente reduz o problema](/alucinacoes-por-que-a-ia-inventa-e-o-que-reduz-isso/) já são razoavelmente compreendidas, mas nenhuma técnica leva a taxa a zero. Engenharia madura parte disso como premissa e projeta contenção.

Conter significa decidir, por caso de uso, qual é o custo de uma resposta errada e desenhar a barreira proporcional. Onde o erro é barato, basta sinalizar incerteza e oferecer a fonte. Onde o erro é caro — informação clínica, jurídica, financeira, qualquer coisa que vire ação irreversível — a arquitetura precisa restringir o espaço de saída: respostas ancoradas em trecho recuperado com citação verificável, validação determinística contra o sistema de registro, recusa explícita fora do escopo e revisão humana no ponto exato onde ela muda o desfecho. Interface também é contenção: um produto que apresenta a saída do modelo como fato consumado ensina o usuário a não conferir, e transfere para ele um risco que a engenharia decidiu não assumir.

## Sem rastro de prompt, não existe diagnóstico

A observabilidade que o time já tem — log de requisição, métrica de latência, rastreamento distribuído — não responde à pergunta que mais importa nesses sistemas: por que essa resposta específica saiu assim. Responder exige guardar o prompt final montado, os trechos recuperados e seus identificadores, a versão do modelo e dos parâmetros, a saída bruta antes de qualquer pós-processamento e o resultado das validações. Sem isso, cada incidente vira arqueologia, e a correção vira tentativa.

Esse registro tem uma segunda função, mais valiosa que o debug: alimentar o conjunto de avaliação. Cada falha real vira caso de teste, e o eval deixa de ser um retrato do que os engenheiros imaginaram para virar um retrato do que os usuários fazem. É esse laço — falha capturada, caso adicionado, regressão bloqueada — que faz o sistema melhorar de forma acumulativa, em vez de oscilar a cada ajuste de prompt. E ele precisa nascer com controle de acesso e política de retenção, porque prompts em produção contêm dado de cliente.

## A demo mede o teto, produção vive no piso

O padrão que se repete em quase todo projeto de IA que trava: a demonstração funcionou porque alguém escolheu os exemplos, e a produção falhou porque os usuários escolhem os deles. Demo mede capacidade máxima em condição favorável. Produção mede a garantia mínima sob entrada adversarial, base desatualizada, pico de tráfego e modelo que mudou de comportamento sem aviso na semana passada.

A distância entre os dois é preenchida por trabalho pouco vistoso, e ele tem nome: conjunto de avaliação com casos difíceis, versionado junto do código e rodando a cada alteração; pipeline de conhecimento com dono nomeado e política de expurgo; roteamento por custo com taxa de acerto medida rota a rota; contenção proporcional ao custo do erro em cada caso de uso; rastro de execução completo, com retenção e controle de acesso definidos. É essa a lista que precisa estar montada antes de o produto encontrar usuário de verdade.

Montada ou não, ela decide o comportamento do sistema no sexto mês. Sem eval versionado, o fornecedor do modelo publica uma atualização e a queda de qualidade só aparece quando alguém reclama. Sem dono da base, o conteúdo envelhece e o produto passa a responder com convicção a partir de regra revogada. Sem roteamento medido, o custo unitário sobe sem que ninguém perceba até a fatura. Sem rastro, cada incidente vira arqueologia e a correção vira chute. Um sistema com IA embarcada não se mantém sozinho: ou a degradação é detectável e corrigível por construção, ou ela acontece em silêncio, do lado do usuário, antes de aparecer para o time.

---

Se você está estruturando um produto com IA embarcada e quer a arquitetura, a régua de avaliação e a contenção de falha definidas antes da primeira linha de código, esse desenho técnico é o trabalho que faço pelo Grupo WYS, junto do time que vai construir. Para tratar do seu caso, [conversar sobre a arquitetura do seu projeto](/contato/) é o caminho — e se o time ainda precisa alinhar vocabulário antes dessa conversa, o [glossário de IA](/glossario-de-ia/) cobre os termos que ela exige.
