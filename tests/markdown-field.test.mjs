import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const esbuild = createRequire(require.resolve('vite/package.json'))('esbuild');
const materialized = require('mithril-materialized');
const source = readFileSync(new URL('../src/components/ui/markdown-field.ts', import.meta.url), 'utf8');
const code = esbuild.transformSync(source, { loader: 'ts', format: 'cjs', target: 'es2022' }).code;

const load = () => {
  const module = { exports: {} };
  const mocks = {
    '../../services': { t: (key) => key },
    '../../utils': { markdown2html: (md) => `html:${md}` },
  };
  new Function('require', 'module', 'exports', code)((name) => mocks[name] || require(name), module, module.exports);
  return module.exports.MarkdownField;
};

const findAll = (node, predicate) => {
  if (Array.isArray(node)) return node.flatMap((child) => findAll(child, predicate));
  if (!node || typeof node !== 'object') return [];
  return [...(predicate(node) ? [node] : []), ...findAll(node.children, predicate)];
};

const setup = (value) => {
  const state = { id: 'a', label: 'Label', value, oninput: (v) => (state.value = v) };
  const view = load()();
  return { state, render: () => view.view({ attrs: state }) };
};
const textAreaOf = (tree) => findAll(tree, (n) => n.tag === materialized.TextArea)[0];
const byClass = (cls) => (n) => (n.attrs?.className || '').split(' ').includes(cls);
const toggleOf = (tree) => findAll(tree, byClass('markdown-field-toggle'))[0];
const contentOf = (tree) => findAll(tree, byClass('markdown-field-content'))[0];
const textOf = (n) => n.text ?? n.children?.[0]?.children;

test('an empty field shows a text area without a toggle', () => {
  const { render } = setup('');
  const tree = render();
  assert.ok(textAreaOf(tree));
  assert.equal(toggleOf(tree), undefined);
});

test('typing keeps the text area open until the user saves', () => {
  const { render } = setup('');
  textAreaOf(render()).attrs.oninput('**Bold**');
  let tree = render();
  assert.ok(textAreaOf(tree), 'still editing after typing');
  assert.equal(textOf(toggleOf(tree)), 'check');
  toggleOf(tree).attrs.onclick();
  tree = render();
  assert.equal(textAreaOf(tree), undefined);
  assert.equal(textOf(contentOf(tree)), 'html:**Bold**');
});

test('text set from outside (e.g. an LLM) is rendered, and edit reopens the text area', () => {
  const { state, render } = setup('');
  render();
  state.value = '- point';
  let tree = render();
  assert.equal(textOf(contentOf(tree)), 'html:- point');
  assert.equal(textOf(toggleOf(tree)), 'edit');
  toggleOf(tree).attrs.onclick();
  assert.ok(textAreaOf(render()));
});

test('switching to another item leaves edit mode', () => {
  const { state, render } = setup('Text');
  toggleOf(render()).attrs.onclick();
  assert.ok(textAreaOf(render()));
  state.id = 'b';
  assert.equal(textAreaOf(render()), undefined);
});
