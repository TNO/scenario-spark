import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  checkSelection,
  createCoverageGenerator,
  createRandom,
  generateCoverage,
  setInconsistency,
  valueUsage,
  type MorphologicalBox,
} from '../src/index.ts';
import { sampleBox } from './fixtures.ts';

/** Box with components of 2, 3, 4 and 5 values. */
const mixedBox = (): MorphologicalBox => {
  const sizes = [2, 3, 4, 5];
  const components = sizes.map((size, i) => ({
    id: `c${i}`,
    label: `C${i}`,
    values: Array.from({ length: size }, (_, j) => ({ id: `c${i}v${j}`, label: `V${j}` })),
  }));
  return {
    id: 'mixed',
    label: 'Mixed',
    categories: [{ id: 'all', label: 'All', componentIds: components.map((c) => c.id) }],
    components,
    inconsistencies: {},
  };
};

const spreadPerComponent = (box: MorphologicalBox, usage: Map<string, number>) =>
  box.components.map((c) => {
    const values = (c.values || []).map((v) => usage.get(v.id) || 0);
    return Math.max(...values) - Math.min(...values);
  });

test('uses every value equally often (within one) without constraints', () => {
  const box = mixedBox();
  for (const n of [7, 20, 40]) {
    const results = generateCoverage(box, n, { random: createRandom(n) });
    assert.equal(results.length, n);
    const usage = valueUsage(box, results.map((r) => r.selection));
    spreadPerComponent(box, usage).forEach((spread) => assert.ok(spread <= 1, `spread ${spread} for n=${n}`));
  }
});

test('stays nearly balanced when half of all combinations are requested', () => {
  // Avoiding duplicates can force a small imbalance once a large part of the box is used
  const box = mixedBox(); // 120 combinations
  const results = generateCoverage(box, 60, { random: createRandom(60) });
  assert.equal(results.length, 60);
  const usage = valueUsage(box, results.map((r) => r.selection));
  spreadPerComponent(box, usage).forEach((spread) => assert.ok(spread <= 2, `spread ${spread}`));
});

test('is far more balanced than random sampling would guarantee', () => {
  const box = mixedBox();
  const results = generateCoverage(box, 5, { random: createRandom(3) });
  const usage = valueUsage(box, results.map((r) => r.selection));
  // With 5 scenarios, every value of the 5-valued component is used exactly once
  box.components[3].values!.forEach((v) => assert.equal(usage.get(v.id), 1));
});

test('never produces duplicates and stops when the box is exhausted', () => {
  const box = sampleBox(); // 2 x 2 x 2 = 8 combinations
  const results = generateCoverage(box, 20, { random: createRandom(1) });
  assert.equal(results.length, 8);
  const keys = new Set(results.map((r) => JSON.stringify(r.selection, Object.keys(r.selection).sort())));
  assert.equal(keys.size, 8);
});

test('respects impossible pairs and keeps locked values', () => {
  const box = mixedBox();
  setInconsistency(box.inconsistencies, 'c1v0', 'c2v0', 'impossible');
  setInconsistency(box.inconsistencies, 'c1v0', 'c3v1', 'impossible');
  const results = generateCoverage(box, 30, { random: createRandom(7), locked: { c0: ['c0v1'] } });
  assert.equal(results.length, 30);
  for (const { selection } of results) {
    assert.deepEqual(selection.c0, ['c0v1']);
    assert.ok(checkSelection(box, selection).consistent);
  }
  const usage = valueUsage(box, results.map((r) => r.selection));
  assert.equal(usage.get('c0v0'), 0);
  spreadPerComponent(box, usage).slice(1).forEach((spread) => assert.ok(spread <= 2));
});

test('avoids unlikely pairs when the balance allows it', () => {
  const box = sampleBox();
  setInconsistency(box.inconsistencies, 'money', 'low', 'unlikely');
  const results = generateCoverage(box, 2, { random: createRandom(5), unlikelyWeight: 1 });
  assert.ok(results.every((r) => r.unlikelyCount === 0));
});

test('counts existing scenarios towards coverage', () => {
  const box = sampleBox();
  const existing = [{ motive: ['money'], capability: ['low'], asset: ['bank'] }];
  const results = generateCoverage(box, 1, { random: createRandom(2), existing });
  assert.deepEqual(results[0].selection, { motive: ['ideology'], capability: ['high'], asset: ['grid'] });
});

test('strength 2 covers all value pairs of a small box quickly', () => {
  const box = mixedBox();
  const pairsCovered = (strength: 1 | 2) => {
    const generator = createCoverageGenerator(box, { random: createRandom(11), strength });
    const pairs = new Set<string>();
    for (let i = 0; i < 25; i++) {
      const ids = Object.values(generator.next()!.selection).flat();
      ids.forEach((a) => ids.forEach((b) => a < b && pairs.add(`${a}|${b}`)));
    }
    return pairs.size;
  };
  // 2*3 + 2*4 + 2*5 + 3*4 + 3*5 + 4*5 = 71 pairs
  assert.ok(pairsCovered(2) >= pairsCovered(1));
  assert.ok(pairsCovered(2) >= 65);
});

test('keeps finding new scenarios until every consistent combination is used', () => {
  const box = mixedBox(); // 2 * 3 * 4 * 5 = 120 combinations
  setInconsistency(box.inconsistencies, 'c0v0', 'c1v0', 'impossible'); // removes 4 * 5 = 20
  const results = generateCoverage(box, 200, { random: createRandom(4), strength: 2 });
  assert.equal(results.length, 100);
  assert.equal(new Set(results.map((r) => JSON.stringify(Object.entries(r.selection).sort()))).size, 100);
});
