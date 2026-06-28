/**
 * HTML legado/Gutenberg -> Markdown.
 * Pre-processa marcacao proprietaria (comentarios Gutenberg, shortcodes comuns)
 * e converte o restante com turndown. Espelha o espirito do markdownify do .py.
 */
import TurndownService from 'turndown';

let _service: TurndownService | null = null;

function service(): TurndownService {
  if (_service) return _service;
  const td = new TurndownService({
    headingStyle: 'atx',
    hr: '---',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
    emDelimiter: '*',
    strongDelimiter: '**',
    linkStyle: 'inlined',
  });
  // <figure><img><figcaption> -> imagem + legenda em linha separada
  td.addRule('figure', {
    filter: 'figure',
    replacement: (_content, node) => {
      const el = node as unknown as { querySelector?: (s: string) => unknown };
      const img = el.querySelector ? (el.querySelector('img') as { getAttribute?: (a: string) => string | null } | null) : null;
      const src = img && img.getAttribute ? img.getAttribute('src') : null;
      const alt = img && img.getAttribute ? img.getAttribute('alt') : null;
      if (!src) return _content;
      return `\n\n![${alt ?? ''}](${src})\n\n`;
    },
  });
  _service = td;
  return td;
}

/** Remove comentarios Gutenberg e normaliza shortcodes simples antes do turndown. */
export function preprocessWpHtml(html: string): string {
  let out = html;
  // Comentarios de bloco Gutenberg: <!-- wp:... --> e <!-- /wp:... -->
  out = out.replace(/<!--\s*\/?wp:[\s\S]*?-->/g, '');
  // [caption ...]<conteudo>[/caption] -> mantem so o conteudo interno
  out = out.replace(/\[caption[^\]]*\]([\s\S]*?)\[\/caption\]/gi, '$1');
  // [embed]URL[/embed] -> URL nua (vira link/embed depois)
  out = out.replace(/\[embed[^\]]*\]([\s\S]*?)\[\/embed\]/gi, '\n$1\n');
  return out;
}

export function htmlToMarkdown(html: string): string {
  const pre = preprocessWpHtml(html ?? '');
  const md = service().turndown(pre);
  // normaliza: colapsa 3+ quebras de linha em 2; trim final.
  return md.replace(/\n{3,}/g, '\n\n').trim();
}
