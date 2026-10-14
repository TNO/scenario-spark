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
