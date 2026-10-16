import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hasFormatting, nodeToMarkdown } from '../src/utils/clipboard-markdown.ts';

const text = (value) => ({ nodeType: 3, nodeName: '#text', textContent: value, childNodes: [] });
const el = (name, attrs, ...kids) => {
  if (typeof attrs === 'string' || attrs?.nodeType) return el(name, {}, attrs, ...kids);
  const childNodes = kids.map((k) => (typeof k === 'string' ? text(k) : k));
  const node = { nodeType: 1, nodeName: name.toUpperCase(), childNodes, getAttribute: (n) => attrs?.[n] ?? null };
  Object.defineProperty(node, 'textContent', { get: () => childNodes.map((c) => c.textContent).join('') });
  return node;
};
const body = (...kids) => el('body', {}, ...kids);

test('converts LLM chat HTML with headings, emphasis and (loose) lists', () => {
  const tree = body(
    el('h2', 'Beoordeling handelingsoptie A'),
    '\n',
    el('h3', 'Eindoordeel'),
    '\n  ',
    el('p', 'Optie A sluit ', el('strong', 'goed aan '), 'bij de\n   opdracht.'),
    el('ol', '\n', el('li', el('p', 'de vijand vertragen;')), '\n', el('li', el('p', 'gevechtskracht behouden.'))),
    el('ul', el('li', 'De compagnie ', el('em', 'heeft'), ' artillerie.'), el('li', 'Logistiek is toereikend.')),
    el('hr'),
    el('p', el('strong', 'Leg terugvalcriteria vast'), ' (tijd, verliesniveau).'),
  );
  assert.equal(
    nodeToMarkdown(tree),
    [
      '## Beoordeling handelingsoptie A',
      '### Eindoordeel',
      'Optie A sluit **goed aan** bij de opdracht.',
      '1. de vijand vertragen;\n2. gevechtskracht behouden.',
      '- De compagnie *heeft* artillerie.\n- Logistiek is toereikend.',
      '---',
      '**Leg terugvalcriteria vast** (tijd, verliesniveau).',
    ].join('\n\n'),
  );
});

test('indents nested lists and multi-paragraph items', () => {
  const tree = body(
    el('ol', { start: '3' }, el('li', el('p', 'Terugvalprocedure'), el('ul', el('li', 'wanneer'), el('li', 'waar')))),
  );
  assert.equal(nodeToMarkdown(tree), '3. Terugvalprocedure\n   - wanneer\n   - waar');
});

test('treats an inline wrapper around blocks (Google Docs) as a container', () => {
  const tree = body(el('b', { style: 'font-weight:normal' }, el('p', 'Een'), el('p', 'Twee')));
  assert.equal(nodeToMarkdown(tree), 'Een\n\nTwee');
});

test('converts tables, links, code, quotes and line breaks; skips styles', () => {
  const tree = body(
    el('style', 'p { color: red }'),
    el('table', el('thead', el('tr', el('th', 'Optie'), el('th', 'Risico'))), el('tbody', el('tr', el('td', 'A'), el('td', 'Hoog | laag')))),
    el('p', 'Zie ', el('a', { href: 'https://tno.nl' }, 'TNO'), ' en ', el('code', 'x < y'), el('br'), 'volgende regel'),
    el('blockquote', el('p', 'Citaat'), el('p', 'Verder')),
  );
  assert.equal(
    nodeToMarkdown(tree),
    '| Optie | Risico |\n| --- | --- |\n| A | Hoog \\| laag |\n\nZie [TNO](https://tno.nl) en `x < y`\nvolgende regel\n\n> Citaat\n>\n> Verder',
  );
});

test('only formatted HTML is worth converting', () => {
  assert.equal(hasFormatting(body(el('div', el('span', '## Al markdown')))), false);
  assert.equal(hasFormatting(body(el('div', el('span', el('strong', 'Vet'))))), true);
});
