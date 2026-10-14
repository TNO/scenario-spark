import assert from 'node:assert/strict';
import { test } from 'node:test';
import { suggestApproach } from '../src/utils/decision.ts';

const box = (inconsistencies = {}) => ({
  categories: [
    { id: 'sit', label: 'Situation', componentIds: ['threat'] },
    { id: 'dec', label: 'Measures', decisionSupport: true, componentIds: ['measure', 'comms'] },
  ],
  components: [
    { id: 'threat', label: 'Threat', values: [{ id: 'fire', label: 'Fire' }, { id: 'flood', label: 'Flood' }] },
    {
      id: 'measure',
      label: 'Measure',
      values: [
        { id: 'evacuate', label: 'Evacuate' },
        { id: 'water', label: 'Use water' },
        { id: 'shelter', label: 'Shelter' },
      ],
    },
    {
      id: 'comms',
      label: 'Communication',
      values: [
        { id: 'sms', label: 'SMS' },
        { id: 'radio', label: 'Radio' },
      ],
    },
  ],
  inconsistencies,
});

const narrative = (id, threat, decisions, risk) => ({
  id,
  label: id,
  components: { threat: [threat] },
  risk,
  coas: [{ id: `${id}-a`, label: 'A', components: decisions }],
});

const byComponent = (result) => Object.fromEntries(result.components.map((c) => [c.componentId, c]));

/** The inline reduce the decision-support page used before 0011. */
const legacy = (box, narratives) => {
  const weights = narratives.map((n) => +(String(n.risk || '0').replace('risk_', '') || 0) + 1);
  const selections = narratives.map((n) => ({ ...n.components, ...(n.coas?.[0]?.components || {}) }));
  const result = {};
  for (const c of box.components.filter((c) => c.id !== 'threat')) {
    const measures = new Map();
    selections.forEach((s, i) => (s[c.id] || []).forEach((id) => measures.set(id, (measures.get(id) || 0) + weights[i])));
    const high = Math.max(...measures.values());
    result[c.id] = [...measures.entries()].filter(([, w]) => w === high).map(([id]) => id);
  }
  return result;
};

test('suggestApproach: without inconsistencies the picks match the previous algorithm', () => {
  const b = box();
  const narratives = [
    narrative('n1', 'fire', { measure: ['water', 'evacuate'], comms: ['sms'] }, 'risk_4'),
    narrative('n2', 'flood', { measure: ['evacuate'], comms: ['radio'] }, 'risk_1'),
    narrative('n3', 'fire', { measure: ['water'], comms: ['radio'] }),
  ];
  const result = suggestApproach(b, narratives);
  const expected = legacy(b, narratives);
  assert.deepEqual(result.selection.measure.slice().sort(), expected.measure.slice().sort());
  assert.deepEqual(result.selection.comms.slice().sort(), expected.comms.slice().sort());
  // water: 5 + 1 = 6; evacuate: 5 + 2 = 7
  assert.deepEqual(result.selection.measure, ['evacuate']);
  // sms 5, radio 2 + 1 = 3
  assert.deepEqual(result.selection.comms, ['sms']);
});

test('suggestApproach: explanation counts scenarios and sums weights', () => {
  const narratives = [
    narrative('n1', 'fire', { measure: ['evacuate'] }, 'risk_4'),
    narrative('n2', 'fire', { measure: ['evacuate'] }, 'risk_3'),
    narrative('n3', 'fire', { measure: ['water'] }, 'risk_0'),
    narrative('n4', 'fire', { measure: ['evacuate'] }, 'risk_1'),
  ];
  const result = suggestApproach(box(), narratives);
  assert.equal(result.total, 4);
  const { measure, comms } = byComponent(result);
  assert.deepEqual(measure.valueIds, ['evacuate']);
  assert.deepEqual(measure.explanations, [{ valueId: 'evacuate', label: 'Evacuate', chosenIn: 3, total: 4, weight: 11 }]);
  assert.deepEqual(comms.valueIds, []);
  assert.equal(comms.reason, 'none');
});

test('suggestApproach: ties pick all tied values in box order', () => {
  const narratives = [
    narrative('n1', 'fire', { measure: ['water'] }, 'risk_1'),
    narrative('n2', 'fire', { measure: ['evacuate'] }, 'risk_1'),
  ];
  const { measure } = byComponent(suggestApproach(box(), narratives));
  assert.deepEqual(measure.valueIds, ['evacuate', 'water']);
});

test('suggestApproach: mutually impossible top picks fall back to the next best consistent value', () => {
  const b = box({ water: { sms: true } });
  const narratives = [
    narrative('n1', 'fire', { measure: ['water'], comms: ['sms', 'radio'] }, 'risk_4'),
    narrative('n2', 'fire', { measure: ['water'], comms: ['sms'] }, 'risk_0'),
  ];
  const result = suggestApproach(b, narratives);
  const { measure, comms } = byComponent(result);
  // water (6) beats sms (6)? equal: tie-break by component order, measure first
  assert.deepEqual(measure.valueIds, ['water']);
  assert.deepEqual(comms.valueIds, ['radio']);
  assert.deepEqual(comms.skipped, [{ valueId: 'sms', label: 'SMS', reason: 'conflict', causes: ['Use water'] }]);
});

test('suggestApproach: a stronger value in a later factor wins a conflict', () => {
  const b = box({ sms: { water: true } });
  const narratives = [
    narrative('n1', 'fire', { measure: ['water'], comms: ['sms'] }, 'risk_0'),
    narrative('n2', 'fire', { measure: ['evacuate'], comms: ['sms'] }, 'risk_0'),
    narrative('n3', 'fire', { measure: ['water'], comms: ['sms'] }, 'risk_0'),
  ];
  const { measure, comms } = byComponent(suggestApproach(b, narratives));
  assert.deepEqual(comms.valueIds, ['sms']);
  assert.deepEqual(measure.valueIds, ['evacuate']);
});

test('suggestApproach: tied values that are impossible together are not both picked', () => {
  const b = box({ evacuate: { shelter: true } });
  const narratives = [
    narrative('n1', 'fire', { measure: ['shelter'] }),
    narrative('n2', 'fire', { measure: ['evacuate'] }),
  ];
  const { measure } = byComponent(suggestApproach(b, narratives));
  assert.deepEqual(measure.valueIds, ['evacuate']);
  assert.equal(measure.skipped[0].valueId, 'shelter');
  assert.equal(measure.skipped[0].reason, 'conflict');
});

test('suggestApproach: a value excluded by the only compared situation is never picked', () => {
  const b = box({ flood: { water: true } });
  const narratives = [narrative('n1', 'flood', { measure: ['water'], comms: ['sms'] })];
  const { measure, comms } = byComponent(suggestApproach(b, narratives));
  assert.deepEqual(measure.valueIds, []);
  assert.equal(measure.reason, 'excluded');
  assert.deepEqual(measure.skipped, [{ valueId: 'water', label: 'Use water', reason: 'excluded', causes: ['Flood'] }]);
  assert.deepEqual(comms.valueIds, ['sms']);
});

test('suggestApproach: excluded in every situation is skipped, excluded in some is kept', () => {
  const b = box({ flood: { water: true }, fire: { shelter: true } });
  const narratives = [
    narrative('n1', 'flood', { measure: ['water', 'shelter', 'evacuate'] }, 'risk_4'),
    narrative('n2', 'flood', { measure: ['water', 'shelter'] }, 'risk_4'),
    narrative('n3', 'fire', { measure: ['shelter'] }, 'risk_0'),
  ];
  const { measure } = byComponent(suggestApproach(b, narratives));
  // water (10) is excluded by the flood situations only; shelter (11) by the fire situation only
  assert.deepEqual(measure.valueIds, ['shelter']);
  assert.deepEqual(
    measure.skipped.map((s) => [s.valueId, s.reason]),
    [],
  );
  // Only the flood situations: water (10) is excluded in every one, shelter (10) is kept
  const water = suggestApproach(b, narratives.slice(0, 2));
  assert.deepEqual(byComponent(water).measure.valueIds, ['shelter']);
  assert.deepEqual(byComponent(water).measure.skipped.map((s) => s.valueId), ['water']);
});

test('suggestApproach: unlikely pairs do not block', () => {
  const b = box({ water: { sms: false }, flood: { water: false } });
  const narratives = [narrative('n1', 'flood', { measure: ['water'], comms: ['sms'] })];
  const result = suggestApproach(b, narratives);
  assert.deepEqual(result.selection, { measure: ['water'], comms: ['sms'] });
});

test('suggestApproach: all candidates conflicting gives reason conflict', () => {
  const b = box({ water: { sms: true } });
  const narratives = [narrative('n1', 'fire', { measure: ['water'], comms: ['sms'] }, 'risk_2')];
  const { comms } = byComponent(suggestApproach(b, narratives));
  assert.deepEqual(comms.valueIds, []);
  assert.equal(comms.reason, 'conflict');
});

test('suggestApproach: narratives without COAs use their own selection; empty input', () => {
  const plain = { id: 'p', label: 'P', components: { threat: ['fire'], measure: ['shelter'] } };
  const empty = { id: 'e', label: 'E', components: { threat: ['fire'] }, coas: [] };
  const result = suggestApproach(box(), [plain, empty]);
  assert.equal(result.total, 2);
  assert.deepEqual(byComponent(result).measure.explanations, [
    { valueId: 'shelter', label: 'Shelter', chosenIn: 1, total: 2, weight: 1 },
  ]);
  const none = suggestApproach(box(), []);
  assert.equal(none.total, 0);
  assert.deepEqual(none.selection, { measure: [], comms: [] });
  assert.ok(none.components.every((c) => c.reason === 'none'));
});

test('suggestApproach: weights can be overridden', () => {
  const narratives = [
    narrative('n1', 'fire', { measure: ['water'] }, 'risk_4'),
    narrative('n2', 'fire', { measure: ['evacuate'] }, 'risk_0'),
  ];
  const byArray = suggestApproach(box(), narratives, { weights: [1, 3] });
  assert.deepEqual(byArray.selection.measure, ['evacuate']);
  assert.equal(byComponent(byArray).measure.explanations[0].weight, 3);
  const byFn = suggestApproach(box(), narratives, { weights: (n) => (n.id === 'n2' ? 10 : 1) });
  assert.deepEqual(byFn.selection.measure, ['evacuate']);
});
