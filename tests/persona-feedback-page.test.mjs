import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const esbuild = createRequire(require.resolve('vite/package.json'))('esbuild');
const materialized = require('mithril-materialized');
const MarkdownEditor = () => {};
require('mithril').redraw = () => {};
const source = readFileSync(new URL('../src/components/create-scenario-page.ts', import.meta.url), 'utf8');
const code = esbuild.transformSync(source, { loader: 'ts', format: 'cjs', target: 'es2022' }).code;

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

const findAll = (node, predicate) => {
  if (Array.isArray(node)) return node.flatMap((child) => findAll(child, predicate));
  if (!node || typeof node !== 'object') return [];
  return [
    ...(predicate(node) ? [node] : []),
    ...findAll(node.children, predicate),
  ];
};

const setup = (provider, withSecondPersona = false, themePreference = 'auto') => {
  const persona = { id: 'resident', label: 'Resident', desc: 'Needs accessible updates' };
  const secondPersona = { id: 'visitor', label: 'Visitor', desc: 'Needs clear directions' };
  const personas = withSecondPersona ? [persona, secondPersona] : [persona];
  const narrative = {
    id: 'n1', label: 'Incident', saved: true, included: false,
    desc: 'An incident occurs.', components: { place: ['station'] }, personaEffects: {},
  };
  const model = {
    personas,
    scenario: {
      llm: { id: provider, prompts: [
        { type: 'narrative', prompt: 'Story', categories: ['context'] },
        { type: 'persona', prompt: 'Feedback', categories: ['context'] },
      ] },
      personas: personas.map(({ id }) => id), includeDecisionSupport: false, categories: [],
      components: [], narratives: [narrative], hideInconsistentValues: false,
    },
  };
  const saved = [];
  const calls = [];
  const module = { exports: {} };
  const mocks = {
    'mithril-materialized': {
      ...materialized,
      ThemeManager: { getTheme: () => themePreference },
      toast: () => {},
    },
    'mithril-ui-form': { range: () => [], render: (value) => value },
    '../models': { Dashboards: { CREATE_SCENARIO: 'create' } },
    '../services': {
      t: (key, params) => params
        ? `${key}: ${params.persona}`
        : key,
      setPage: () => {}, saveModel: async () => {},
      updateNarrative: async (_, value) => { saved.push(value.personaEffects[persona.id]?.story); },
    },
    '../utils': {
      narrativesToOptions: () => [], generateUniqueTitle: () => '',
      deepCopy: (value) => structuredClone(value),
    },
    './ui': {
      ensureDefaultLLMConfig: () => false,
      generateStory: async (...args) => {
        calls.push(args);
        return `${provider === 'clipboard' ? 'Prompt' : 'Feedback'} for ${args[5].target.label.toLowerCase()}`;
      },
    },
    '../models/persona-images': { PersonaImages: [] },
    'mithril-markdown-wysiwyg': { MarkdownEditor },
    '../utils/index': { quillToMarkdown: (value) => value },
    './ui/scenario-paragraph': { ScenarioParagraph: () => {} },
  };
  new Function('require', 'module', 'exports', code)(
    (name) => mocks[name] || require(name), module, module.exports,
  );
  const attrs = { state: { model, curNarrative: narrative }, update: () => {}, getState: () => attrs.state };
  const page = module.exports.CreateScenarioPage();
  const button = () => find(
    page.view({ attrs }),
    (node) => node.tag === materialized.FlatButton &&
      node.attrs.label === (provider === 'clipboard' ? 'COPY_PERSONA_PROMPT' : 'GENERATE_PERSONA_FEEDBACK'),
  );
  const field = () => find(
    page.view({ attrs }),
    (node) => node.tag === materialized.TextArea && node.attrs.label === 'PERSONA_IMPRESSION',
  );
  const render = () => page.view({ attrs });
  const editor = () => find(render(), (node) => node.tag === MarkdownEditor);
  const actions = () => findAll(
    render(),
    (node) => node.tag === materialized.FlatButton &&
      (node.attrs?.['aria-label']?.startsWith('COPY_PERSONA_PROMPT_FOR') ||
        node.attrs?.['aria-label']?.startsWith('GENERATE_PERSONA_FEEDBACK_FOR')),
  );
  return { button, field, render, editor, actions, calls, narrative, persona, saved };
};

test('markdown editor receives the app theme including auto mode', () => {
  for (const theme of ['auto', 'dark', 'light']) {
    assert.equal(setup('clipboard', false, theme).editor().attrs.theme, theme);
  }
});

test('provider feedback saves to the matching persona without replacing narrative text', async () => {
  const { button, calls, narrative, persona, saved } = setup('ollama');
  assert.ok(button());
  await button().attrs.onclick();
  assert.deepEqual(saved, ['Feedback for resident']);
  assert.equal(narrative.personaEffects[persona.id].story, 'Feedback for resident');
  assert.equal(narrative.desc, 'An incident occurs.');
  assert.equal(calls[0][4], 'persona');
  assert.equal(calls[0][5].target, persona);
  assert.equal(calls[0][5].narrativeText, narrative.desc);
});

test('clipboard feedback copies a prompt and leaves existing field text untouched', async () => {
  const { button, narrative, persona } = setup('clipboard');
  narrative.personaEffects[persona.id] = { story: 'Existing feedback' };
  let copied;
  const originalNavigator = globalThis.navigator;
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true, value: { clipboard: { writeText: async (text) => { copied = text; } } },
  });

  try {
    await button().attrs.onclick();
    assert.equal(copied, 'Prompt for resident');
    assert.equal(narrative.personaEffects[persona.id].story, 'Existing feedback');
  } finally {
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: originalNavigator });
  }
});

test('pasting feedback saves immediately without requiring the field to lose focus', () => {
  const { field, narrative, persona, saved } = setup('clipboard');
  field().attrs.oninput('Pasted feedback');
  assert.equal(narrative.personaEffects[persona.id].story, 'Pasted feedback');
  assert.deepEqual(saved, ['Pasted feedback']);
});

test('only first persona has the full button label and paste guidance is a tooltip', () => {
  const { actions, render } = setup('clipboard', true);
  assert.deepEqual(actions().map(({ attrs }) => attrs.label), [
    'COPY_PERSONA_PROMPT', 'COPY_PERSONA_PROMPT_SHORT',
  ]);
  assert.deepEqual(actions().map(({ attrs }) => attrs['aria-label']), [
    'COPY_PERSONA_PROMPT_FOR: Resident',
    'COPY_PERSONA_PROMPT_FOR: Visitor',
  ]);
  assert.ok(actions().every(({ attrs }) => attrs.title === 'PERSONA_PASTE_HINT'));
  assert.equal(findAll(render(), (node) => node.tag === 'p' &&
    node.children?.includes('PERSONA_PASTE_HINT')).length, 0);
});

test('provider feedback button is abbreviated only after the first persona', async () => {
  const { actions, calls, narrative } = setup('ollama', true);
  assert.deepEqual(actions().map(({ attrs }) => attrs.label), [
    'GENERATE_PERSONA_FEEDBACK', 'GENERATE_PERSONA_FEEDBACK_SHORT',
  ]);
  assert.deepEqual(actions().map(({ attrs }) => attrs['aria-label']), [
    'GENERATE_PERSONA_FEEDBACK_FOR: Resident',
    'GENERATE_PERSONA_FEEDBACK_FOR: Visitor',
  ]);
  assert.ok(actions().every(({ attrs }) => !attrs.title));
  await actions()[1].attrs.onclick();
  assert.equal(calls[0][5].target.label, 'Visitor');
  assert.equal(narrative.personaEffects.visitor.story, 'Feedback for visitor');
  assert.equal(narrative.personaEffects.resident, undefined);
});
