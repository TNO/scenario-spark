import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import * as decision from '../src/utils/decision.ts';

const { buildDecisionInput } = decision;
const require = createRequire(import.meta.url);
const esbuild = createRequire(require.resolve('vite/package.json'))('esbuild');
const materialized = require('mithril-materialized');

const tr = (key, params) => (params ? `<${key} ${JSON.stringify(params)}>` : `<${key}>`);

const box = {
  includeDecisionSupport: true,
  categories: [
    { id: 'sit', label: 'Situation', componentIds: ['place', 'threat'] },
    { id: 'other', label: 'Other', componentIds: ['weather'] },
    { id: 'dec', label: 'Measures', decisionSupport: true, componentIds: ['measure', 'comms'] },
  ],
  components: [
    { id: 'place', label: 'Place', desc: 'Where', values: [{ id: 'station', label: 'Station', desc: 'Central' }, { id: 'park', label: 'Park' }] },
    { id: 'threat', label: 'Threat', values: [{ id: 'fire', label: 'Fire' }] },
    { id: 'weather', label: 'Weather', values: [{ id: 'rain', label: 'Rain' }] },
    { id: 'measure', label: 'Measure', manual: true, values: [{ id: 'evacuate', label: 'Evacuate' }, { id: 'shelter', label: 'Shelter in place' }] },
    { id: 'comms', label: 'Communication', manual: true, values: [{ id: 'sms', label: 'SMS alert' }] },
  ],
};

const narrative = () => ({
  components: { place: ['station', 'park'], threat: ['fire'], weather: ['rain'] },
  activeCoaId: 'b',
  coas: [
    { id: 'a', label: 'A', desc: 'Evacuate early', components: { measure: ['evacuate'] } },
    { id: 'b', label: 'B', components: { measure: ['evacuate', 'shelter'], comms: ['sms'] } },
    { id: 'c', label: 'Wait', components: {} },
  ],
});

test('decision input lists the situation, the narrative text, the COA decisions and the other COAs', () => {
  const input = buildDecisionInput({ box, narrative: narrative(), narrativeText: 'A fire at the station.', tr });
  assert.equal(
    input,
    [
      '<LLM_DECISION_SITUATION>',
      '- Place (Where): Station (Central), Park',
      '- Threat: Fire',
      '- Weather: Rain',
      '',
      '<LLM_SCENARIO_TEXT {"narrative":"A fire at the station."}>',
      '',
      '<LLM_COA_DECISIONS {"coa":"B"}>',
      '- Measure: Evacuate, Shelter in place',
      '- Communication: SMS alert',
      '',
      '<LLM_OTHER_COAS>',
      '- A: Evacuate early',
      '- Wait',
    ].join('\n'),
  );
});

test('decision input uses the given COA and leaves out an empty narrative text', () => {
  const input = buildDecisionInput({ box, narrative: narrative(), coaId: 'a', narrativeText: '  ', tr });
  assert.ok(!input.includes('LLM_SCENARIO_TEXT'));
  assert.ok(input.includes('<LLM_COA_DECISIONS {"coa":"A"}>\n- Measure: Evacuate'));
  assert.ok(!input.includes('Shelter in place'));
  assert.ok(input.includes('<LLM_OTHER_COAS>\n- B\n- Wait'));
});

test('decision input states when the COA has no decisions and omits other COAs when there are none', () => {
  const n = narrative();
  n.coas = [n.coas[2]];
  n.activeCoaId = 'c';
  const input = buildDecisionInput({ box, narrative: n, tr });
  assert.ok(input.endsWith('<LLM_COA_NO_DECISIONS {"coa":"Wait"}>'));
  assert.ok(!input.includes('LLM_OTHER_COAS'));
});

test('included categories filter the situation, never the decisions', () => {
  const input = buildDecisionInput({ box, narrative: narrative(), includedCategories: ['sit'], tr });
  assert.ok(!input.includes('Weather'));
  assert.ok(input.includes('- Place (Where)'));
  assert.ok(input.includes('- Measure: Evacuate, Shelter in place'));
});

test('decision values stored in the situation (unmigrated) are not part of the situation section', () => {
  const n = { components: { place: ['park'], measure: ['shelter'] } };
  const input = buildDecisionInput({ box, narrative: n, tr });
  assert.equal(
    input,
    ['<LLM_DECISION_SITUATION>', '- Place (Where): Park', '', '<LLM_COA_DECISIONS {"coa":"A"}>', '- Measure: Shelter in place'].join('\n'),
  );
});

const loadLLM = (client = {}) => {
  const source = readFileSync(new URL('../src/components/ui/llm.ts', import.meta.url), 'utf8');
  const code = esbuild.transformSync(source, { loader: 'ts', format: 'cjs', target: 'es2022' }).code;
  const module = { exports: {} };
  const translate = (key, values) =>
    typeof values === 'object' ? `${key}: ${Object.values(values).join(', ')}` : key;
  const mocks = {
    'mithril-ui-form': { LayoutForm: () => {} },
    'mithril-materialized': { ...materialized, toast: () => {} },
    '../../services': { t: translate, i18n: {}, saveModel: async () => {} },
    '../../utils/llm-client': { LLMClient: client },
    '../../utils/decision': decision,
  };
  new Function('require', 'module', 'exports', code)((name) => mocks[name] || require(name), module, module.exports);
  return module.exports;
};

test('ensureDefaultLLMConfig adds the decision prompt only when decision support is on and keeps user text', () => {
  const { ensureDefaultLLMConfig } = loadLLM();
  const off = { ...structuredClone(box), includeDecisionSupport: false };
  ensureDefaultLLMConfig(off, off.categories);
  assert.ok(!off.llm.prompts.some((p) => p.type === 'decision'));

  const on = structuredClone(box);
  assert.equal(ensureDefaultLLMConfig(on, on.categories), true);
  assert.deepEqual(on.llm.prompts.find((p) => p.type === 'decision'), {
    type: 'decision',
    prompt: 'LLM_DEFAULT_DECISION_PROMPT',
    categories: ['sit', 'other', 'dec'],
  });

  off.includeDecisionSupport = true;
  assert.equal(ensureDefaultLLMConfig(off, off.categories), true);
  const prompt = off.llm.prompts.find((p) => p.type === 'decision');
  prompt.prompt = 'My own assessment instructions';
  assert.equal(ensureDefaultLLMConfig(off, off.categories), false);
  assert.equal(prompt.prompt, 'My own assessment instructions');
});

test('generateStory with the decision prompt returns the full prompt in clipboard mode', async () => {
  const { ensureDefaultLLMConfig, generateStory } = loadLLM();
  const scenario = structuredClone(box);
  ensureDefaultLLMConfig(scenario, scenario.categories);
  const prompt = await generateStory(scenario.llm, narrative(), scenario, 'decision', undefined, {
    coaId: 'a',
    narrativeText: 'A fire at the station.',
  });
  assert.ok(prompt.startsWith('LLM_DEFAULT_DECISION_PROMPT\n\nLLM_DECISION_SITUATION\n- Place'));
  assert.ok(prompt.includes('LLM_SCENARIO_TEXT: A fire at the station.'));
  assert.ok(prompt.includes('LLM_COA_DECISIONS: A\n- Measure: Evacuate'));
});

test('generateStory with the decision prompt returns the raw LLM answer', async () => {
  const calls = [];
  const { ensureDefaultLLMConfig, generateStory } = loadLLM({
    chatRaw: async (config, userPrompt) => {
      calls.push(userPrompt);
      return '  Timing is late.  ';
    },
  });
  const scenario = structuredClone(box);
  ensureDefaultLLMConfig(scenario, scenario.categories);
  scenario.llm.id = 'ollama';
  scenario.llm.url = 'http://localhost:11434';
  const answer = await generateStory(scenario.llm, narrative(), scenario, 'decision');
  assert.equal(answer, 'Timing is late.');
  assert.equal(calls.length, 1);
  assert.ok(calls[0].includes('LLM_COA_DECISIONS: B'));
});

test('decision prompt texts and reflection labels exist in all locales', () => {
  for (const lang of ['en', 'nl', 'fr', 'de', 'es', 'pl']) {
    const source = readFileSync(new URL(`../src/services/translations/${lang}.ts`, import.meta.url), 'utf8');
    for (const key of [
      'LLM_DEFAULT_DECISION_PROMPT',
      'LLM_DECISION_SITUATION',
      'LLM_COA_DECISIONS',
      'LLM_COA_NO_DECISIONS',
      'LLM_OTHER_COAS',
      'REFLECT_ON_DECISIONS',
      'COA_REFLECTION',
      'DECISION_PROMPT_COPIED',
      'DECISION_REFLECTION_ERROR',
    ]) {
      assert.ok(new RegExp(`^\\s+${key}:`, 'm').test(source), `${lang}: ${key}`);
    }
    assert.ok(/^\s+DECISION: /m.test(source), `${lang}: PROMPT_TYPE.DECISION`);
  }
});
