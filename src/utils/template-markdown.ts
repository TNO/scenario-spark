/** Minimal Markdown support for narrative template lines: headings, list items, bold and italic. */
export type TemplateBlock = 'p' | 'li' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';

export type TemplateSegment = {
  /** Literal text, or the placeholder id when `placeholder` is true. */
  text: string;
  placeholder?: boolean;
  bold?: boolean;
  italic?: boolean;
};

export type TemplateLine = { block: TemplateBlock; segments: TemplateSegment[] };

const TOKEN = /(\{[^{}]+\})|(\*\*|\*)/g;

export const parseTemplateLine = (line: string): TemplateLine => {
  let block: TemplateBlock = 'p';
  let rest = line;
  const heading = /^(#{1,6})\s+/.exec(rest);
  const listItem = /^[-*]\s+/.exec(rest);
  if (heading) {
    block = `h${heading[1].length}` as TemplateBlock;
    rest = rest.slice(heading[0].length);
  } else if (listItem) {
    block = 'li';
    rest = rest.slice(listItem[0].length);
  }

  type Token = { kind: 'text' | 'placeholder' | 'marker'; value: string };
  const tokens: Token[] = [];
  let last = 0;
  for (const match of rest.matchAll(TOKEN)) {
    if (match.index > last) tokens.push({ kind: 'text', value: rest.slice(last, match.index) });
    tokens.push(
      match[1]
        ? { kind: 'placeholder', value: match[1].slice(1, -1) }
        : { kind: 'marker', value: match[2] },
    );
    last = match.index + match[0].length;
  }
  if (last < rest.length) tokens.push({ kind: 'text', value: rest.slice(last) });

  // Markers without a closing partner are literal text.
  for (const marker of ['**', '*']) {
    const positions = tokens.flatMap((t, i) => (t.kind === 'marker' && t.value === marker ? [i] : []));
    if (positions.length % 2 === 1) tokens[positions[positions.length - 1]].kind = 'text';
  }

  const segments: TemplateSegment[] = [];
  let bold = false;
  let italic = false;
  for (const { kind, value } of tokens) {
    if (kind === 'marker') {
      if (value === '**') bold = !bold;
      else italic = !italic;
      continue;
    }
    const style = { ...(bold && { bold }), ...(italic && { italic }) };
    const prev = segments[segments.length - 1];
    if (
      kind === 'text' &&
      prev &&
      !prev.placeholder &&
      !!prev.bold === bold &&
      !!prev.italic === italic
    ) {
      prev.text += value;
    } else {
      segments.push({ text: value, ...(kind === 'placeholder' && { placeholder: true }), ...style });
    }
  }
  return { block, segments };
};
