import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  SCENARIO_DATA_VERSION,
  activeCoa,
  addCoa,
  buildStoryInput,
  coaConflicts,
  duplicateCoa,
  effectiveSelection,
  ensureActiveCoa,
  migrateModel,
  moveDecisionsToCoas,
  syncNarrativeDecisions,
  appendReflection,
  reflectionTarget,
  narrativeCoaRows,
  nextCoaLabel,
  removeCoa,
} from '../src/utils/decision.ts';

const makeScenario = (overrides = {}) => ({
  id: 'box',
  label: 'Box',
  includeDecisionSupport: true,
  categories: [
    { id: 'sit', label: 'Situation', componentIds: ['threat'] },
    { id: 'dec', label: 'Measures', decisionSupport: true, componentIds: ['measure', 'comms'] },
  ],
  components: [
    { id: 'threat', label: 'Threat', values: [{ id: 'fire', label: 'Fire' }, { id: 'flood', label: 'Flood' }] },
    {
      id: 'measure',
      label: 'Measure',
      manual: true,
      values: [
        { id: 'evacuate', label: 'Evacuate' },
        { id: 'water', label: 'Use water' },
      ],
    },
    { id: 'comms', label: 'Communication', manual: true, values: [{ id: 'sms', label: 'SMS' }] },
  ],
  inconsistencies: { flood: { water: true }, water: { flood: true } },
  narratives: [],
  ...overrides,
});

let counter = 0;
const makeId = () => `id${++counter}`;

test('nextCoaLabel picks the first free letter', () => {
  assert.equal(nextCoaLabel([]), 'A');
  assert.equal(nextCoaLabel([{ label: 'A' }, { label: 'C' }]), 'B');
  const all = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((label) => ({ label }));
  assert.equal(nextCoaLabel(all), 'AA');
});

test('migration moves decision selections into COA "A" and keeps the situation', () => {
  const narrative = {
    id: 'n1',
    label: 'Incident',
    desc: 'User text',
    components: { threat: ['fire'], measure: ['evacuate', 'water'], comms: [] },
  };
  const box = makeScenario({ narratives: [narrative] });
  const model = { scenario: box, scenarios: [] };
  assert.equal(migrateModel(model, makeId), true);
  const [n] = box.narratives;
  assert.deepEqual(n.components, { threat: ['fire'] });
  assert.equal(n.coas.length, 1);
  assert.equal(n.coas[0].label, 'A');
  assert.deepEqual(n.coas[0].components, { measure: ['evacuate', 'water'] });
  assert.equal(n.activeCoaId, n.coas[0].id);
  assert.equal(n.desc, 'User text');
  assert.equal(n.label, 'Incident');
  assert.equal(box.dataVersion, SCENARIO_DATA_VERSION);
  // Versioned: running it again changes nothing
  assert.equal(migrateModel(model, makeId), false);
});

test('migration also handles the scenarios in the collection, even when decision support is off', () => {
  const other = makeScenario({
    id: 'other',
    includeDecisionSupport: false,
    narratives: [{ id: 'n', components: { threat: ['flood'], measure: ['water'] } }],
  });
  const model = { scenario: makeScenario(), scenarios: [other] };
  migrateModel(model, makeId);
  assert.deepEqual(other.narratives[0].components, { threat: ['flood'] });
  assert.deepEqual(other.narratives[0].coas[0].components, { measure: ['water'] });
});

test('migration does not create a COA when no decisions are selected', () => {
  const narrative = { id: 'n', components: { threat: ['fire'], measure: [] } };
  const box = makeScenario({ narratives: [narrative] });
  migrateModel({ scenario: box, scenarios: [] }, makeId);
  assert.equal(box.narratives[0].coas, undefined);
  assert.deepEqual(box.narratives[0].components, { threat: ['fire'] });
});

test('moving decisions never overwrites a COA: conflicting selections get a new COA', () => {
  const narrative = {
    id: 'n',
    components: { threat: ['fire'], measure: ['water'], comms: ['sms'] },
    coas: [{ id: 'a', label: 'A', components: { measure: ['evacuate'] } }],
    activeCoaId: 'a',
  };
  assert.equal(moveDecisionsToCoas(makeScenario(), narrative, makeId), true);
  assert.deepEqual(narrative.components, { threat: ['fire'] });
  assert.deepEqual(narrative.coas[0].components, { measure: ['evacuate'] });
  assert.equal(narrative.coas[1].label, 'B');
  assert.deepEqual(narrative.coas[1].components, { measure: ['water'], comms: ['sms'] });
  assert.equal(narrative.activeCoaId, 'a');
});

test('moving decisions merges into the active COA when it has no selection for them', () => {
  const narrative = {
    id: 'n',
    components: { threat: ['fire'], comms: ['sms'] },
    coas: [{ id: 'a', label: 'A', components: { measure: ['evacuate'] } }],
  };
  moveDecisionsToCoas(makeScenario(), narrative, makeId);
  assert.equal(narrative.coas.length, 1);
  assert.deepEqual(narrative.coas[0].components, { measure: ['evacuate'], comms: ['sms'] });
});

test('effectiveSelection merges the situation with the active or the given COA', () => {
  const narrative = {
    components: { threat: ['fire'], measure: [] },
    coas: [
      { id: 'a', label: 'A', components: { measure: ['evacuate'] } },
      { id: 'b', label: 'B', components: { measure: ['water'], comms: ['sms'] } },
    ],
    activeCoaId: 'b',
  };
  const box = makeScenario();
  assert.deepEqual(effectiveSelection(box, narrative), { threat: ['fire'], measure: ['water'], comms: ['sms'] });
  assert.deepEqual(effectiveSelection(box, narrative, 'a'), { threat: ['fire'], measure: ['evacuate'] });
  assert.deepEqual(effectiveSelection(box, narrative, 'unknown'), { threat: ['fire'], measure: [] });
  // Without an active id, the first COA is used
  assert.deepEqual(effectiveSelection(box, { ...narrative, activeCoaId: undefined }).measure, ['evacuate']);
  assert.deepEqual(effectiveSelection(box, { components: { threat: ['fire'] } }), { threat: ['fire'] });
  // Does not mutate the narrative
  assert.deepEqual(narrative.components, { threat: ['fire'], measure: [] });
});

test('COA values that conflict with the situation are flagged, not removed', () => {
  const narrative = {
    components: { threat: ['flood'] },
    coas: [
      { id: 'a', label: 'A', components: { measure: ['water', 'evacuate'] } },
      { id: 'b', label: 'B', components: { measure: ['evacuate'] } },
    ],
  };
  const box = makeScenario();
  assert.deepEqual(coaConflicts(box, narrative, narrative.coas[0]), [
    {
      componentId: 'measure',
      componentLabel: 'Measure',
      valueId: 'water',
      label: 'Use water',
      causes: [{ componentId: 'threat', valueId: 'flood', label: 'Flood' }],
    },
  ]);
  assert.deepEqual(narrative.coas[0].components.measure, ['water', 'evacuate']);
  assert.deepEqual(coaConflicts(box, narrative, narrative.coas[1]), []);
  // When the situation changes, the flag disappears
  narrative.components.threat = ['fire'];
  assert.deepEqual(coaConflicts(box, narrative, narrative.coas[0]), []);
});

test('add, duplicate and remove COAs', () => {
  const narrative = { components: { threat: ['fire'] } };
  const a = ensureActiveCoa(narrative, makeId);
  assert.equal(a.label, 'A');
  assert.equal(ensureActiveCoa(narrative, makeId), a);
  a.components.measure = ['evacuate'];
  a.notes = 'Note';
  const b = duplicateCoa(narrative, makeId);
  assert.equal(b.label, 'B');
  assert.deepEqual(b.components, { measure: ['evacuate'] });
  assert.equal(b.notes, 'Note');
  b.components.measure.push('water');
  assert.deepEqual(a.components.measure, ['evacuate']);
  assert.equal(narrative.activeCoaId, b.id);
  const c = addCoa(narrative, makeId);
  assert.equal(c.label, 'C');
  assert.deepEqual(c.components, {});
  assert.equal(activeCoa(narrative), c);
  removeCoa(narrative, c.id);
  assert.deepEqual(narrative.coas.map((x) => x.label), ['A', 'B']);
  assert.equal(narrative.activeCoaId, a.id);
  removeCoa(narrative, a.id);
  removeCoa(narrative, b.id);
  assert.deepEqual(narrative.coas, []);
  assert.equal(narrative.activeCoaId, undefined);
});

test('narrativeCoaRows lists every COA with its decisions and conflicts', () => {
  const narrative = {
    components: { threat: ['flood'] },
    coas: [
      { id: 'a', label: 'A', notes: 'Fast', components: { measure: ['water'] } },
      { id: 'b', label: 'B', components: { measure: ['evacuate'], comms: ['sms'] } },
      { id: 'c', label: 'C', components: {} },
    ],
    activeCoaId: 'b',
  };
  assert.deepEqual(narrativeCoaRows(makeScenario(), narrative), [
    {
      id: 'a',
      label: 'A',
      desc: undefined,
      notes: 'Fast',
      active: false,
      decisions: [{ label: 'Measure', values: ['Use water'] }],
      conflicts: [{ label: 'Use water', situation: 'Flood' }],
    },
    {
      id: 'b',
      label: 'B',
      desc: undefined,
      notes: undefined,
      active: true,
      decisions: [
        { label: 'Measure', values: ['Evacuate'] },
        { label: 'Communication', values: ['SMS'] },
      ],
      conflicts: [],
    },
  ]);
  // Without COAs, the decisions in the narrative (not yet migrated) form one unnamed row
  assert.deepEqual(
    narrativeCoaRows(makeScenario(), { components: { threat: ['fire'], measure: ['evacuate'] } }).map((r) => r.decisions),
    [[{ label: 'Measure', values: ['Evacuate'] }]],
  );
  assert.deepEqual(narrativeCoaRows(makeScenario({ includeDecisionSupport: false }), narrative), []);
});

test('the narrative prompt uses the active COA as suggested actions', () => {
  const narrative = {
    components: { threat: ['fire'] },
    coas: [
      { id: 'a', label: 'A', components: { measure: ['evacuate'] } },
      { id: 'b', label: 'B', components: { measure: ['water'] } },
    ],
    activeCoaId: 'b',
  };
  const input = buildStoryInput({
    box: makeScenario(),
    narrative,
    includedCategories: ['sit', 'dec'],
    tr: (key) => key,
  });
  assert.equal(input, 'LLM_SITUATION\n- Threat: Fire\n\nLLM_SUGGESTED_ACTIONS\n- Measure: Use water');
});

test('effectiveSelection only overlays COA values of current decision factors', () => {
  const box = makeScenario();
  // "threat" is no longer a decision factor: a stale COA value must not win
  const narrative = {
    components: { threat: ['fire'] },
    coas: [{ id: 'a', label: 'A', components: { threat: ['flood'], measure: ['evacuate'] } }],
  };
  assert.deepEqual(effectiveSelection(box, narrative), { threat: ['fire'], measure: ['evacuate'] });
  // After unticking the decision category, nothing is overlaid
  const unticked = makeScenario();
  unticked.categories[1].decisionSupport = false;
  assert.deepEqual(effectiveSelection(unticked, narrative), { threat: ['fire'] });
});

test('syncNarrativeDecisions moves new decision values to a COA (idempotent)', () => {
  const narrative = { id: 'n', components: { threat: ['fire'], measure: ['water'] } };
  assert.equal(syncNarrativeDecisions(makeScenario(), narrative, makeId), true);
  assert.deepEqual(narrative.components, { threat: ['fire'] });
  assert.deepEqual(narrative.coas[0].components, { measure: ['water'] });
  const snapshot = JSON.stringify(narrative);
  assert.equal(syncNarrativeDecisions(makeScenario(), narrative, makeId), false);
  assert.equal(JSON.stringify(narrative), snapshot);
});

test('syncNarrativeDecisions moves values of unticked decision factors back to the situation', () => {
  const box = makeScenario();
  box.categories[1].decisionSupport = false;
  const narrative = {
    id: 'n',
    components: { threat: ['fire'], comms: ['situation-sms'] },
    coas: [
      { id: 'a', label: 'A', components: { measure: ['water'], comms: ['sms'] }, notes: 'keep' },
      { id: 'b', label: 'B', components: { measure: ['evacuate'] } },
    ],
    activeCoaId: 'b',
  };
  assert.equal(syncNarrativeDecisions(box, narrative, makeId), true);
  // Active COA values move back; an existing situation value is never overwritten
  assert.deepEqual(narrative.components, { threat: ['fire'], comms: ['situation-sms'], measure: ['evacuate'] });
  assert.deepEqual(narrative.coas[0].components, {});
  assert.deepEqual(narrative.coas[1].components, {});
  assert.equal(narrative.coas[0].notes, 'keep');
  assert.equal(syncNarrativeDecisions(box, narrative, makeId), false);
});

test('a stale current narrative is repaired before it replaces the migrated one', () => {
  // Settings: the "dec" category becomes a decision category
  const box = makeScenario();
  box.categories[1].decisionSupport = false;
  const stored = { id: 'n', saved: true, components: { threat: ['fire'], measure: ['water'] } };
  const current = JSON.parse(JSON.stringify(stored));
  box.categories[1].decisionSupport = true;
  syncNarrativeDecisions(box, stored, makeId);
  // Create page edit of the stale copy: saveNarrative syncs it first
  current.label = 'Edited';
  syncNarrativeDecisions(box, current, makeId);
  assert.deepEqual(current.components, { threat: ['fire'] });
  assert.deepEqual(current.coas[0].components, { measure: ['water'] });
  assert.deepEqual(effectiveSelection(box, current), effectiveSelection(box, stored));
});

test('appendReflection keeps the existing text', () => {
  assert.equal(appendReflection(undefined, 'New'), 'New');
  assert.equal(appendReflection('  ', 'New'), 'New');
  assert.equal(appendReflection('Mine', 'New'), 'Mine\n\nNew');
  assert.equal(appendReflection('Mine\n', 'New'), 'Mine\n\nNew');
});

test('reflectionTarget finds the COA in the latest narrative, or nothing when it changed', () => {
  const coa = { id: 'a', label: 'A', components: {} };
  const narrative = { id: 'n', components: {}, coas: [coa] };
  // Same id, other copy (e.g. after a save)
  assert.equal(reflectionTarget(narrative, { id: 'n' }, 'a'), coa);
  assert.equal(reflectionTarget(narrative, { id: 'other' }, 'a'), undefined);
  assert.equal(reflectionTarget(narrative, { id: 'n' }, 'gone'), undefined);
  assert.equal(reflectionTarget(undefined, { id: 'n' }, 'a'), undefined);
  // Without ids, only the same narrative object matches
  const unsaved = { components: {}, coas: [coa] };
  assert.equal(reflectionTarget(unsaved, unsaved, 'a'), coa);
  assert.equal(reflectionTarget({ components: {}, coas: [coa] }, unsaved, 'a'), undefined);
});

test('the decision-support page shows for a saved or an open scenario, included or not', async () => {
  const { hasDecisionSupportPage } = await import('../src/utils/decision.ts');
  const on = { includeDecisionSupport: true };
  assert.equal(hasDecisionSupportPage({ ...on, narratives: [{ id: 'n', saved: true }] }), true);
  assert.equal(hasDecisionSupportPage({ ...on, narratives: [] }, { id: 'open' }), true);
  assert.equal(hasDecisionSupportPage({ ...on, narratives: [{ id: 'n' }] }), false);
  assert.equal(hasDecisionSupportPage({ includeDecisionSupport: false, narratives: [{ id: 'n', saved: true }] }, { id: 'n' }), false);
});
