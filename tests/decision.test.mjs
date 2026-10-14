import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  applyDecisionCategoryManual,
  decisionExclusions,
  decisionSupportActive,
  generationLocks,
  getDecisionCategoryIds,
  narrativeDecisionRows,
  splitDecisionComponents,
} from '../src/utils/decision.ts';

const makeScenario = (overrides = {}) => ({
  id: 'box',
  label: 'Box',
  includeDecisionSupport: true,
  hideInconsistentValues: false,
  categories: [
    { id: 'sit', label: 'Situation', componentIds: ['place', 'threat'] },
    { id: 'dec', label: 'Measures', decisionSupport: true, componentIds: ['measure', 'place'] },
  ],
  components: [
    { id: 'place', label: 'Place', manual: true, values: [{ id: 'station', label: 'Station' }, { id: 'park', label: 'Park' }] },
    { id: 'threat', label: 'Threat', values: [{ id: 'fire', label: 'Fire' }, { id: 'flood', label: 'Flood' }] },
    {
      id: 'measure',
      label: 'Measure',
      manual: true,
      values: [
        { id: 'evacuate', label: 'Evacuate' },
        { id: 'shelter', label: 'Shelter in place' },
        { id: 'water', label: 'Use water' },
      ],
    },
  ],
  inconsistencies: {
    flood: { water: true, shelter: false },
    evacuate: { station: true },
  },
  narratives: [],
  thresholdColors: [],
  ...overrides,
});

test('splits categories and components into situation and decisions', () => {
  const split = splitDecisionComponents(makeScenario());
  assert.deepEqual(split.situationCategories.map((c) => c.id), ['sit']);
  assert.deepEqual(split.decisionCategories.map((c) => c.id), ['dec']);
  // a component in both a situation and a decision category stays a situation component
  assert.deepEqual(split.situation.map((c) => c.id), ['place', 'threat']);
  assert.deepEqual(split.decisions.map((c) => c.id), ['measure']);
  assert.deepEqual([...split.decisionIds], ['measure']);
});

test('a box without decision categories has no decisions', () => {
  const scenario = makeScenario({
    categories: [{ id: 'sit', label: 'Situation', componentIds: ['place', 'threat', 'measure'] }],
  });
  const split = splitDecisionComponents(scenario);
  assert.equal(split.decisions.length, 0);
  assert.equal(split.situation.length, 3);
  assert.equal(decisionSupportActive(scenario), false);
});

test('decision support is active only when switched on and decision categories exist', () => {
  assert.equal(decisionSupportActive(makeScenario()), true);
  assert.equal(decisionSupportActive(makeScenario({ includeDecisionSupport: false })), false);
});

test('generation keeps manual situation values and the chosen decisions when on', () => {
  const scenario = makeScenario();
  const selection = { place: ['park'], threat: ['fire'], measure: ['evacuate'] };
  const locks = generationLocks(scenario, selection, { threat: true });
  assert.deepEqual(locks, { threat: ['fire'], place: ['park'], measure: ['evacuate'] });
});

test('generation leaves decisions empty when decision support is off', () => {
  const scenario = makeScenario({ includeDecisionSupport: false });
  const selection = { place: ['park'], threat: ['fire'], measure: ['evacuate'] };
  const locks = generationLocks(scenario, selection, { measure: true });
  assert.deepEqual(locks, { place: ['park'], measure: [] });
});

test('generation never fills a decision component, even if it is not manual', () => {
  const scenario = makeScenario();
  scenario.components[2].manual = false;
  const locks = generationLocks(scenario, {}, {});
  assert.deepEqual(locks.measure, []);
});

test('lists the situation values that exclude each decision value', () => {
  const scenario = makeScenario();
  const exclusions = decisionExclusions(scenario, { threat: ['flood'], place: ['station'] });
  assert.deepEqual(exclusions, {
    water: [{ componentId: 'threat', valueId: 'flood', label: 'Flood' }],
    evacuate: [{ componentId: 'place', valueId: 'station', label: 'Station' }],
  });
  // unlikely combinations do not exclude
  assert.equal(exclusions.shelter, undefined);
  assert.deepEqual(decisionExclusions(scenario, {}), {});
});

test('ticking a decision category makes its components manual', () => {
  const scenario = makeScenario({
    categories: [
      { id: 'sit', label: 'Situation', componentIds: ['threat'] },
      { id: 'dec', label: 'Measures', decisionSupport: true, componentIds: ['measure'] },
    ],
  });
  scenario.components[2].manual = false;
  assert.deepEqual([...getDecisionCategoryIds(scenario)], ['dec']);
  assert.equal(applyDecisionCategoryManual(scenario, new Set()), true);
  assert.equal(scenario.components[2].manual, true);
  assert.equal(scenario.components[1].manual, undefined);
  // already ticked before: nothing changes, user may switch manual off again
  scenario.components[2].manual = false;
  assert.equal(applyDecisionCategoryManual(scenario, new Set(['dec'])), false);
  assert.equal(scenario.components[2].manual, false);
});

test('unticking a decision category leaves manual untouched', () => {
  const scenario = makeScenario();
  scenario.categories[1].decisionSupport = false;
  assert.equal(applyDecisionCategoryManual(scenario, new Set(['dec'])), false);
  assert.equal(scenario.components[2].manual, true);
});

test('lists the decisions of a narrative only when decision support is active', () => {
  const narrative = { id: 'n', label: 'N', included: true, components: { threat: ['fire'], measure: ['evacuate', 'water'] } };
  assert.deepEqual(narrativeDecisionRows(makeScenario(), narrative), [
    { label: 'Measure', values: ['Evacuate', 'Use water'] },
  ]);
  assert.deepEqual(narrativeDecisionRows(makeScenario({ includeDecisionSupport: false }), narrative), []);
  assert.deepEqual(narrativeDecisionRows(makeScenario(), { ...narrative, components: { threat: ['fire'] } }), []);
});
