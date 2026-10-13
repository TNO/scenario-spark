import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  checkSelection,
  countCombinations,
  createRandom,
  generateCombination,
  generateCombinations,
  setInconsistency,
} from '../src/index.ts';
import { sampleBox } from './fixtures.ts';

test('generates one value per categorized component', () => {
  const result = generateCombination(sampleBox(), { random: createRandom(1) });
  assert.ok(result.ok);
  assert.deepEqual(Object.keys(result.selection).sort(), ['asset', 'capability', 'motive']);
});

test('never selects impossible pairs', () => {
  const box = sampleBox();
  setInconsistency(box.inconsistencies, 'money', 'grid', 'impossible');
  setInconsistency(box.inconsistencies, 'ideology', 'bank', 'impossible');
  for (let seed = 0; seed < 50; seed++) {
    const result = generateCombination(box, { random: createRandom(seed) });
    assert.ok(result.ok);
    assert.ok(checkSelection(box, result.selection).consistent);
  }
});

test('avoids unlikely pairs when an alternative exists', () => {
  const box = sampleBox();
  setInconsistency(box.inconsistencies, 'money', 'low', 'unlikely');
  for (let seed = 0; seed < 30; seed++) {
    const result = generateCombination(box, { random: createRandom(seed), locked: { motive: ['money'] } });
    assert.ok(result.ok);
    assert.deepEqual(result.selection.capability, ['high']);
    assert.equal(result.unlikelyCount, 0);
  }
});

test('reports failure when locked values conflict or the box is infeasible', () => {
  const box = sampleBox();
  setInconsistency(box.inconsistencies, 'money', 'bank', 'impossible');
  assert.equal(generateCombination(box, { locked: { motive: ['money'], asset: ['bank'] } }).ok, false);
  setInconsistency(box.inconsistencies, 'money', 'grid', 'impossible');
  setInconsistency(box.inconsistencies, 'ideology', 'bank', 'impossible');
  setInconsistency(box.inconsistencies, 'ideology', 'grid', 'impossible');
  const result = generateCombination(box);
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.diagnostic.blockedComponents.length > 0);
});

test('samples avoid unlikely pairs when possible', () => {
  const box = sampleBox();
  setInconsistency(box.inconsistencies, 'money', 'bank', 'unlikely');
  setInconsistency(box.inconsistencies, 'money', 'grid', 'unlikely');
  for (let seed = 0; seed < 20; seed++) {
    for (const { selection, unlikelyCount } of generateCombinations(box, 3, { random: createRandom(seed) })) {
      assert.equal(unlikelyCount, 0);
      assert.deepEqual(selection.motive, ['ideology']);
    }
  }
});

test('generates distinct combinations and counts the space', () => {
  const box = sampleBox();
  assert.equal(countCombinations(box), 8);
  const results = generateCombinations(box, 20, { random: createRandom(3) });
  assert.equal(results.length, 8);
});

test('scales to larger boxes with forward checking', () => {
  const box = sampleBox();
  box.categories = [{ id: 'all', label: 'All', componentIds: [] }];
  box.components = Array.from({ length: 14 }, (_, i) => ({
    id: `c${i}`,
    label: `C${i}`,
    values: Array.from({ length: 5 }, (_, j) => ({ id: `c${i}v${j}`, label: `V${j}` })),
  }));
  box.categories[0].componentIds = box.components.map((c) => c.id);
  // Last component is incompatible with everything in the first one: infeasible.
  for (let a = 0; a < 5; a++) for (let b = 0; b < 5; b++) setInconsistency(box.inconsistencies, `c0v${a}`, `c13v${b}`, 'impossible');
  const start = Date.now();
  assert.equal(generateCombination(box).ok, false);
  assert.ok(Date.now() - start < 2000);
});
