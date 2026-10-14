import assert from 'node:assert/strict';
import { test } from 'node:test';
import { visibleTemplateLines } from '../src/utils/decision.ts';

const box = (includeDecisionSupport) => ({
  includeDecisionSupport,
  categories: [
    { id: 'sit', label: 'Situation', componentIds: ['threat', 'place'] },
    { id: 'dec', label: 'Measures', decisionSupport: true, componentIds: ['rescue', 'comms'] },
  ],
  components: [
    { id: 'threat', label: 'Threat', values: [{ id: 'fire', label: 'Fire' }] },
    { id: 'place', label: 'Place', values: [{ id: 'tunnel', label: 'Tunnel' }] },
    { id: 'rescue', label: 'Rescue', manual: true, values: [{ id: 'evac', label: 'Evacuate' }] },
    { id: 'comms', label: 'Comms', manual: true, values: [{ id: 'alert', label: 'Alert' }] },
  ],
});

const lines = [
  'A {threat} in a {place}.',
  'Rescue: {rescue}; communication: {comms}.',
  'In the {place}, start with {rescue}.',
  'No placeholders here.',
];

test('decision-only lines are hidden when decision support is off', () => {
  assert.deepEqual(visibleTemplateLines(box(false), lines, { rescue: ['evac'] }), [lines[0], lines[2], lines[3]]);
});

test('decision-only lines are hidden when decision support is on but nothing is chosen', () => {
  assert.deepEqual(visibleTemplateLines(box(true), lines, { threat: ['fire'] }), [lines[0], lines[2], lines[3]]);
});

test('decision-only lines are shown when decision support is on and a decision is chosen', () => {
  assert.deepEqual(visibleTemplateLines(box(true), lines, { comms: ['alert'] }), lines);
});

test('boxes without decision categories keep every line', () => {
  const plain = { ...box(false), categories: [{ id: 'all', label: 'All', componentIds: ['threat', 'place', 'rescue', 'comms'] }] };
  assert.deepEqual(visibleTemplateLines(plain, lines), lines);
});
