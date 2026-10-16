/** The subset of the DOM `Node` interface used by the converter. */
export interface HtmlNode {
  nodeType: number;
  nodeName: string;
  textContent: string | null;
  childNodes: ArrayLike<HtmlNode>;
  getAttribute?: (name: string) => string | null;
}

const TEXT_NODE = 3;
const ELEMENT_NODE = 1;

const SKIPPED = new Set(['HEAD', 'SCRIPT', 'STYLE', 'META', 'LINK', 'TITLE', 'TEMPLATE', 'NOSCRIPT']);
const BLOCKS = new Set([
  'ADDRESS', 'ARTICLE', 'ASIDE', 'BLOCKQUOTE', 'BODY', 'DD', 'DETAILS', 'DIV', 'DL', 'DT', 'FIELDSET', 'FIGCAPTION',
  'FIGURE', 'FOOTER', 'FORM', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'HEADER', 'HR', 'HTML', 'LI', 'MAIN', 'NAV', 'OL',
  'P', 'PRE', 'SECTION', 'SUMMARY', 'TABLE', 'UL',
]);
/** Elements that indicate the clipboard holds formatted text worth converting. */
const FORMATTING = new Set([
  'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'STRONG', 'B', 'EM', 'I', 'UL', 'OL', 'TABLE', 'A', 'BLOCKQUOTE', 'PRE', 'CODE',
]);

const children = (node: HtmlNode) => Array.from(node.childNodes);
const isElement = (node: HtmlNode) => node.nodeType === ELEMENT_NODE;
const tag = (node: HtmlNode) => node.nodeName.toUpperCase();
const isBlock = (node: HtmlNode) => isElement(node) && BLOCKS.has(tag(node));
const hasBlock = (node: HtmlNode): boolean => children(node).some((c) => isBlock(c) || (isElement(c) && hasBlock(c)));

/** Wraps text in a Markdown marker, keeping surrounding whitespace outside the marker. */
const wrap = (text: string, marker: string) => {
  const [, before, inner, after] = text.match(/^(\s*)([\s\S]*?)(\s*)$/) || [];
  return inner ? `${before}${marker}${inner}${marker}${after}` : text;
};

const inline = (node: HtmlNode): string => {
  if (node.nodeType === TEXT_NODE) return (node.textContent || '').replace(/\s+/g, ' ');
  if (!isElement(node) || SKIPPED.has(tag(node))) return '';
  const content = () => children(node).map(inline).join('');
  switch (tag(node)) {
    case 'BR':
      return '\n';
    case 'STRONG':
    case 'B':
      return wrap(content(), '**');
    case 'EM':
    case 'I':
      return wrap(content(), '*');
    case 'DEL':
    case 'S':
    case 'STRIKE':
      return wrap(content(), '~~');
    case 'CODE':
      return wrap(node.textContent || '', '`');
    case 'A': {
      const text = content();
      const href = node.getAttribute?.('href');
      return href && text.trim() && !/^javascript:/i.test(href) ? `[${text.trim()}](${href})` : text;
    }
    default:
      return content();
  }
};

const cleanInline = (text: string) =>
  text
    .replace(/[ \t]*\n[ \t]*/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .trim();

/** Renders the children as Markdown blocks, grouping consecutive inline content into paragraphs. */
const blocks = (node: HtmlNode, separator = '\n\n'): string => {
  const result: string[] = [];
  let buffer = '';
  const flush = () => {
    const text = cleanInline(buffer);
    if (text) result.push(text);
    buffer = '';
  };
  for (const child of children(node)) {
    // Google Docs wraps everything in a <b>, so inline elements holding blocks act as containers.
    if (isBlock(child) || (isElement(child) && !SKIPPED.has(tag(child)) && hasBlock(child))) {
      flush();
      const text = block(child);
      if (text) result.push(text);
    } else {
      buffer += inline(child);
    }
  }
  flush();
  return result.join(separator);
};

const indent = (text: string, prefix: string, first = prefix) =>
  text
    .split('\n')
    .map((line, i) => (i === 0 ? first : line ? prefix : '') + line)
    .join('\n');

const list = (node: HtmlNode, ordered: boolean) => {
  let n = Number(node.getAttribute?.('start')) || 1;
  return children(node)
    .filter((c) => isElement(c) && tag(c) === 'LI')
    .map((li) => {
      const marker = ordered ? `${n++}. ` : '- ';
      return indent(blocks(li, '\n'), ' '.repeat(marker.length), marker);
    })
    .join('\n');
};

const table = (node: HtmlNode) => {
  const rows: HtmlNode[] = [];
  const collect = (n: HtmlNode): void =>
    children(n).forEach((c) => {
      if (!isElement(c)) return;
      if (tag(c) === 'TR') rows.push(c);
      else collect(c);
    });
  collect(node);
  const cells = rows
    .map((row) =>
      children(row)
        .filter((c) => isElement(c) && (tag(c) === 'TD' || tag(c) === 'TH'))
        .map((c) => cleanInline(blocks(c, ' ')).replace(/\n/g, ' ').replace(/\|/g, '\\|')),
    )
    .filter((row) => row.length > 0);
  if (cells.length === 0) return '';
  const width = Math.max(...cells.map((r) => r.length));
  const line = (row: string[]) => `| ${Array.from({ length: width }, (_, i) => row[i] || '').join(' | ')} |`;
  return [line(cells[0]), line(Array(width).fill('---')), ...cells.slice(1).map(line)].join('\n');
};

const block = (node: HtmlNode): string => {
  const name = tag(node);
  if (SKIPPED.has(name)) return '';
  const heading = name.match(/^H([1-6])$/);
  if (heading) {
    const text = cleanInline(inline(node)).replace(/\n/g, ' ');
    return text && `${'#'.repeat(Number(heading[1]))} ${text}`;
  }
  switch (name) {
    case 'UL':
      return list(node, false);
    case 'OL':
      return list(node, true);
    case 'HR':
      return '---';
    case 'PRE':
      return '```\n' + (node.textContent || '').replace(/\n$/, '') + '\n```';
    case 'BLOCKQUOTE':
      return indent(blocks(node), '> ').replace(/^$/gm, '>');
    case 'TABLE':
      return table(node);
    default:
      return blocks(node);
  }
};

/** Converts an HTML (DOM) tree to Markdown. */
export const nodeToMarkdown = (node: HtmlNode) =>
  block(node)
    .replace(/\n{3,}/g, '\n\n')
    .trim();

/** True when the tree contains formatting elements, so converting beats pasting plain text. */
export const hasFormatting = (node: HtmlNode): boolean =>
  children(node).some((c) => isElement(c) && (FORMATTING.has(tag(c)) || hasFormatting(c)));

/** Converts formatted clipboard HTML to Markdown, or returns undefined when it holds no formatting. */
export const clipboardHtmlToMarkdown = (html: string) => {
  if (!html || typeof DOMParser === 'undefined') return undefined;
  const { body } = new DOMParser().parseFromString(html, 'text/html');
  return hasFormatting(body) ? nodeToMarkdown(body) || undefined : undefined;
};
