import assert from 'node:assert/strict';
import { test } from 'node:test';
import { htmlToMarkdown, looksLikeHtml } from '../src/utils/html-to-markdown.ts';

test('detects HTML narratives but not plain markdown', () => {
  assert.equal(looksLikeHtml('<p>Een schip</p>'), true);
  assert.equal(looksLikeHtml('Line<br>break'), true);
  assert.equal(looksLikeHtml('**Bold** text with a < b'), false);
});

test('converts paragraphs to blank-line separated text', () => {
  assert.equal(
    htmlToMarkdown('<p>Eerste alinea.</p><p>Tweede alinea.</p>'),
    'Eerste alinea.\n\nTweede alinea.'
  );
});

test('converts inline formatting, line breaks, headings and lists', () => {
  assert.equal(
    htmlToMarkdown(
      '<h2>Titel</h2><p><strong>Vet</strong> en <em>schuin</em><br>volgende</p><ul><li>een</li><li>twee</li></ul><ol><li>A</li><li>B</li></ol>'
    ),
    '## Titel\n\n**Vet** en *schuin*\nvolgende\n\n- een\n- twee\n\n1. A\n2. B'
  );
});

test('strips unknown tags and decodes entities', () => {
  assert.equal(
    htmlToMarkdown('<p><span class="x">A &amp; B &lt;C&gt;&nbsp;D &#233;</span></p><script>bad()</script>'),
    'A & B <C> D é'
  );
});
