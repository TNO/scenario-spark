import assert from 'node:assert/strict';
import { test } from 'node:test';
import { answerDecisionSupportPrompt, shouldPromptDecisionSupport } from '../src/utils/decision.ts';

const makeScenario = (overrides = {}) => ({
  id: 'box',
  label: 'Box',
  includeDecisionSupport: false,
  categories: [
    { id: 'sit', label: 'Situation', componentIds: ['threat'] },
    { id: 'dec', label: 'Measures', decisionSupport: true, componentIds: ['measure'] },
  ],
  components: [
    { id: 'threat', label: 'Threat', values: [] },
    { id: 'measure', label: 'Measure', manual: true, values: [] },
  ],
  ...overrides,
});

test('prompts once when a scenario has decision categories and decision support is off', () => {
  assert.equal(shouldPromptDecisionSupport(makeScenario()), true);
  assert.equal(shouldPromptDecisionSupport(makeScenario({ includeDecisionSupport: true })), false);
  assert.equal(shouldPromptDecisionSupport(makeScenario({ decisionSupportPrompted: true })), false);
  assert.equal(
    shouldPromptDecisionSupport(makeScenario({ categories: [{ id: 'sit', label: 'S', componentIds: ['threat'] }] })),
    false
  );
  assert.equal(shouldPromptDecisionSupport(undefined), false);
});

test('answering the prompt remembers it and optionally turns decision support on', () => {
  const later = makeScenario();
  answerDecisionSupportPrompt(later, false);
  assert.equal(later.decisionSupportPrompted, true);
  assert.equal(later.includeDecisionSupport, false);
  assert.equal(shouldPromptDecisionSupport(later), false);
  const now = makeScenario();
  answerDecisionSupportPrompt(now, true);
  assert.equal(now.decisionSupportPrompted, true);
  assert.equal(now.includeDecisionSupport, true);
});

test('turning decision support on from the prompt adds the decision-reflection LLM prompt', async () => {
  const { readFileSync } = await import('node:fs');
  const { createRequire } = await import('node:module');
  const require = createRequire(import.meta.url);
  const esbuild = createRequire(require.resolve('vite/package.json'))('esbuild');
  const source = readFileSync(new URL('../src/components/ui/decision-support-prompt.ts', import.meta.url), 'utf8');
  const code = esbuild.transformSync(source, { loader: 'ts', format: 'cjs', target: 'es2022' }).code;
  let ensured;
  let saved = false;
  let buttons = [];
  const mocks = {
    mithril: (_tag, attrs) => {
      if (attrs?.buttons) buttons = attrs.buttons;
      return attrs;
    },
    'mithril-materialized': { ModalPanel: {} },
    '../../models': { Dashboards: { HOME: 'home' } },
    '../../services': { t: (key) => key, saveModel: async () => (saved = true) },
    '../../utils/decision': { answerDecisionSupportPrompt, shouldPromptDecisionSupport },
    './llm': { ensureDefaultLLMConfig: (scenario, categories) => (ensured = { scenario, categories }) },
  };
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)((name) => mocks[name] || require(name), module, module.exports);
  const scenario = makeScenario();
  const state = { model: { scenario }, modelReady: true, page: 'create' };
  const attrs = { state, getState: () => state };
  module.exports.DecisionSupportPrompt().view({ attrs });
  await buttons[1].onclick();
  assert.equal(scenario.includeDecisionSupport, true);
  assert.equal(ensured.scenario, scenario);
  assert.equal(ensured.categories, scenario.categories);
  assert.equal(saved, true);
});
