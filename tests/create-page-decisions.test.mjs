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

const load = (ui = {}) => {
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
    './ui': { ensureDefaultLLMConfig: () => false, ...ui },
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

test('decision tables edit the active course of action, not the situation', () => {
  const { CreateScenarioPage, CategoryTable } = load();
  const curNarrative = {
    id: 'n',
    components: { threat: ['fire'] },
    coas: [
      { id: 'a', label: 'A', components: { measure: ['evacuate'] } },
      { id: 'b', label: 'B', components: { measure: ['water'] } },
    ],
    activeCoaId: 'b',
  };
  const attrs = { state: { model: { personas: [], scenario: scenario(true) }, curNarrative }, update: () => {} };
  const tree = CreateScenarioPage().view({ attrs });
  const decisionTable = findAll(tree, (node) => node.tag === CategoryTable)[1];
  const [select] = selectsOf(CategoryTable, decisionTable);
  assert.deepEqual(select.attrs.checkedId, ['water']);
  select.attrs.onchange(['evacuate', 'water']);
  assert.deepEqual(curNarrative.coas[1].components.measure, ['evacuate', 'water']);
  assert.deepEqual(curNarrative.coas[0].components.measure, ['evacuate']);
  assert.deepEqual(curNarrative.components, { threat: ['fire'] });
  const chips = findAll(tree, (node) => node.tag === 'div' && /\bchip\b/.test(node.attrs?.className || ''));
  assert.equal(chips.length, 2);
});

test('the first decision creates course of action "A"', () => {
  const { CreateScenarioPage, CategoryTable } = load();
  const curNarrative = { id: 'n', components: { threat: ['fire'] } };
  const attrs = { state: { model: { personas: [], scenario: scenario(true) }, curNarrative }, update: () => {} };
  const tree = CreateScenarioPage().view({ attrs });
  const [select] = selectsOf(CategoryTable, findAll(tree, (node) => node.tag === CategoryTable)[1]);
  select.attrs.onchange(['evacuate']);
  assert.equal(curNarrative.coas.length, 1);
  assert.equal(curNarrative.coas[0].label, 'A');
  assert.equal(curNarrative.activeCoaId, curNarrative.coas[0].id);
  assert.deepEqual(curNarrative.coas[0].components, { measure: ['evacuate'] });
});

test('course-of-action text areas render without mixing keyed and unkeyed vnodes', () => {
  const { CreateScenarioPage } = load();
  const curNarrative = {
    id: 'n',
    components: { threat: ['fire'] },
    coas: [{ id: 'a', label: 'A', components: { measure: ['evacuate'] }, notes: 'Note' }],
    activeCoaId: 'a',
  };
  const attrs = { state: { model: { personas: [], scenario: scenario(true) }, curNarrative }, update: () => {} };
  const tree = CreateScenarioPage().view({ attrs });
  const textAreas = findAll(tree, (node) => node.tag === materialized.TextArea);
  assert.ok(textAreas.length >= 2, 'notes and reflection text areas are rendered');
  for (const vnode of textAreas) {
    // TextArea passes its attrs on to the inner <textarea>, so a `key` would sit next to unkeyed siblings.
    assert.doesNotThrow(() => materialized.TextArea({ attrs: vnode.attrs }).view({ attrs: vnode.attrs }));
  }
});

test('values of the active course of action that conflict with the situation are flagged', () => {
  const { CreateScenarioPage } = load();
  const curNarrative = {
    id: 'n',
    components: { threat: ['flood'] },
    coas: [{ id: 'a', label: 'A', components: { measure: ['water'] } }],
  };
  const attrs = { state: { model: { personas: [], scenario: scenario(true) }, curNarrative }, update: () => {} };
  const tree = CreateScenarioPage().view({ attrs });
  const [list] = findAll(tree, (node) => node.tag === 'ul' && /coa-conflicts/.test(node.attrs?.className || ''));
  assert.ok(list, 'conflict list is shown');
  assert.equal(list.children.length, 1);
  assert.deepEqual(curNarrative.coas[0].components.measure, ['water']);
});

test('"Reflect on decisions" stores the LLM reflection on the active course of action', async () => {
  const calls = [];
  const { CreateScenarioPage } = load({
    generateStory: async (...args) => {
      calls.push(args);
      return 'Evacuation comes too late.';
    },
  });
  const box = scenario(true);
  box.llm = { id: 'ollama', url: 'x', prompts: [{ type: 'decision', prompt: 'Assess', categories: ['sit', 'dec'] }] };
  const curNarrative = {
    id: 'n',
    components: { threat: ['fire'] },
    coas: [
      { id: 'a', label: 'A', components: { measure: ['evacuate'] } },
      { id: 'b', label: 'B', components: { measure: ['water'] } },
    ],
    activeCoaId: 'a',
  };
  const attrs = { state: { model: { personas: [], scenario: box }, curNarrative }, update: () => {} };
  attrs.getState = () => attrs.state;
  const tree = CreateScenarioPage().view({ attrs });
  const [button] = findAll(tree, (node) => node.attrs?.label === 'REFLECT_ON_DECISIONS');
  assert.ok(button);
  await button.attrs.onclick();
  assert.equal(calls[0][3], 'decision');
  assert.deepEqual(calls[0][5], { coaId: 'a', narrativeText: '' });
  assert.equal(curNarrative.coas[0].reflection, 'Evacuation comes too late.');
  assert.equal(curNarrative.coas[1].reflection, undefined);
  const [field] = findAll(CreateScenarioPage().view({ attrs }), (node) => node.attrs?.label === 'COA_REFLECTION');
  assert.equal(field.attrs.value, 'Evacuation comes too late.');
  field.attrs.oninput('Edited');
  assert.equal(curNarrative.coas[0].reflection, 'Edited');
});

const reflectSetup = (answer) => {
  let resolve;
  const pending = new Promise((r) => (resolve = r));
  const { CreateScenarioPage } = load({ generateStory: () => pending });
  const box = scenario(true);
  box.llm = { id: 'ollama', url: 'x', prompts: [{ type: 'decision', prompt: 'Assess', categories: ['sit', 'dec'] }] };
  const curNarrative = {
    id: 'n',
    components: { threat: ['fire'] },
    coas: [{ id: 'a', label: 'A', components: { measure: ['evacuate'] }, reflection: 'My own notes' }],
    activeCoaId: 'a',
  };
  const attrs = { state: { model: { personas: [], scenario: box }, curNarrative }, update: () => {} };
  attrs.getState = () => attrs.state;
  const [button] = findAll(CreateScenarioPage().view({ attrs }), (node) => node.attrs?.label === 'REFLECT_ON_DECISIONS');
  const click = button.attrs.onclick();
  return { attrs, curNarrative, finish: async () => (resolve(answer), click) };
};

test('"Reflect on decisions" appends to the reflection the user already wrote', async () => {
  const { curNarrative, finish } = reflectSetup('LLM view');
  await finish();
  assert.equal(curNarrative.coas[0].reflection, 'My own notes\n\nLLM view');
});

test('"Reflect on decisions" stores the result in the latest copy of the narrative', async () => {
  const { attrs, curNarrative, finish } = reflectSetup('LLM view');
  // Saved meanwhile: the state holds a new copy with the user's latest edits
  const latest = structuredClone(curNarrative);
  latest.coas[0].reflection = 'Typed while waiting';
  attrs.state = { ...attrs.state, curNarrative: latest };
  await finish();
  assert.equal(latest.coas[0].reflection, 'Typed while waiting\n\nLLM view');
  assert.equal(curNarrative.coas[0].reflection, 'My own notes');
});

test('"Reflect on decisions" discards the result when the narrative or COA is gone', async () => {
  const switched = reflectSetup('LLM view');
  const other = { id: 'other', components: {}, coas: [{ id: 'a', label: 'A', components: {} }] };
  switched.attrs.state = { ...switched.attrs.state, curNarrative: other };
  await switched.finish();
  assert.equal(other.coas[0].reflection, undefined);
  assert.equal(switched.curNarrative.coas[0].reflection, 'My own notes');

  const removed = reflectSetup('LLM view');
  const latest = { ...removed.curNarrative, coas: [] };
  removed.attrs.state = { ...removed.attrs.state, curNarrative: latest };
  await removed.finish();
  assert.equal(removed.curNarrative.coas[0].reflection, 'My own notes');
});

test('"Reflect on decisions" is hidden without a decision prompt', () => {
  const { CreateScenarioPage } = load();
  const box = scenario(true);
  box.llm = { id: 'clipboard', prompts: [{ type: 'narrative', prompt: 'Write', categories: ['sit'] }] };
  const curNarrative = { id: 'n', components: { threat: ['fire'] }, coas: [{ id: 'a', label: 'A', components: {} }] };
  const attrs = { state: { model: { personas: [], scenario: box }, curNarrative }, update: () => {} };
  const tree = CreateScenarioPage().view({ attrs });
  assert.equal(findAll(tree, (node) => node.attrs?.label === 'REFLECT_ON_DECISIONS').length, 0);
  assert.equal(findAll(tree, (node) => node.attrs?.label === 'COA_REFLECTION').length, 1);
});
