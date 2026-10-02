import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const esbuild = createRequire(require.resolve('vite/package.json'))('esbuild');
const materialized = require('mithril-materialized');
const source = readFileSync(new URL('../src/components/ui/llm.ts', import.meta.url), 'utf8');
const code = esbuild.transformSync(source, { loader: 'ts', format: 'cjs', target: 'es2022' }).code;

const loadLLM = (client = {}, onSave = () => {}) => {
  const module = { exports: {} };
  const translate = (key, values) =>
    typeof values === 'object'
      ? `${key}: ${Object.entries(values).map(([name, value]) => `${name}=${value}`).join(', ')}`
      : key;
  const mocks = {
    'mithril-ui-form': { LayoutForm: () => {} },
    'mithril-materialized': { ...materialized, toast: () => {} },
    '../../services': { t: translate, i18n: {}, saveModel: async (...args) => onSave(...args) },
    '../../utils/llm-client': { LLMClient: client },
  };
  new Function('require', 'module', 'exports', code)(
    (name) => mocks[name] || require(name),
    module,
    module.exports,
  );
  return module.exports;
};

const categories = [{ id: 'context', label: 'Context', componentIds: ['place', 'measure'] }];
const components = [
  { id: 'place', label: 'Place', values: [{ id: 'station', label: 'Station' }] },
  { id: 'measure', label: 'Measure', values: [{ id: 'closure', label: 'Temporary closure' }] },
];
const narrative = { components: { place: ['station'], measure: ['closure'] } };
const selected = [
  { id: 'a', label: 'Commuter', desc: 'Needs reliable travel information' },
  { id: 'b', label: 'Shop owner', desc: 'Depends on deliveries' },
];
const context = { target: selected[1], selected, narrativeText: 'An incident disrupts the station.' };
const find = (node, predicate) => {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = find(child, predicate);
      if (found) return found;
    }
  } else if (node && typeof node === 'object') {
    if (predicate(node)) return node;
    return find(node.children, predicate);
  }
  return null;
};

test('existing scenarios receive a persona prompt without replacing customized narrative text', async () => {
  const { LLMSelector } = loadLLM();
  const narrativePrompt = { type: 'narrative', prompt: 'My own instructions', categories: ['context'] };
  const model = { scenario: { llm: { id: 'clipboard', prompts: [narrativePrompt] }, categories } };
  const selector = LLMSelector();
  await selector.oninit({ attrs: { state: { model } } });
  assert.equal(model.scenario.llm.prompts[0], narrativePrompt);
  assert.deepEqual(model.scenario.llm.prompts[1], {
    type: 'persona',
    prompt: 'LLM_DEFAULT_PERSONA_PROMPT',
    categories: ['context'],
  });
  await selector.oninit({ attrs: { state: { model } } });
  assert.equal(model.scenario.llm.prompts.length, 2);
});

test('existing customized persona prompt and its category selection remain unchanged', async () => {
  const { LLMSelector } = loadLLM();
  const personaPrompt = { type: 'persona', prompt: 'My feedback instructions', categories: ['other'] };
  const model = { scenario: { llm: { id: 'clipboard', prompts: [personaPrompt] }, categories } };
  await LLMSelector().oninit({ attrs: { state: { model } } });
  assert.equal(model.scenario.llm.prompts[0], personaPrompt);
  assert.deepEqual(personaPrompt, {
    type: 'persona', prompt: 'My feedback instructions', categories: ['other'],
  });
  assert.equal(model.scenario.llm.prompts[1].type, 'narrative');
});

test('one prompt-type selector switches the category and text editor without adding prompts', async () => {
  let saved = 0;
  const { LLMSelector } = loadLLM({}, () => { saved++; });
  const model = { scenario: { categories, llm: { id: 'clipboard', prompts: [
    { type: 'narrative', prompt: 'Narrative instructions', categories: ['context'] },
    { type: 'persona', prompt: 'Persona instructions', categories: ['other'] },
  ] } } };
  const attrs = { state: { model } };
  const editor = LLMSelector();
  await editor.oninit({ attrs });
  const view = () => editor.view({ attrs });
  const control = (label) => find(view(), (node) =>
    node.attrs?.label === label && node.attrs?.onchange && node.attrs?.options);
  const text = () => find(view(), (node) => node.tag === materialized.TextArea);

  assert.ok(!view().children[0].attrs.form[0].type.some((field) => field.id === 'prompts'));
  assert.equal(text().attrs.value, 'Narrative instructions');
  control('PROMPT_TYPE').attrs.onchange(['persona']);
  assert.equal(text().attrs.value, 'Persona instructions');
  assert.deepEqual(control('LLM_INCLUDED_CATEGORIES').attrs.checkedId, ['other']);

  text().attrs.oninput('');
  editor.onbeforeupdate({ attrs });
  assert.equal(text().attrs.value, '');
  text().attrs.oninput('Updated persona feedback');
  await text().attrs.onchange('Updated persona feedback');
  await control('LLM_INCLUDED_CATEGORIES').attrs.onchange(['context']);
  control('PROMPT_TYPE').attrs.onchange(['narrative']);
  assert.equal(text().attrs.value, 'Narrative instructions');
  control('PROMPT_TYPE').attrs.onchange(['persona']);
  assert.equal(text().attrs.value, 'Updated persona feedback');
  assert.deepEqual(control('LLM_INCLUDED_CATEGORIES').attrs.checkedId, ['context']);
  assert.equal(model.scenario.llm.prompts.length, 2);
  assert.equal(saved, 2);
});

test('clipboard persona prompt includes selected descriptions and scenario, targeting one persona', async () => {
  const { generateStory } = loadLLM();
  const result = await generateStory(
    { id: 'clipboard', prompts: [{ type: 'persona', categories: ['context'], prompt: 'Custom feedback instructions' }] },
    narrative, categories, components, 'persona', context,
  );
  for (const expected of [
    'Custom feedback instructions', 'Station', 'Temporary closure',
    'Commuter: Needs reliable travel information', 'Shop owner: Depends on deliveries',
    'LLM_PERSONA_TARGET: persona=Shop owner', 'An incident disrupts the station.',
  ]) assert.ok(result.includes(expected), expected);
});

test('API persona response is preserved verbatim as paste-ready field text', async () => {
  let sent;
  const { generateStory } = loadLLM({
    chatRaw: async (settings, prompt) => {
      sent = { settings, prompt };
      return '  The closure worries me.\nI need a delivery update.  ';
    },
  });
  const result = await generateStory(
    { id: 'openai', apiKey: 'test-key', prompts: [{ type: 'persona', categories: ['context'], prompt: 'Feedback' }] },
    narrative, categories, components, 'persona', context,
  );
  assert.equal(result, 'The closure worries me.\nI need a delivery update.');
  assert.equal(sent.settings.provider, 'openai');
  assert.ok(sent.prompt.includes('LLM_PERSONA_TARGET: persona=Shop owner'));
});

test('API failures do not produce feedback to save', async () => {
  const { generateStory } = loadLLM({ chatRaw: async () => ({ error: true, message: 'API unavailable' }) });
  await assert.rejects(
    generateStory(
      { id: 'ollama', prompts: [{ type: 'persona', categories: ['context'], prompt: 'Feedback' }] },
      narrative, categories, components, 'persona', context,
    ),
    /API unavailable/,
  );
});
