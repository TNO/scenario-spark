import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseImportedModel } from '../src/utils/import-model.ts';

const scenario = {
  id: 'example',
  label: 'Example',
  categories: [{ id: 'category', label: 'Category', componentIds: ['driver'] }],
  components: [
    {
      id: 'driver',
      label: 'Driver',
      values: [{ id: 'choice', label: 'Choice' }],
    },
  ],
  inconsistencies: {},
  narratives: [],
};

test('recognizes a scenario by structure, not filename or version', () => {
  assert.equal(parseImportedModel(JSON.stringify(scenario)).kind, 'scenario');
  assert.equal(
    parseImportedModel(JSON.stringify({ ...scenario, version: 1 })).kind,
    'scenario'
  );
});

test('recognizes a collection with and without a version', () => {
  const collection = { scenario, scenarios: [scenario] };
  assert.equal(parseImportedModel(JSON.stringify(collection)).kind, 'collection');
  assert.equal(
    parseImportedModel(JSON.stringify({ ...collection, version: 1 })).kind,
    'collection'
  );
});

test('retains recognition of old-format collections', () => {
  const old = {
    scenarios: {
      current: {
        id: 'old',
        name: 'Old',
        categories: { category: ['driver'] },
        inconsistencies: [],
        narratives: [],
      },
    },
    driver: { list: [{ id: 'choice', name: 'Choice' }] },
  };
  assert.equal(parseImportedModel(JSON.stringify(old)).kind, 'legacy');
});

test('rejects malformed or incomplete input instead of changing the model', () => {
  for (const input of [
    '{',
    'null',
    '{}',
    JSON.stringify({ id: 'not-a-scenario', label: 'Incomplete' }),
    JSON.stringify({ scenario, scenarios: 'invalid' }),
    JSON.stringify({ scenario: { ...scenario, categories: null }, scenarios: [] }),
    JSON.stringify({ scenario, scenarios: [{ id: 'broken' }] }),
    JSON.stringify({ ...scenario, narratives: [null] }),
    JSON.stringify({ ...scenario, inconsistencies: { a: { b: 'not boolean' } } }),
  ]) {
    assert.throws(() => parseImportedModel(input), Error);
  }
});
