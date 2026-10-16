import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseTemplateLine } from '../src/utils/template-markdown.ts';

test('plain lines keep text and placeholders', () => {
  assert.deepEqual(parseTemplateLine('A {threat} in a {place}.'), {
    block: 'p',
    segments: [
      { text: 'A ' },
      { text: 'threat', placeholder: true },
      { text: ' in a ' },
      { text: 'place', placeholder: true },
      { text: '.' },
    ],
  });
});

test('bold and italic markers style text and placeholders', () => {
  assert.deepEqual(parseTemplateLine('**Threat:** *a {threat}*'), {
    block: 'p',
    segments: [
      { text: 'Threat:', bold: true },
      { text: ' ' },
      { text: 'a ', italic: true },
      { text: 'threat', placeholder: true, italic: true },
    ],
  });
});

test('headings and list items', () => {
  assert.deepEqual(parseTemplateLine('### Situation'), { block: 'h3', segments: [{ text: 'Situation' }] });
  assert.deepEqual(parseTemplateLine('- Place: {place}').block, 'li');
  assert.deepEqual(parseTemplateLine('* Place: {place}').block, 'li');
});

test('unpaired markers stay literal', () => {
  assert.deepEqual(parseTemplateLine('5 * 3 = 15'), { block: 'p', segments: [{ text: '5 * 3 = 15' }] });
  assert.deepEqual(parseTemplateLine('**Bold** and **open'), {
    block: 'p',
    segments: [{ text: 'Bold', bold: true }, { text: ' and **open' }],
  });
});
