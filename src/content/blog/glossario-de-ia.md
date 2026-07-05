---
title: "Glossário de IA: os termos que definem a nova era, sem jargão"
description: "Glossário com 56 termos de IA explicados sem jargão: de token e Transformer a RAG, agentes e prompt injection, com links para os artigos profundos do blog."
pubDate: 2026-07-05
categorias:
  - IA
  - Tecnologia
focusKeyword: "glossário de IA"
metaTitle: "Glossário de IA: os termos da nova era, sem jargão"
metaDescription: "56 termos de IA explicados sem jargão: token, Transformer, RAG, agentes, RLHF, prompt injection e mais. Referência rápida com links para artigos profundos."
---

Todo texto sobre IA hoje assume que você já sabe o que é um token, por que RAG importa e qual a diferença entre fine-tuning e RLHF. Este glossário resolve isso: 56 termos explicados em uma a três frases, sem jargão circular e sem exigir que você entenda um termo para decifrar outro.

Use como referência rápida: Ctrl+F no termo que travou sua leitura, leia a definição, volte ao que estava fazendo. Quando um termo tem artigo profundo aqui no blog, a definição linka direto — a versão curta está aqui, a versão completa está a um clique.

Os blocos seguem uma lógica: fundamentos primeiro, depois como os modelos são construídos, treinados e servidos, e por fim aplicações, riscos e avaliação.

## Fundamentos

**IA generativa** — categoria de sistemas que criam conteúdo novo — texto, imagem, áudio, código — em vez de apenas classificar ou prever rótulos. A diferença para o software tradicional: a saída não foi programada por ninguém, é produzida na hora.

**LLM (Large Language Model)** — modelo de linguagem de grande porte, treinado sobre volumes gigantescos de texto para prever a continuação mais provável de uma sequência. Dessa tarefa aparentemente simples emergem tradução, resumo, código e conversa. Para ver onde a fronteira está agora, veja [o que a Anthropic lançou com o Claude Fable 5 e o Mythos 5](/claude-fable-5-e-mythos-5-o-que-a-anthropic-lancou/).

**Prompt** — o texto que você envia ao modelo: pergunta, instrução, contexto, exemplos. A qualidade da saída depende diretamente dele — há uma [biblioteca de prompts para trabalho real](/biblioteca-de-prompts-para-trabalho-real/) nesta mesma seção.

**System prompt** — instrução que o operador do sistema define antes de qualquer mensagem do usuário: papel, regras, limites, tom. É o que faz o mesmo modelo se comportar como atendente de suporte em um produto e como tutor de matemática em outro.

**Token** — a unidade mínima de texto que o modelo lê e escreve: pedaços de palavra, palavras curtas inteiras, pontuação. Em português, um token corresponde a algo entre 3 e 4 caracteres; uma página de texto tem por volta de 500 tokens. Preço, velocidade e limite de contexto — tudo se mede em tokens.

**Janela de contexto** — o total de tokens que o modelo consegue considerar de uma só vez: suas instruções, os documentos anexados e a resposta em construção. O que passa do limite simplesmente não é visto. As [técnicas por trás das janelas de 1 milhão de tokens](/janelas-de-contexto-de-1-milhao-de-tokens-as-tecnicas/) e [o que um modelo faz com contexto desse tamanho](/1-milhao-de-tokens-o-que-o-fable-5-faz-com-contexto-gigante/) têm artigos próprios.

**Parâmetros** — os números internos ajustados durante o treinamento, que codificam tudo o que o modelo "sabe". Modelos de fronteira têm centenas de bilhões deles.

**Pesos** — o valor concreto de cada parâmetro depois do treinamento; o arquivo de pesos *é* o modelo. Quando alguém diz que um modelo é "aberto", quer dizer que os pesos podem ser baixados e executados por qualquer pessoa.

**Embedding** — representação de um texto (ou imagem) como uma lista de números, construída de modo que proximidade numérica signifique proximidade de significado. É a base da [busca por significado em vez de palavra exata](/embeddings-e-busca-vetorial-a-matematica-do-significado/).

**Multimodal** — modelo que entende e/ou gera mais de um tipo de mídia: texto, imagem, áudio, vídeo. [Como a IA processa tudo isso no mesmo cérebro](/modelos-multimodais-como-a-ia-entende-imagem-texto-e-audio/) está explicado em detalhe.

**SLM (Small Language Model)** — modelo pequeno o bastante para rodar em um notebook ou celular, projetado para eficiência. Em tarefas específicas, resolve tão bem quanto um gigante custando uma fração — [o futuro também é pequeno](/small-language-models-por-que-o-futuro-tambem-e-pequeno/).

**AGI (Inteligência Artificial Geral)** — sistema hipotético capaz de realizar qualquer tarefa cognitiva no nível de um humano competente, sem ser especializado em nada. Não existe; é o objetivo declarado dos grandes laboratórios.

**ASI (Superinteligência Artificial)** — o degrau acima da AGI: um sistema que supera os melhores humanos em praticamente todos os domínios. [O que isso significa e por que o debate é sério](/superinteligencia-artificial-asi/).

**Não-computabilidade** — a classe de problemas que nenhum algoritmo consegue resolver, provada matematicamente há quase um século. Vale para qualquer IA, por mais avançada — [o limite que nenhuma inteligência artificial vai ultrapassar](/nao-computabilidade-o-limite-que-nenhuma-inteligencia-artificial-vai-ultrapassar/).

## Arquitetura de modelos

**Transformer** — a arquitetura de rede neural que viabilizou os LLMs modernos, publicada em 2017. Sua vantagem decisiva: processar todos os tokens de uma sequência em paralelo, relacionando cada um com todos os outros. [Como a atenção realmente funciona](/transformers-como-a-atencao-realmente-funciona/) abre a máquina por dentro.

**Atenção** — o mecanismo central do Transformer: para cada token, o modelo calcula quanto cada outro token da sequência pesa na sua interpretação. É o que permite entender que, em "o banco recusou o empréstimo", "banco" não é um assento — [a explicação completa está aqui](/transformers-como-a-atencao-realmente-funciona/).

**Mixture-of-Experts (MoE)** — arquitetura que divide o modelo em vários "especialistas" e ativa só uma fração deles para cada token, cortando o custo de computação sem reduzir o conhecimento total. [Por que os modelos ativam só uma fração](/mixture-of-experts-por-que-os-modelos-ativam-so-uma-fracao/).

**Modelo de espaço de estados (SSM)** — família de arquiteturas alternativas ao Transformer (Mamba é o exemplo mais citado) que processa a sequência mantendo um estado comprimido, com custo que cresce de forma linear em vez de quadrática com o tamanho do texto. [A alternativa ao Transformer, explicada](/modelos-de-espaco-de-estados-mamba-a-alternativa-ao-transformer/).

**Modelo de difusão** — a arquitetura por trás dos geradores de imagem: aprende a transformar ruído puro em imagem coerente, removendo o ruído passo a passo. [A matemática por trás da geração de imagens](/modelos-de-difusao-a-matematica-por-tras-da-geracao-de-imagens/).

## Treinamento e alinhamento

**Treinamento** — o processo de ajustar os parâmetros expondo o modelo a dados e corrigindo seus erros, repetido em escala massiva. É a fase cara: semanas ou meses de milhares de GPUs trabalhando em conjunto.

**Pré-treino** — a primeira e maior etapa do treinamento: o modelo consome trilhões de tokens de internet, livros e código, aprendendo apenas a prever a continuação do texto. É de onde vem o conhecimento geral — e também os vieses dos dados.

**Fine-tuning** — a etapa seguinte: ajustar um modelo já pré-treinado com um conjunto menor e específico de dados, para especializá-lo em um comportamento — seguir instruções, dominar um domínio, adotar um tom.

**LoRA** — técnica de fine-tuning eficiente: em vez de reajustar bilhões de parâmetros, treina pequenas matrizes adicionais acopladas ao modelo congelado. Resultado parecido, custo ordens de grandeza menor — [fine-tuning sem retreinar o modelo inteiro](/lora-e-peft-fine-tuning-sem-retreinar-o-modelo-inteiro/).

**RLHF** — aprendizado por reforço com feedback humano: pessoas comparam respostas do modelo e essas preferências viram sinal de treino. Foi o que transformou preditores de texto brutos em assistentes úteis — [como o feedback humano molda um modelo](/rlhf-como-o-feedback-humano-molda-um-modelo/).

**Alinhamento** — o esforço de fazer o modelo se comportar conforme as intenções humanas: ser útil, honesto e inofensivo, inclusive em situações que o treino não previu. RLHF e Constitutional AI são técnicas de alinhamento.

**Constitutional AI** — método da Anthropic em que o modelo critica e revisa as próprias respostas seguindo uma lista escrita de princípios (a "constituição"), reduzindo a dependência de avaliadores humanos. [Alinhamento com menos humano no loop](/constitutional-ai-e-rlaif-alinhamento-com-menos-humano/).

**Dados sintéticos** — dados de treino gerados por um modelo para treinar outro (ou ele mesmo). Resolvem a escassez de dados humanos de qualidade, mas criam riscos próprios — [treinar IA com dados de IA](/dados-sinteticos-treinar-ia-com-dados-de-ia/).

**Leis de escala** — relações empíricas que preveem quanto um modelo melhora ao aumentar parâmetros, dados e computação. Guiam decisões de bilhões de dólares — [o que Chinchilla ensinou](/leis-de-escala-o-que-chinchilla-ensinou/) sobre o equilíbrio entre tamanho do modelo e volume de dados.

## Inferência e custo

**Inferência** — o uso do modelo depois de pronto: cada resposta que você recebe é uma inferência. O treino é custo único; a inferência é o custo recorrente que domina a conta de quem opera IA em produção.

**Latência** — o tempo entre enviar o prompt e receber a resposta. Na prática se divide em duas medidas: tempo até o primeiro token (a sensação de velocidade) e tokens gerados por segundo (a velocidade real da resposta).

**Custo por token** — o modelo de preço das APIs: cobrança por milhão de tokens, com entrada geralmente mais barata que saída. Conta didática: a US$ 3 por milhão de tokens de entrada, processar um documento de 100 mil tokens custa US$ 0,30 por chamada — e 1.000 chamadas por dia custam US$ 300 diários só de entrada.

**Temperatura** — parâmetro que controla o quanto o modelo arrisca a cada escolha de token: perto de zero, escolhe quase sempre a opção mais provável (saída consistente e repetível); mais alta, distribui as apostas (saída variada e criativa).

**Quantização** — comprimir os pesos usando números de menor precisão (de 16 bits para 8 ou 4), cortando memória e custo com perda pequena de qualidade. É o que permite [rodar modelos gigantes em hardware modesto](/quantizacao-de-llms-rodar-modelos-gigantes-em-hardware-modesto/).

**KV cache** — memória que guarda os cálculos de atenção já feitos para não refazê-los a cada token novo gerado. Cresce junto com o contexto e é [o gargalo de memória que define o custo da inferência](/kv-cache-o-gargalo-de-memoria-que-define-o-custo-da-inferencia/).

**Speculative decoding** — um modelo pequeno e rápido "chuta" os próximos tokens e o modelo grande apenas verifica os chutes em lote. Quando o pequeno acerta bastante, a geração [acelera sem perder qualidade](/speculative-decoding-acelerar-a-geracao-sem-perder-qualidade/).

**Test-time compute** — dar mais computação ao modelo na hora da resposta, e não só no treino, deixando-o explorar caminhos antes de concluir. [Por que pensar mais melhora a resposta](/test-time-compute-por-que-pensar-mais-melhora-a-resposta/).

## Agentes e aplicações

**Raciocínio** — a capacidade de encadear passos lógicos até uma conclusão, em vez de responder por reflexo. Nos LLMs é um comportamento induzido, com limites reais — [o que a arquitetura atual não resolve](/os-limites-dos-llms-o-que-a-arquitetura-atual-nao-resolve/).

**Chain-of-thought** — técnica de fazer o modelo escrever o passo a passo antes da resposta final, o que melhora visivelmente tarefas de lógica e matemática. [Como os modelos pensam antes de responder](/chain-of-thought-como-os-modelos-pensam-antes-de-responder/).

**Reasoning model** — modelo treinado explicitamente para raciocinar: gera uma longa cadeia interna de pensamento antes de responder, gastando mais tokens para errar menos. [Quando o raciocínio vira treino explícito](/reasoning-models-quando-o-raciocinio-vira-treino-explicito/).

**Agente** — sistema em que o LLM não apenas responde, mas age: planeja, usa ferramentas, observa o resultado e decide o próximo passo em loop, até concluir a tarefa. [Do prompt único ao loop de planejamento](/agentes-de-ia-do-prompt-unico-ao-loop-de-planejamento/).

**Tool use / function calling** — a capacidade do modelo de acionar ferramentas externas — buscar na web, consultar um banco de dados, rodar código — devolvendo uma chamada estruturada em vez de texto livre. [Como modelos operam ferramentas](/tool-use-e-function-calling-como-modelos-operam-ferramentas/).

**Memória de agente** — os mecanismos que permitem a um agente reter informação entre sessões, já que o modelo em si esquece tudo ao fim de cada conversa: anotações persistentes, resumos, bases vetoriais. [Como a IA lembra entre sessões](/memoria-de-agentes-como-a-ia-lembra-entre-sessoes/).

**RAG (Retrieval-Augmented Generation)** — arquitetura que busca trechos relevantes em uma base externa e os injeta no prompt antes de o modelo responder. É o caminho padrão para [dar conhecimento atualizado e privado a um LLM](/rag-como-dar-conhecimento-atualizado-a-um-llm/) sem retreiná-lo.

**Busca vetorial** — busca que compara embeddings em vez de palavras: encontra "reembolso de passagem" quando você procura "devolução de bilhete". [A matemática do significado](/embeddings-e-busca-vetorial-a-matematica-do-significado/) que sustenta quase todo RAG.

**GraphRAG** — evolução do RAG que organiza o conhecimento em um grafo de entidades e relações, permitindo responder perguntas que exigem conectar fatos espalhados por vários documentos. [Além da busca por similaridade](/graphrag-e-rag-avancado-alem-da-busca-por-similaridade/).

**Context engineering** — a disciplina de decidir o que entra na janela de contexto — instruções, documentos, histórico, ferramentas — e, tão importante quanto, o que fica de fora. Sucedeu o "prompt engineering" como habilidade central de quem constrói com IA: [a disciplina de projetar o que entra no modelo](/context-engineering-a-disciplina-de-projetar-o-que-entra-no-modelo/).

## Riscos e segurança

**Alucinação** — quando o modelo afirma com total confiança algo falso: cita estudo inexistente, inventa número, cria URL. Não é bug ocasional; é consequência direta de como ele funciona — [por que a IA inventa e o que reduz isso](/alucinacoes-por-que-a-ia-inventa-e-o-que-reduz-isso/).

**Jailbreak** — técnica para fazer o modelo ignorar suas regras de segurança e produzir o que normalmente recusaria, em geral via manipulação criativa do prompt — encenações, hipóteses, instruções aninhadas. [Como esses ataques funcionam na prática](/red-teaming-e-jailbreaks-como-se-testa-a-seguranca-de-um-modelo/).

**Prompt injection** — ataque em que instruções maliciosas escondidas em conteúdo externo — uma página web, um e-mail, um PDF — sequestram o comportamento do modelo que lê aquele conteúdo. É o risco número um para agentes que navegam e processam dados de terceiros.

**Red-teaming** — a prática de atacar deliberadamente o próprio modelo antes do lançamento para encontrar falhas que um adversário real exploraria. [Como se testa a segurança de um modelo](/red-teaming-e-jailbreaks-como-se-testa-a-seguranca-de-um-modelo/).

**Guardrails** — camadas de proteção em volta do modelo: filtros de entrada e saída, regras de bloqueio, validações. Complementam o alinhamento, que age por dentro; guardrails agem por fora.

**Interpretabilidade** — o campo que tenta entender o que acontece dentro do modelo: quais estruturas internas produzem qual comportamento. Hoje os LLMs são caixas-pretas até para quem os criou — [abrindo a caixa-preta dos LLMs](/interpretabilidade-mecanicista-abrindo-a-caixa-preta-dos-llms/).

## Avaliação

**Benchmark** — conjunto padronizado de tarefas com respostas conhecidas, usado para medir e comparar modelos. Útil como régua, mas cada vez menos confiável sozinho — [benchmarks, falhas e contaminação](/como-se-avalia-um-llm-benchmarks-falhas-e-contaminacao/).

**Contaminação de dados** — quando as perguntas do benchmark vazaram para os dados de treino: o modelo não resolve o teste, lembra dele. Infla notas e é [um dos maiores problemas da avaliação de LLMs](/como-se-avalia-um-llm-benchmarks-falhas-e-contaminacao/).

**Evals** — avaliações contínuas construídas sobre os *seus* casos de uso, não sobre testes genéricos. É o que separa "o modelo parece bom" de "o modelo resolve o meu problema em X% dos casos".

**LLM como juiz** — usar um modelo para avaliar as respostas de outro em escala, seguindo critérios definidos. Barateia a avaliação, mas herda os vieses do juiz — por isso exige calibração contra julgamento humano.

---

Cinquenta e seis termos não esgotam o campo, mas cobrem o vocabulário que sustenta praticamente toda conversa séria sobre IA hoje. Guarde a página, use o Ctrl+F sem culpa e, quando um termo pedir profundidade, siga o link — cada artigo profundo existe exatamente para isso.

Se o seu trabalho também envolve conteúdo e tráfego, o [glossário de SEO](/glossario-de-seo/) desta mesma série faz o mesmo serviço para o vocabulário de busca.
