# Fotos do palestrante

As imagens desta pasta entram na `/palestras` **sozinhas**. A página varre o
diretório no build (`import.meta.glob`), otimiza cada arquivo e monta as seções.
Não é preciso editar código para trocar, acrescentar ou remover foto.

## Convenção de nomes

O nome do arquivo decide onde a foto aparece:

| Nome                 | Onde entra                                  |
| -------------------- | ------------------------------------------- |
| `hero.*`             | Foto grande do topo                         |
| `retrato.*`          | Bloco "Quem sobe no palco"                  |
| `citacao.*`          | Faixa de largura total com a frase de palco |
| qualquer outro nome  | Galeria "No palco", em ordem alfabética     |

Formatos aceitos: `.jpg`, `.jpeg`, `.png`, `.webp`, `.avif`.

Sem `hero.*`, `retrato.*` ou `citacao.*`, a página cai nas fotos de
`src/assets/brand`. Sem nenhuma outra foto, a galeria não é renderizada — uma
grade vazia numa página de palestrante diz o contrário do que se quer dizer.

## Texto alternativo

O `alt` de cada foto da galeria é gerado a partir do nome do arquivo, então o
nome é lido por quem usa leitor de tela e pelo buscador. Prefira nomes
descritivos:

    palco-convencao-senai.jpg   ->  "Paul Gomes — palco convenção senai"
    IMG_4821.jpg                ->  "Paul Gomes — IMG 4821"   (ruim)

## Peso

Pode subir o arquivo grande, direto da câmera: o Astro gera as versões
redimensionadas em WebP no build. O que vai para o repositório é o original, e
é ele que fica no histórico do Git — acima de ~2 MB por foto, comprima antes.
