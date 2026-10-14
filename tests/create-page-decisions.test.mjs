import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import * as decision from '../src/utils/decision.ts';

const require = createRequire(import.meta.url);
const esbuild = createRequire(require.resolve('vite/package.json'))('esbuild');
const materialized = require('mithril-materialized');
require('mithril').redraw = () => {};
const source = readFileSync(new URL('../src/components/create-scenario-page.ts', import.meta.url), 'utf8');
const code = esbuild.transformSync(source, { loader: 'ts', format: 'cjs', target: 'es2022' }).code;

const findAll = (node, predicate) => {
  if (Array.isArray(node)) return node.flatMap((child) => findAll(child, predicate));
  if (!node || typeof node !== 'object') return [];
  return [...(predicate(node) ? [node] : []), ...findAll(node.children, predicate)];
};

const load = () => {
  const module = { exports: {} };
  const mocks = {
    'mithril-materialized': { ...materialized, ThemeManager: { getTheme: () => 'light' }, toast: () => {} },
    'mithril-ui-form': { range: () => [], render: (value) => value },
    '../models': { Dashboards: { CREATE_SCENARIO: 'create' } },
    '../services': {
      t: (key, params) => (params ? `${key}: ${params.situation}` : key),
      setPage: () => {},
      saveModel: async () => {},
      updateNarrative: async () => {},
    },
    '../utils': {
      ...decision,
      narrativesToOptions: () => [],
      generateUniqueTitle: () => '',
      deepCopy: (value) => structuredClone(value),
    },
    './ui': { ensureDefaultLLMConfig: () => false },
    '../models/persona-images': { PersonaImages: [] },
    'mithril-markdown-wysiwyg': { MarkdownEditor: () => {} },
    '../utils/index': { quillToMarkdown: (value) => value },
    './ui/scenario-paragraph': { ScenarioParagraph: () => {} },
  };
  new Function('require', 'module', 'exports', code)((name) => mocks[name] || require(name), module, module.exports);
  return module.exports;
};

const scenario = (includeDecisionSupport, hideInconsistentValues = false) => ({
  includeDecisionSupport,
  hideInconsistentValues,
  categories: [
    { id: 'sit', label: 'Situation', componentIds: ['threat'] },
    { id: 'dec', label: 'Measures', decisionSupport: true, componentIds: ['measure'] },
  ],
  components: [
    { id: 'threat', label: 'Threat', values: [{ id: 'fire', label: 'Fire' }, { id: 'flood', label: 'Flood' }] },
    {
      id: 'measure',
      label: 'Measure',
      manual: true,
      values: [{ id: 'water', label: 'Use water' }, { id: 'evacuate', label: 'Evacuate' }],
    },
  ],
  inconsistencies: { flood: { water: true } },
  narratives: [],
  personas: [],
});

const render = (box, components = { threat: ['flood'] }) => {
  const { CreateScenarioPage, CategoryTable } = load();
  const attrs = {
    state: { model: { personas: [], scenario: box }, curNarrative: { id: 'n', components } },
    update: () => {},
  };
  const tree = CreateScenarioPage().view({ attrs });
  const tables = findAll(tree, (node) => node.tag === CategoryTable);
  const headings = findAll(tree, (node) =>
      node.tag === 'h5' &&
      (node.text === 'DECISIONS' || node.children?.some?.((c) => c?.children === 'DECISIONS')));
  return { tables, headings, CategoryTable };
};

const selectsOf = (CategoryTable, table) =>
  findAll(CategoryTable().view({ attrs: table.attrs }), (node) => node.tag === materialized.Select);

test('decision categories are hidden when decision support is off', () => {
  const { tables, headings } = render(scenario(false));
  assert.deepEqual(tables.map((t) => t.attrs.catId), ['sit']);
  assert.equal(headings.length, 0);
});

test('decision categories render in their own section when decision support is on', () => {
  const { tables, headings, CategoryTable } = render(scenario(true));
  assert.deepEqual(tables.map((t) => t.attrs.catId), ['sit', 'dec']);
  assert.equal(headings.length, 1);
  const [select] = selectsOf(CategoryTable, tables[1]);
  const water = select.attrs.options.find((o) => o.id === 'water');
  assert.equal(water.disabled, true);
  assert.equal(water.title, 'EXCLUDED_BY: Flood');
  assert.match(water.label, /Use water \(EXCLUDED_BY: Flood\)/);
  assert.equal(select.attrs.options.find((o) => o.id === 'evacuate').disabled, undefined);
});

test('excluded decisions are hidden when inconsistent values are hidden', () => {
  const { tables, CategoryTable } = render(scenario(true, true));
  const [select] = selectsOf(CategoryTable, tables[1]);
  assert.deepEqual(select.attrs.options.map((o) => o.id), ['evacuate']);
});
