import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { buildStoryInput } from '../src/utils/decision.ts';

const localeSource = (lang) =>
  readFileSync(new URL(`../src/services/translations/${lang}.ts`, import.meta.url), 'utf8');
const localeValue = (source, key) => source.match(new RegExp(`^\\s+${key}: (".*"),$`, 'm'))?.[1];

const tr = (key) => `<${key}>`;

const makeBox = (overrides = {}) => ({
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
    {
      id: 'measure',
      label: 'Measure',
      manual: true,
      values: [
        { id: 'evacuate', label: 'Evacuate' },
        { id: 'shelter', label: 'Shelter in place' },
      ],
    },
    { id: 'comms', label: 'Communication', manual: true, values: [{ id: 'sms', label: 'SMS alert' }] },
  ],
  ...overrides,
});

const narrative = {
  components: {
    place: ['station', 'park'],
    threat: ['fire'],
    weather: ['rain'],
    measure: ['evacuate', 'shelter'],
    comms: [],
  },
};

const all = ['sit', 'other', 'dec'];

test('narrative input has a situation and a suggested-actions section listing all values', () => {
  const input = buildStoryInput({ box: makeBox(), narrative, includedCategories: all, storyType: 'narrative', tr });
  assert.equal(
    input,
    [
      '<LLM_SITUATION>',
      '- Place (Where): Station (Central), Park',
      '- Threat: Fire',
      '- Weather: Rain',
      '',
      '<LLM_SUGGESTED_ACTIONS>',
      '- Measure: Evacuate, Shelter in place',
    ].join('\n'),
  );
});

test('only categories included by the prompt are used', () => {
  const input = buildStoryInput({ box: makeBox(), narrative, includedCategories: ['sit', 'dec'], storyType: 'narrative', tr });
  assert.ok(!input.includes('Weather'));
  assert.ok(input.includes('- Measure: Evacuate, Shelter in place'));
});

test('decision support off: no actions section and an explicit no-measures line', () => {
  const input = buildStoryInput({
    box: makeBox({ includeDecisionSupport: false }),
    narrative,
    includedCategories: all,
    storyType: 'narrative',
    tr,
  });
  assert.ok(input.startsWith('<LLM_SITUATION>\n- Place'));
  assert.ok(!input.includes('<LLM_SUGGESTED_ACTIONS>'));
  assert.ok(!input.includes('Evacuate'));
  assert.ok(input.endsWith('\n\n<LLM_NO_MEASURES_SELECTED>'));
});

test('no decision values selected: no actions section and an explicit no-measures line', () => {
  const input = buildStoryInput({
    box: makeBox(),
    narrative: { components: { ...narrative.components, measure: [] } },
    includedCategories: all,
    storyType: 'narrative',
    tr,
  });
  assert.ok(!input.includes('<LLM_SUGGESTED_ACTIONS>'));
  assert.ok(input.endsWith('<LLM_NO_MEASURES_SELECTED>'));
});

test('a box without decision categories keeps the plain list', () => {
  const box = makeBox({
    categories: [{ id: 'sit', label: 'Situation', componentIds: ['place', 'threat'] }],
  });
  const input = buildStoryInput({ box, narrative, includedCategories: ['sit'], storyType: 'narrative', tr });
  assert.equal(input, '- Place (Where): Station (Central), Park\n- Threat: Fire');
});

test('persona prompts get the same split', () => {
  const input = buildStoryInput({ box: makeBox(), narrative, includedCategories: all, storyType: 'persona', tr });
  assert.ok(input.includes('<LLM_SUGGESTED_ACTIONS>\n- Measure: Evacuate, Shelter in place'));
});

test('effect and communications prompts keep a plain list without inactive decisions', () => {
  const on = buildStoryInput({ box: makeBox(), narrative, includedCategories: all, storyType: 'effect', tr });
  assert.ok(!on.includes('<LLM_SITUATION>'));
  assert.ok(on.includes('- Measure: Evacuate, Shelter in place'));
  const off = buildStoryInput({
    box: makeBox({ includeDecisionSupport: false }),
    narrative,
    includedCategories: all,
    storyType: 'communications',
    tr,
  });
  assert.ok(!off.includes('Evacuate'));
  assert.ok(off.includes('- Threat: Fire'));
});

test('section headings and the no-measures line are translated in all locales', () => {
  const keys = ['LLM_SITUATION', 'LLM_SUGGESTED_ACTIONS', 'LLM_NO_MEASURES_SELECTED'];
  const en = localeSource('en');
  for (const lang of ['en', 'nl', 'fr', 'de', 'es', 'pl']) {
    const source = localeSource(lang);
    for (const key of keys) {
      const value = localeValue(source, key);
      assert.ok(value && JSON.parse(value).length > 0, `${lang} ${key}`);
      if (lang !== 'en') assert.notEqual(value, localeValue(en, key), `${lang} ${key}`);
    }
  }
});
