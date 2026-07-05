---
title: "Biblioteca de prompts para trabalho real com IA"
description: "Biblioteca com 12 prompts prontos e copiáveis para trabalho real: estratégia, conteúdo, SEO, análise e revisão. É copiar, preencher e usar."
pubDate: 2026-07-05
categorias:
  - IA
  - Negócios
focusKeyword: "prompts prontos"
metaTitle: "Biblioteca de prompts prontos para trabalho real com IA"
metaDescription: "12 prompts prontos para copiar: análise de concorrência, pauta editorial, SEO, decisão e revisão. Com a anatomia do prompt que funciona."
---

Prompt genérico gera resposta genérica. A diferença entre uma IA que devolve texto de enchimento e uma que produz trabalho aproveitável quase nunca está no modelo — está no que você escreveu antes de apertar Enter.

Esta página é uma biblioteca de 12 prompts prontos para tarefas profissionais reais: análise de concorrência, pauta editorial, SEO, decisão, revisão, reputação. Todos seguem a mesma anatomia e funcionam em qualquer assistente atual. O uso é direto: copie o bloco de código, substitua os trechos em [COLCHETES] pelos seus dados e cole na conversa. Quanto melhor o material fornecido, melhor a saída — e trate cada prompt como ponto de partida: rode, avalie, ajuste os critérios, rode de novo.

## Anatomia de um prompt que funciona

Todos os prompts desta biblioteca têm as mesmas cinco peças. Ao montar os seus, confira se nenhuma ficou de fora:

- **Papel** — quem a IA deve ser ("você é um editor exigente"). Define vocabulário, postura e profundidade.
- **Contexto** — sua empresa, seu público, a situação e o material de trabalho. É a peça que mais gente pula e a que mais muda o resultado.
- **Tarefa** — o verbo e o entregável, em uma frase. "Analise", "escreva", "compare" — nunca "me ajude com".
- **Formato de saída** — a estrutura exata da resposta: tabela, lista numerada, seções. Sem isso, você recebe redação de vestibular.
- **Critérios** — as regras do jogo: o que é proibido, o que desempata, quando admitir que falta informação. É o que separa resposta segura de resposta útil.

Se algum termo do mundo da IA travar a leitura (contexto, token, alucinação), o [glossário de IA](/glossario-de-ia/) resolve.

## Estratégia e posicionamento

Prompts para as conversas que definem para onde o trabalho vai — antes de produzir qualquer coisa.

### 1. Análise de concorrência

Use quando precisar transformar pesquisa solta sobre concorrentes em leitura estratégica comparável.

```
Você é um estrategista de mercado com experiência em [SETOR].

Contexto: minha empresa é [DESCRIÇÃO EM 1-2 FRASES], atende [PÚBLICO] e compete com [CONCORRENTE 1], [CONCORRENTE 2] e [CONCORRENTE 3]. Abaixo, informações públicas sobre cada um (site, preços, posicionamento):

[COLE AS INFORMAÇÕES DOS CONCORRENTES]

Tarefa: produza uma análise comparativa entre minha empresa e esses concorrentes.

Formato de saída:
1. Tabela comparativa: proposta de valor, público-alvo, faixa de preço, canais principais, diferencial declarado.
2. Para cada concorrente, 2 pontos fortes e 2 vulnerabilidades exploráveis.
3. Três oportunidades de posicionamento que ninguém ocupa hoje, ordenadas por facilidade de execução.

Critérios: use apenas as informações coladas; onde faltar dado, escreva "não informado" em vez de supor. Cada oportunidade precisa citar qual lacuna dos dados a justifica.
```

### 2. Proposta de valor e posicionamento

Use quando a descrição da sua empresa soa igual à de todo mundo e você precisa de opções concretas.

```
Você é um consultor de posicionamento de marca.

Contexto: [EMPRESA] vende [PRODUTO/SERVIÇO] para [PÚBLICO]. Hoje nos descrevemos assim: "[DESCRIÇÃO ATUAL]". Nossos diferenciais reais: [DIFERENCIAL 1], [DIFERENCIAL 2], [DIFERENCIAL 3]. O principal concorrente se posiciona como: [POSICIONAMENTO DO CONCORRENTE].

Tarefa: gere 5 propostas de valor (1 frase cada, máximo 20 palavras) e desenvolva a mais forte em 1 parágrafo de posicionamento.

Formato de saída: lista numerada com as 5 frases; parágrafo da vencedora; 1 linha explicando por que ela vence as outras quatro.

Critérios: proibido "soluções", "inovador", "referência" e superlativo vazio. Cada frase deve deixar claro para quem é e o que muda para o cliente. Se algum diferencial citado não diferencia nada, aponte antes de responder.
```

### 3. Brief de campanha

Use antes de envolver agência, freelancer ou time interno em qualquer campanha com verba.

```
Você é um planner sênior de agência.

Contexto: campanha para [PRODUTO/SERVIÇO], objetivo de [OBJETIVO MENSURÁVEL], verba de [VALOR], duração de [PERÍODO], canais disponíveis: [CANAIS]. Público: [DESCRIÇÃO DO PÚBLICO]. Restrições: [RESTRIÇÕES].

Tarefa: escreva o brief completo desta campanha para alinhar time interno e fornecedores.

Formato de saída, em seções: objetivo mensurável; público e insight central; mensagem única (1 frase); 2 conceitos criativos; plano por canal com o papel de cada um; entregáveis com prazos relativos (semana 1, 2...); métricas e metas; riscos e plano B.

Critérios: o insight deve ser específico deste público, não um lugar-comum. Toda meta numérica deriva da verba e do objetivo informados — mostre a conta. Se faltar dado para alguma seção, liste as perguntas que preciso responder.
```

## Criação de conteúdo

O gargalo quase nunca é redigir; é decidir o que escrever e apurar o material.

### 4. Pauta editorial mensal

Use no fim do mês, quando a pergunta "sobre o que postar?" trava a produção.

```
Você é um editor-chefe com experiência em conteúdo para [SETOR].

Contexto: publico em [CANAL — blog, YouTube, newsletter] para [PÚBLICO], com frequência de [X POSTS/MÊS]. Objetivo do conteúdo: [OBJETIVO]. Temas que domino: [LISTA DE TEMAS]. Últimos títulos publicados: [TÍTULOS RECENTES].

Tarefa: monte a pauta editorial do próximo mês com [NÚMERO] pautas.

Formato de saída: tabela com colunas — título provisório; formato (tutorial, lista, opinião, estudo de caso); palavra-chave ou pergunta que responde; estágio do funil (topo/meio/fundo); esforço (P/M/G); gancho de abertura em 1 frase.

Critérios: nada que repita os títulos recentes; pelo menos dois estágios de funil; cada gancho deve ser específico a ponto de outra pessoa escrever o texto sem falar comigo. Ordene da pauta mais estratégica para a menos.
```

### 5. Artigo completo a partir de pauta

Use quando a pauta está definida e você tem material apurado — a IA redige, você responde pela apuração.

```
Você é um redator sênior que escreve em português do Brasil, tom [TOM — direto, técnico, leve].

Contexto: texto para [CANAL] de [EMPRESA/SITE], que fala com [PÚBLICO]. Pauta: [TÍTULO E ÂNGULO]. Palavra-chave principal: [PALAVRA-CHAVE]. O leitor chega aqui porque [DOR OU SITUAÇÃO DO LEITOR]. Fatos que o texto deve usar — não invente nada além disto:

[COLE FATOS, DADOS E EXEMPLOS]

Tarefa: escreva o artigo completo com [NÚMERO] palavras (±10%).

Formato de saída: título; introdução de até 3 parágrafos que nomeia a dor do leitor; um H2 a cada 200-300 palavras; conclusão com um único próximo passo claro.

Critérios: zero informação fora do material colado; sem "no mundo atual", "é importante ressaltar" e parentes; se o material não sustentar o tamanho pedido, diga quantas palavras dá para escrever bem em vez de encher linguiça.
```

## SEO

Estes dois prompts assumem que você já pesquisou a palavra-chave e olhou a SERP — o passo a passo completo está nos [checklists de SEO, GEO e publicação](/checklists-de-seo-geo-e-publicacao/).

### 6. Reescrita de title e meta description para a SERP

Use quando a página tem conteúdo bom mas perde cliques para títulos piores na primeira página.

```
Você é um especialista em SEO on-page.

Contexto: a página [URL OU DESCRIÇÃO] quer ranquear para "[PALAVRA-CHAVE]". Intenção dominante: [INFORMACIONAL/COMERCIAL/TRANSACIONAL]. Title atual: "[TITLE ATUAL]". Meta atual: "[META ATUAL]". Títulos que ocupam a primeira página hoje:

[COLE OS TÍTULOS DOS CONCORRENTES NA SERP]

Tarefa: escreva 5 opções de title (até 60 caracteres) e 3 opções de meta description (até 155 caracteres).

Formato de saída: duas listas numeradas com a contagem de caracteres ao lado de cada opção; ao final, a combinação recomendada e o motivo em 2 frases.

Critérios: a palavra-chave entra no início do title sempre que soar natural; cada opção precisa se diferenciar dos títulos colados — aponte como; a meta deve conter um benefício concreto ou número, sem clickbait vazio.
```

### 7. Estrutura de página por intenção de busca

Use antes de escrever qualquer página que dispute uma palavra-chave concorrida.

```
Você é um estrategista de conteúdo SEO.

Contexto: quero criar ou reformular uma página para "[PALAVRA-CHAVE]", buscada por [PÚBLICO]. Abaixo, os H2/H3 das três páginas mais bem posicionadas e as perguntas relacionadas da SERP:

[COLE AS ESTRUTURAS DOS CONCORRENTES E AS PERGUNTAS]

Tarefa: proponha a estrutura completa da minha página, melhor que a dos concorrentes.

Formato de saída: H1 sugerido; lista hierárquica de H2 e H3 com 1 frase sobre o que cada seção cobre; 3-5 perguntas para FAQ; 1 elemento que os concorrentes não têm (tabela, calculadora, checklist).

Critérios: a intenção de busca deve estar respondida nos primeiros 30% da página; não copie a ordem dos concorrentes — justifique a sua; cada H2 precisa se sustentar sozinho como resposta a uma busca por voz.
```

## Análise e decisão

A IA é boa em duas coisas que gestor ocupado negligencia: achar padrão em dado colado e explicitar critérios antes de uma escolha.

### 8. Extração de insights de dados colados

Use quando você tem uma exportação de dados e uma pergunta de negócio, mas não tem analista disponível.

```
Você é um analista de dados que trabalha para um gestor sem tempo.

Contexto: os dados abaixo vêm de [ORIGEM — ex.: Analytics, planilha de vendas, CRM] e cobrem o período [PERÍODO]. A pergunta de negócio que preciso responder: [PERGUNTA — ex.: por que as vendas caíram em maio?].

[COLE OS DADOS — CSV, TABELA OU TEXTO]

Tarefa: analise os dados e responda a pergunta de negócio.

Formato de saída:
1. Resposta direta em até 3 frases.
2. Três a cinco achados, cada um com o número que o sustenta.
3. O que os dados NÃO permitem concluir (limitações).
4. Duas ações recomendadas com base apenas no que os dados mostram.

Critérios: todo achado cita o número exato dos dados colados; se houver inconsistência ou lacuna, aponte antes de analisar; proibido extrapolar tendência com menos de 3 pontos no tempo.
```

### 9. Resumo executivo de reunião

Use logo depois de reuniões longas, enquanto a transcrição ou as anotações ainda estão à mão.

```
Você é um chief of staff que transforma reuniões bagunçadas em documentos acionáveis.

Contexto: abaixo está a transcrição (ou minhas anotações) de uma reunião sobre [TEMA], com [PARTICIPANTES E CARGOS].

[COLE A TRANSCRIÇÃO OU AS ANOTAÇÕES]

Tarefa: produza o resumo executivo desta reunião.

Formato de saída:
- TL;DR em 3 linhas.
- Decisões tomadas (só o que foi de fato decidido, e por quem).
- Ações: tabela com responsável, entrega e prazo — sem prazo dito, marque "sem prazo definido".
- Pontos em aberto que precisam de nova conversa.
- Riscos ou desacordos que apareceram, mesmo sutis.

Critérios: não transforme discussão em decisão — o ambíguo vai para "pontos em aberto"; use os nomes dos participantes; máximo de 1 página.
```

### 10. Matriz de decisão

Use quando você está entre duas ou três opções há dias e continua adiando a escolha.

```
Você é um consultor de decisão instruído a me contradizer quando necessário.

Contexto: preciso decidir entre [OPÇÃO A], [OPÇÃO B] e [OPÇÃO C] para [OBJETIVO DA DECISÃO]. O que sei sobre cada uma: [COLE FATOS, PREÇOS, PRAZOS, RESTRIÇÕES]. Minha inclinação atual: [OPÇÃO E MOTIVO]. Critérios que mais importam: [CRITÉRIO 1], [CRITÉRIO 2], [CRITÉRIO 3].

Tarefa: monte uma matriz de decisão e recomende uma opção.

Formato de saída: tabela opções × critérios com notas de 1 a 5 e justificativa de 1 frase por célula; pesos sugeridos por critério, justificados; resultado ponderado; recomendação em 1 parágrafo; seção "advogado do diabo" atacando minha inclinação declarada.

Critérios: as notas saem dos fatos que colei, não de conhecimento geral; se dois resultados ficarem a menos de 10% de distância, declare empate técnico e diga qual informação faltante desempataria.
```

## Revisão e qualidade

Os prompts mais rentáveis da biblioteca: melhoram trabalho que já existe.

### 11. Revisão crítica de texto

Use antes de publicar qualquer texto importante — no texto dos outros e, principalmente, no seu.

```
Você é um editor exigente, do tipo que devolve texto com mais tinta vermelha do que preta.

Contexto: o texto abaixo é um [TIPO — artigo, e-mail, proposta, roteiro] para [PÚBLICO], com objetivo de [OBJETIVO DO TEXTO].

[COLE O TEXTO]

Tarefa: faça uma revisão crítica em camadas, sem reescrever o texto inteiro.

Formato de saída:
1. Veredito em 2 frases: o texto cumpre o objetivo?
2. Estrutura: o que cortar, mover ou acrescentar (aponte os parágrafos).
3. Clareza: as 5 frases mais fracas, cada uma com reescrita sugerida.
4. Precisão: afirmações sem sustentação ou contraditórias.
5. Nota de 0 a 10, com o critério da nota.

Critérios: seja específico — "parágrafo 3, segunda frase", nunca "em alguns trechos"; elogie apenas o que devo preservar; se o texto estiver bom, diga que está bom e não invente problema.
```

### 12. Resposta a avaliação negativa

Use quando chega aquela avaliação de 1 estrela e a vontade é responder no calor do momento.

```
Você é um especialista em reputação que escreve respostas públicas para empresas.

Contexto: [EMPRESA] recebeu a avaliação abaixo em [PLATAFORMA — Google, iFood, App Store]. O que sabemos internamente: [VERSÃO INTERNA — o que foi falha nossa e o que não foi]. Política de compensação: [O QUE PODEMOS OU NÃO OFERECER].

Avaliação do cliente:
[COLE A AVALIAÇÃO]

Tarefa: escreva 2 respostas públicas (até 120 palavras cada) e 1 mensagem privada de follow-up.

Formato de saída: Resposta A (formal); Resposta B (mais humana); mensagem privada; ao final, 1 linha sobre o que NÃO dizer neste caso e por quê.

Critérios: reconheça o problema específico citado, sem desculpas genéricas; nunca conteste o cliente em público, mesmo errado — a resposta é para quem lê, não para quem escreveu; só prometa o que a política permite.
```

## Como manter a biblioteca viva

Estes 12 prompts cobrem o grosso do trabalho de estratégia, conteúdo e gestão, mas o valor real aparece na adaptação: troque o papel, endureça os critérios, corte o que não se aplica ao seu caso. E dê o passo que quase ninguém dá — salve as suas versões com os placeholders fixos já preenchidos (empresa, público, tom, restrições). Um prompt bom envelhece bem; um prompt bom com o seu contexto embutido vira ferramenta de trabalho, pronta em trinta segundos.
