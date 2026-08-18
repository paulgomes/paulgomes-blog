# Fotos e vídeo do palestrante

Os arquivos desta pasta entram na `/palestras` **sozinhos**. A página varre o
diretório no build, otimiza o que dá para otimizar e monta as seções. Não é
preciso editar código para trocar, acrescentar ou remover mídia.

## Fotos

Formatos aceitos: `.jpg`, `.jpeg`, `.png`, `.webp`, `.avif`.

O nome do arquivo decide onde a foto aparece:

| Nome                | Onde entra                                    |
| ------------------- | --------------------------------------------- |
| `hero.*`            | Foto grande do topo                           |
| `retrato.*`         | Bloco "Quem sobe no palco"                    |
| `citacao.*`         | Faixa larga com a frase de palco              |
| `ambiente-*.*`      | Camada de ambiente (ver abaixo)               |
| qualquer outro nome | Galeria "No palco", em ordem alfabética       |

Sem `hero.*`, `retrato.*` ou `citacao.*`, a página cai nas fotos de
`src/assets/brand`. Sem nenhuma outra foto, a galeria não é renderizada — uma
grade vazia numa página de palestrante diz o contrário do que se quer dizer.

### `ambiente-*` — foto do lugar, não da pessoa

Uma foto de plateia, de auditório ou de sala de reunião mostra **onde** a coisa
acontece. Ela não mostra o palestrante, e não deve dizer que mostra.

É essa a diferença entre os dois caminhos. A galeria "No palco" gera o `alt` na
forma `"Paul Gomes — <nome do arquivo>"`: é uma afirmação sobre quem está na
imagem. As de ambiente vão com `alt` vazio e `aria-hidden`, porque são
decorativas — entram dessaturadas e recoloridas no azul da marca, atrás de
texto, como textura.

Use o prefixo quando a foto for de ambiente, e nomeie pelo lugar:

    ambiente-plateia-em-convencao.jpg      ->  faixa larga "Onde isso acontece"
    ambiente-auditorio-antes-da-abertura.jpg
    ambiente-sala-de-reuniao.jpg           ->  fundo do bloco final de CTA

A primeira em ordem alfabética vai para a faixa larga; a segunda, para o fundo
do CTA. Com uma só, ela serve as duas. Sem nenhuma, os dois blocos continuam
funcionando — a faixa não é renderizada e o CTA fica só com o gradiente.

**Não use `ambiente-` para foto em que alguém apareça em destaque.** O
tratamento escurece e recolore, mas não descaracteriza: rosto reconhecível numa
página assinada por uma pessoa é lido como sendo ela.

Pode subir o arquivo grande, direto da câmera: o Astro gera as versões
redimensionadas em WebP no build. O que vai para o repositório é o original, e é
ele que fica no histórico do Git — acima de ~2 MB por foto, comprima antes.

## Vídeo da faixa de citação

Formatos aceitos: **`.mp4`** (H.264 — o que toca em todo lugar) e `.webm`.
Nome canônico: `citacao.mp4`. Qualquer outro nome também funciona, porque só
existe um lugar de vídeo na página, mas o canônico deixa a intenção explícita.

**`.mov` não serve.** É contêiner de edição, e boa parte dos navegadores não
reproduz. Exporte como MP4 antes de commitar.

Com o vídeo presente, a faixa passa a usá-lo no lugar da imagem. A foto
`citacao.*` (ou a de fallback) continua sendo usada como **poster**: é o que
aparece antes do vídeo começar e o que fica para quem tem JavaScript desligado
ou pediu menos movimento no sistema.

O vídeo é de fundo, atrás de texto. Isso impõe algumas coisas:

- **Sem áudio.** Ele toca sempre mudo — navegador nenhum deixa um vídeo com som
  começar sozinho. Se a trilha importa, o lugar dela não é aqui.
- **Escuro e de movimento lento** funciona melhor. A frase fica por cima, e
  contraste alto ou corte rápido atrás de texto atrapalha a leitura.
- **Peso.** É o arquivo mais pesado da página. Mire em **até 6 MB**; acima
  disso, reduza a resolução (1600px de largura basta) ou a duração. Ele só
  começa a baixar quando a faixa chega perto da tela, mas quem rolar até lá
  paga a conta.
- **Laço curto**, de 8 a 15 segundos, sem emenda visível. O vídeo repete
  indefinidamente.

A faixa tem um botão de pausa no canto: vídeo que se move sozinho por mais de
cinco segundos atrás de texto precisa ter como parar (WCAG 2.2.2).

## Texto alternativo

O `alt` de cada foto da galeria é gerado a partir do nome do arquivo, então o
nome é lido por quem usa leitor de tela e pelo buscador. Prefira nomes
descritivos:

    palco-convencao-senai.jpg   ->  "Paul Gomes — palco convenção senai"
    IMG_4821.jpg                ->  "Paul Gomes — IMG 4821"   (ruim)

O vídeo de fundo é decorativo e vai marcado como tal — a mensagem dele já está
no texto que fica por cima.
