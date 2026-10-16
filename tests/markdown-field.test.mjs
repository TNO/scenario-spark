import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const esbuild = createRequire(require.resolve('vite/package.json'))('esbuild');
const source = readFileSync(new URL('../src/components/ui/markdown-field.ts', import.meta.url), 'utf8');
const code = esbuild.transformSync(source, { loader: 'ts', format: 'cjs', target: 'es2022' }).code;

const MarkdownEditor = () => ({ view: () => null });
const TextArea = () => ({ view: () => null });
const listeners = new Set();
// No mounted app in tests, so redraws are no-ops.
require('mithril').redraw = () => {};
globalThis.document = {
  body: {},
  activeElement: null,
  addEventListener: (_type, fn) => listeners.add(fn),
  removeEventListener: (_type, fn) => listeners.delete(fn),
  commands: [],
  execCommand(command, _ui, value) {
    this.commands.push([command, value]);
    return true;
  },
};

const load = () => {
  const module = { exports: {} };
  const mocks = {
    'mithril-materialized': { TextArea, ThemeManager: { getTheme: () => 'light' } },
    'mithril-markdown-wysiwyg': { MarkdownEditor },
    'mithril-ui-form': { render: (md) => `rendered:${md}` },
    '../../services': { t: (key) => key },
    '../../utils': {
      markdown2html: (md) => `html:${md}`,
      clipboardHtmlToMarkdown: (html) => (html ? `md:${html}` : undefined),
    },
  };
  new Function('require', 'module', 'exports', code)((name) => mocks[name] || require(name), module, module.exports);
  return module.exports.MarkdownField;
};

const findAll = (node, predicate) => {
  if (Array.isArray(node)) return node.flatMap((child) => findAll(child, predicate));
  if (!node || typeof node !== 'object') return [];
  return [...(predicate(node) ? [node] : []), ...findAll(node.children, predicate)];
};
const byClass = (cls) => (n) => (n.attrs?.className || '').split(' ').includes(cls);
const find = (tree, cls) => findAll(tree, byClass(cls))[0];
const textAreaOf = (tree) => findAll(tree, (n) => n.tag === TextArea)[0];
const editorOf = (tree) => findAll(tree, (n) => n.tag === MarkdownEditor)[0];
const textOf = (n) => n.text ?? n.children?.[0]?.children;

const setup = (value, rich = true) => {
  const state = { id: 'a', label: 'Label', value, rich, oninput: (v) => (state.value = v) };
  listeners.clear();
  const component = load()();
  const tree = () => component.view({ attrs: state });
  // Register the wrapper element, as Mithril would on create.
  const wrapper = { contains: (node) => node === 'inside', querySelector: () => null, isConnected: false };
  tree().attrs.oncreate?.({ dom: wrapper });
  return { state, render: tree, component };
};
const click = (card, target = { closest: () => null }) => card.attrs.onclick({ target });

test('an empty field shows a placeholder note that opens the editor on click', () => {
  const { render } = setup('');
  const tree = render();
  assert.equal(textOf(find(tree, 'markdown-field-empty')), 'MARKDOWN_FIELD_EMPTY');
  assert.equal(editorOf(tree), undefined);
  click(find(tree, 'markdown-field-body'));
  assert.ok(editorOf(render()));
});

test('text is shown as a bounded note and edited with the toolbar editor without tabs', () => {
  const { state, render } = setup('**Bold**');
  let tree = render();
  assert.equal(textOf(find(tree, 'markdown-field-content')), 'html:**Bold**');
  assert.equal(textOf(find(tree, 'markdown-field-toggle')), 'edit');
  find(tree, 'markdown-field-toggle').attrs.onclick();
  tree = render();
  const editor = editorOf(tree);
  assert.equal(editor.attrs.content, '**Bold**');
  assert.equal(editor.attrs.toolbar, true);
  assert.equal(editor.attrs.showTabs, false);
  editor.attrs.onContentChange('*Changed*');
  assert.equal(state.value, '*Changed*');
  assert.equal(textOf(find(tree, 'markdown-field-toggle')), 'check');
  find(tree, 'markdown-field-toggle').attrs.onclick();
  assert.equal(textOf(find(render(), 'markdown-field-content')), 'html:*Changed*');
});

test('clicking a link in the note does not open the editor', () => {
  const { render } = setup('[x](https://tno.nl)');
  click(find(render(), 'markdown-field-body'), { closest: () => ({}) });
  assert.equal(editorOf(render()), undefined);
});

test('clicking outside the field closes the editor, clicking inside keeps it open', () => {
  const { render } = setup('Text');
  click(find(render(), 'markdown-field-body'));
  assert.equal(listeners.size, 1);
  const [onPointerDown] = listeners;
  onPointerDown({ target: 'inside' });
  assert.ok(editorOf(render()), 'toolbar click keeps editing');
  onPointerDown({ target: 'outside' });
  assert.equal(editorOf(render()), undefined);
  assert.equal(listeners.size, 0, 'listener removed');
});

test('switching to another item closes the editor', () => {
  const { state, render } = setup('Text');
  click(find(render(), 'markdown-field-body'));
  state.id = 'b';
  assert.equal(editorOf(render()), undefined);
  assert.equal(listeners.size, 0);
});

test('plain: an empty field shows a text area; typing keeps it open until saved', () => {
  const { state, render } = setup('', false);
  let tree = render();
  assert.equal(find(tree, 'markdown-field-toggle'), undefined);
  textAreaOf(tree).attrs.oninput('**Bold**');
  tree = render();
  assert.ok(textAreaOf(tree));
  assert.equal(state.value, '**Bold**');
  find(tree, 'markdown-field-toggle').attrs.onclick();
  tree = render();
  assert.equal(textAreaOf(tree), undefined);
  assert.equal(textOf(find(tree, 'markdown-field-content')), 'html:**Bold**');
  find(tree, 'markdown-field-toggle').attrs.onclick();
  assert.ok(textAreaOf(render()), 'edit reopens the text area');
  assert.equal(listeners.size, 0, 'no outside-click listener in plain mode');
});

test('plain: pasting formatted HTML inserts it as Markdown at the cursor', () => {
  const { render } = setup('', false);
  const textArea = textAreaOf(render());
  let prevented = false;
  let dispatched;
  const target = { tagName: 'TEXTAREA', value: 'Voor  na', selectionStart: 5, selectionEnd: 5, dispatchEvent: (e) => (dispatched = e) };
  const event = (html) => ({
    target,
    clipboardData: { getData: (type) => (type === 'text/html' ? html : 'plain') },
    preventDefault: () => (prevented = true),
  });
  textArea.attrs.onpaste(event(''));
  assert.equal(prevented, false, 'plain text pastes normally');
  textArea.attrs.onpaste(event('<b>x</b>'));
  assert.equal(prevented, true);
  assert.equal(target.value, 'Voor md:<b>x</b> na');
  assert.equal(target.selectionStart, 5 + 'md:<b>x</b>'.length);
  assert.equal(dispatched.type, 'input');
});

const paste = (render, data) => {
  const editor = find(render(), 'markdown-field-editor');
  let prevented = false;
  document.commands = [];
  editor.attrs.onpaste({
    clipboardData: { getData: (type) => data[type] || '' },
    preventDefault: () => (prevented = true),
  });
  return { prevented, commands: document.commands };
};

test('rich: pasted formatted HTML is inserted as clean HTML rendered from Markdown', () => {
  const { render } = setup('');
  click(find(render(), 'markdown-field-body'));
  const result = paste(render, { 'text/html': '<h2>Title</h2>', 'text/plain': 'Title' });
  assert.equal(result.prevented, true);
  assert.deepEqual(result.commands, [['insertHTML', 'rendered:md:<h2>Title</h2>']]);
});

test('rich: multi-line plain text is read as Markdown, single-line text pastes normally', () => {
  const { render } = setup('');
  click(find(render(), 'markdown-field-body'));
  const multi = paste(render, { 'text/plain': '## Title\n- item' });
  assert.deepEqual(multi.commands, [['insertHTML', 'rendered:## Title\n- item']]);
  const single = paste(render, { 'text/plain': 'just a word' });
  assert.equal(single.prevented, false);
  assert.deepEqual(single.commands, []);
});
