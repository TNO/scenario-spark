import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  applyInconsistencies,
  createBox,
  getInconsistencyType,
  normalizeInconsistencies,
  removeCategory,
  upsertCategory,
  validateBox,
} from '../src/index.ts';
import { sampleBox } from './fixtures.ts';

const codes = (input: unknown) => {
  const r = validateBox(input);
  return { errors: r.errors.map((i) => i.code), warnings: r.warnings.map((i) => i.code) };
};

test('accepts a valid box', () => {
  assert.deepEqual(codes(sampleBox()), { errors: [], warnings: [] });
});

test('reports structural errors', () => {
  assert.deepEqual(codes(null).errors, ['not-an-object']);
  const box = sampleBox();
  box.components[1].values![0].id = 'money';
  box.categories[1].componentIds = ['missing'];
  const { errors } = codes(box);
  assert.ok(errors.includes('duplicate-id'));
  assert.ok(errors.includes('unknown-component'));
});

test('reports inconsistency problems and infeasibility', () => {
  const box = sampleBox();
  box.inconsistencies = { money: { nope: true } };
  assert.ok(codes(box).errors.includes('unknown-value'));
  box.inconsistencies = { money: { bank: true }, bank: { money: false } };
  assert.ok(codes(box).errors.includes('conflicting-inconsistency'));
  box.inconsistencies = { money: { ideology: true } };
  assert.ok(codes(box).warnings.includes('same-component-inconsistency'));
  box.inconsistencies = normalizeInconsistencies({ money: { bank: true, grid: true } });
  assert.ok(codes(box).warnings.includes('dead-value'));
  const infeasible = applyInconsistencies(sampleBox(), [{ a: 'motive', b: 'asset', type: 'impossible' }]);
  assert.ok(codes(infeasible).errors.includes('infeasible'));
});

test('builds a box incrementally', () => {
  let box = createBox({ label: 'Cyber threats' });
  assert.equal(box.id, 'cyber-threats');
  box = upsertCategory(box, {
    label: 'Actor',
    components: [{ label: 'Motive', values: ['Money', { id: 'ideo', label: 'Ideology' }] }],
  });
  box = upsertCategory(box, { label: 'Target', components: [{ label: 'Asset', values: ['Bank', 'Grid'] }] });
  assert.deepEqual(box.components.map((c) => c.id), ['motive', 'asset']);
  assert.deepEqual(box.components[0].values!.map((v) => v.id), ['motive-money', 'ideo']);
  box = applyInconsistencies(box, [
    { a: 'ideo', b: 'asset-bank', type: 'impossible' },
    { a: 'motive-money', b: 'asset-grid', type: 'unlikely' },
  ]);
  assert.equal(getInconsistencyType(box.inconsistencies, 'asset-bank', 'ideo'), 'impossible');
  assert.equal(getInconsistencyType(box.inconsistencies, 'asset-grid', 'motive-money'), 'unlikely');
  assert.deepEqual(validateBox(box).errors, []);

  // Replacing a category keeps ids, drops removed values and their constraints.
  box = upsertCategory(box, { id: 'actor', label: 'Actor', components: [{ id: 'motive', label: 'Motive', values: [{ id: 'motive-money', label: 'Money' }] }] });
  assert.equal(box.inconsistencies.ideo, undefined);
  assert.equal(getInconsistencyType(box.inconsistencies, 'asset-grid', 'motive-money'), 'unlikely');

  box = removeCategory(box, 'target');
  assert.deepEqual(box.inconsistencies, {});
  assert.throws(() => applyInconsistencies(box, [{ a: 'x', b: 'motive', type: 'impossible' }]), /unknown/);
  assert.throws(() => upsertCategory(box, { label: 'X', components: [{ id: 'motive', label: 'M', values: ['a'] }] }), /already used/);
});
