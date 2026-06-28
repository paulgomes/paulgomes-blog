/**
 * Markdown <-> AST canonica (block-level).
 * Inline e mantido como texto markdown cru num unico no `text` (lossless, sem
 * parser inline completo no MVP). Da estrutura de blocos (headings/listas/code/
 * imagens/hr/quote) sem reescrever a formatacao inline produzida pelo turndown.
 */
import type { CanonicalBlock, InlineNode } from '../types/canonical.js';

const HEADING_RE = /^(#{1,6})\s+(.*)$/;
const HR_RE = /^(-{3,}|\*{3,}|_{3,})\s*$/;
const UL_RE = /^[-*+]\s+(.*)$/;
const OL_RE = /^\d+\.\s+(.*)$/;
const IMG_RE = /^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)\s*$/;
const FENCE_RE = /^```(\w+)?\s*$/;
const QUOTE_RE = /^>\s?(.*)$/;

function textBlock(value: string): InlineNode[] {
  return [{ t: 'text', value }];
}

export function markdownToBlocks(md: string): CanonicalBlock[] {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const blocks: CanonicalBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    let line = lines[i] ?? '';

    // pula linhas em branco entre blocos
    if (line.trim() === '') { i++; continue; }

    // code fence
    const fence = FENCE_RE.exec(line);
    if (fence) {
      const lang = fence[1];
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i] ?? '')) {
        buf.push(lines[i] ?? '');
        i++;
      }
      i++; // consome a fence de fechamento
      blocks.push(lang ? { t: 'code', lang, value: buf.join('\n') } : { t: 'code', value: buf.join('\n') });
      continue;
    }

    // heading
    const h = HEADING_RE.exec(line);
    if (h) {
      const level = (h[1] ?? '#').length as 1 | 2 | 3 | 4 | 5 | 6;
      blocks.push({ t: 'heading', level, children: textBlock((h[2] ?? '').trim()) });
      i++;
      continue;
    }

    // hr
    if (HR_RE.test(line)) { blocks.push({ t: 'thematicBreak' }); i++; continue; }

    // imagem isolada
    const img = IMG_RE.exec(line);
    if (img) {
      blocks.push({ t: 'image', ref: { sourceUrl: img[2] ?? '' }, alt: img[1] ?? '' });
      i++;
      continue;
    }

    // blockquote (linhas consecutivas com '>')
    if (QUOTE_RE.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && QUOTE_RE.test(lines[i] ?? '')) {
        buf.push((QUOTE_RE.exec(lines[i] ?? '')?.[1]) ?? '');
        i++;
      }
      blocks.push({ t: 'quote', children: [{ t: 'paragraph', children: textBlock(buf.join('\n').trim()) }] });
      continue;
    }

    // listas
    if (UL_RE.test(line) || OL_RE.test(line)) {
      const ordered = OL_RE.test(line);
      const re = ordered ? OL_RE : UL_RE;
      const items: CanonicalBlock[][] = [];
      while (i < lines.length && re.test(lines[i] ?? '')) {
        const text = re.exec(lines[i] ?? '')?.[1] ?? '';
        items.push([{ t: 'paragraph', children: textBlock(text) }]);
        i++;
      }
      blocks.push({ t: 'list', ordered, items });
      continue;
    }

    // paragrafo: linhas consecutivas nao-vazias que nao iniciam outro bloco
    const buf: string[] = [];
    while (i < lines.length) {
      const l = lines[i] ?? '';
      if (l.trim() === '') break;
      if (HEADING_RE.test(l) || HR_RE.test(l) || FENCE_RE.test(l) || IMG_RE.test(l) || QUOTE_RE.test(l) || UL_RE.test(l) || OL_RE.test(l)) break;
      buf.push(l);
      i++;
    }
    if (buf.length) blocks.push({ t: 'paragraph', children: textBlock(buf.join('\n')) });
  }

  return blocks;
}

function inlineToMarkdown(nodes: InlineNode[]): string {
  let out = '';
  for (const n of nodes) {
    switch (n.t) {
      case 'text': out += n.value; break;
      case 'strong': out += `**${inlineToMarkdown(n.children)}**`; break;
      case 'em': out += `*${inlineToMarkdown(n.children)}*`; break;
      case 'code': out += '`' + n.value + '`'; break;
      case 'link': out += `[${inlineToMarkdown(n.children)}](${n.url})`; break;
      case 'break': out += '\n'; break;
    }
  }
  return out;
}

function imgUrl(ref: { destUrl?: string; sourceUrl: string }): string {
  return ref.destUrl ?? ref.sourceUrl;
}

export function blocksToMarkdown(blocks: CanonicalBlock[]): string {
  const parts: string[] = [];
  for (const b of blocks) {
    switch (b.t) {
      case 'heading':
        parts.push('#'.repeat(b.level) + ' ' + inlineToMarkdown(b.children));
        break;
      case 'paragraph':
        parts.push(inlineToMarkdown(b.children));
        break;
      case 'thematicBreak':
        parts.push('---');
        break;
      case 'code':
        parts.push('```' + (b.lang ?? '') + '\n' + b.value + '\n```');
        break;
      case 'quote':
        parts.push(blocksToMarkdown(b.children).split('\n').map((l) => (l ? '> ' + l : '>')).join('\n'));
        break;
      case 'image':
        parts.push(`![${b.alt ?? ''}](${imgUrl(b.ref)})`);
        break;
      case 'figure':
        parts.push(`![${b.ref.alt ?? ''}](${imgUrl(b.ref)})`);
        break;
      case 'list':
        parts.push(
          b.items
            .map((item, idx) => {
              const marker = b.ordered ? `${idx + 1}. ` : '- ';
              return marker + blocksToMarkdown(item).replace(/\n/g, '\n  ');
            })
            .join('\n'),
        );
        break;
      case 'embed':
        parts.push(b.url);
        break;
      case 'table':
        parts.push(renderTable(b));
        break;
      case 'html':
        parts.push(b.raw);
        break;
    }
  }
  return parts.join('\n\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

function renderTable(b: { head: CanonicalBlock[][]; rows: CanonicalBlock[][][] }): string {
  const cell = (c: CanonicalBlock[]): string => blocksToMarkdown(c).replace(/\n+/g, ' ').trim();
  const head = b.head.map(cell);
  const sep = head.map(() => '---');
  const rows = b.rows.map((r) => r.map(cell));
  const line = (cols: string[]): string => '| ' + cols.join(' | ') + ' |';
  return [line(head), line(sep), ...rows.map(line)].join('\n');
}
