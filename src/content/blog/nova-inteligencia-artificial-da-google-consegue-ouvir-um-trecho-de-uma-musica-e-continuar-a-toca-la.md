---
title: "Nova Inteligência Artificial da Google consegue ouvir um trecho de uma música e continuar a tocá-la"
description: "A técnica, chamada AudioLM, gera sons realistas sem a necessidade de transcrições humanas. Um novo sistema de Inteligência Artificial IA consegue criar músicas e falas que soam naturais após receber..."
pubDate: 2022-11-14
tags:
  - IA
heroImage: "../../assets/posts/library/shutterstock-592921421.webp"
---

A técnica, chamada AudioLM, gera sons realistas sem a necessidade de transcrições humanas.

Um novo sistema de Inteligência Artificial (IA) consegue criar músicas e falas que soam naturais após receber amostras de áudio com poucos segundos de duração.

Desenvolvida por pesquisadores da Google, a AudioLM gera trechos que se encaixam nos estilos das amostras de áudios fornecidas, incluindo complexos como músicas no piano, ou pessoas falando, de um modo quase indistinguível das gravações originais. A técnica se mostra promissora para acelerar o processo de treinamento de IA para geração de áudio, e pode eventualmente ser usada para criar autonomamente trilhas sonoras para vídeos.

(Você pode ouvir todos os exemplos aqui.)

Áudios criados por IA já são algo corriqueiro: vozes de assistentes virtuais, como a Alexa, usam processamento de linguagem natural. Sistemas de músicas elaborados por IA, como o Jukebox da empresa OpenAI, já geraram resultados impressionantes, mas a maioria das técnicas existentes precisam de pessoas preparando transcrições e fazendo marcações em dados baseados em texto para treinamento, o que toma muito tempo e mão de obra. O Jukebox, por exemplo, usa dados assim para gerar letras de música.

A AudioLM, como descrita em um artigo sem revisão por pares em setembro, é diferente: ela não precisa de transcrições ou marcações. Ao invés disso, o programa é alimentado com bancos de dados de som e o machine learning é usado para comprimir os arquivos de áudio em fragmentos, chamados tokens, perdendo assim pouca informação. Esses dados para treinamento em forma de tokens são então fornecidos para o modelo de machine learning que usa o processamento de linguagem natural para aprender os padrões do respectivo som.

Para gerar o áudio, alguns segundos de som são fornecidos para a AudioLM, que então prevê o que viria em seguida. O processo é parecido com a forma como modelos de linguagem, como o GPT-3, preveem quais frases e palavras normalmente se sucedem em uma frase.

Os trechos de áudios liberados pela equipe soam bastante naturais. Particularmente, a música de piano gerada usando a AudioLM soa muito mais fluida do que usando outras técnicas de IA já existentes, que tendem a soar caóticas.

Roger Dannenberg, pesquisador de música gerada por computadores na Universidade Carnegie Mellon (EUA) diz que a AudioLM já possui uma qualidade de som muito melhor do que programas anteriores de geração de música. Em especial, a AudioLM é surpreendentemente boa em recriar alguns dos padrões repetitivos inerentes de músicas feitas por humanos, diz Dannenberg. Para gerar uma música de piano realista, a AudioLM tem que capturar muitas das vibrações sutis contidas em cada nota quando as teclas de piano são tocadas. A música também tem que manter seus ritmos e harmonias durante um certo tempo.

“Isso é realmente impressionante, em parte porque isso indica que eles [os computadores] estão aprendendo alguns tipos de estruturas em diversos níveis,” diz Dannenberg.

A AudioLM não está restrita somente à música. Ao ser treinado com uma biblioteca de gravações de seres humanos conversando, o sistema também é capaz de gerar falas que mantém o mesmo sotaque e cadência do locutor original, apesar de até este momento estas frases parecerem raciocínios sem ordem lógica ou sentido. A AudioLM é treinada para aprender quais tipos de fragmentos sonoros se sucedem com frequência, e ela usa este processo de forma reversa para produzir frases. Ela também tem a vantagem de ser capaz de aprender as pausas e exclamações que são intrínsecas às línguas faladas, mas não são facilmente traduzidas para o texto.

Rupal Patel, pesquisadora de informação e ciência da fala da Universidade do Nordeste de Boston (EUA), diz que trabalhos anteriores usando IA para gerar áudio eram capazes de capturar estas nuances apenas se fossem explicitamente transcritas nos dados para treinamento. Em contraste, a AudioLM aprende automaticamente essas características a partir de dados fornecidos, o que gera um efeito mais realista.

“Muito do que podemos chamar de informação linguística não está nas palavras pronunciadas, mas no modo em que falamos algo para expressar uma intenção ou emoção específica,” diz Neil Zeghidour, um dos cocriadores da AudioLM. Por exemplo: alguém pode rir depois de dizer algo para indicar que aquilo era uma piada. “Tudo isso faz a fala soar natural,” diz ele.

Um dia, música gerada por IA pode ser usada para criar trilhas sonoras de fundo que soem mais naturais para vídeos e apresentações de slides. Uma tecnologia de geração de fala que soe mais natural pode ajudar a aprimorar ferramentas de acessibilidade para a internet e programas automatizados do setor de serviços médicos, diz Patel. A equipe também espera criar sons mais sofisticados, como uma banda com diferentes instrumentos ou sons que imitem gravações de florestas tropicais.

No entanto, as implicações éticas desta tecnologia precisam ser levadas em consideração, diz Patel. É especialmente importante determinar se os músicos que produziram as amostras usadas como dados para treinamento receberão titularidade ou direitos autorais pelo produto final, uma questão que já foi levantada pela IA de texto-para-imagem. Falas geradas por IA que são indistinguíveis de falas reais podem se tornar tão convincentes que possibilitariam uma distribuição mais fácil de desinformação.

No artigo, os pesquisadores dizem já estarem levando em conta e trabalhando para mitigar essas questões ao, por exemplo, desenvolver técnicas para distinguir sons naturais de sons produzidos usando AudioLM. Patel também sugeriu marcas d`água sonoras em produtos gerados por IA para torná-los mais fáceis de reconhecer quando comparados com áudios naturais.

fonte: https://mittechreview.com.br/nova-inteligencia-artificial-da-google-consegue-ouvir-um-trecho-de-uma-musica-e-continuar-a-toca-la/
