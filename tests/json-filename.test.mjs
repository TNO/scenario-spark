import assert from 'node:assert/strict';
import { test } from 'node:test';
import { jsonFilename } from '../src/utils/json-filename.ts';

test('retains custom filenames and appends JSON once', () => {
  assert.equal(jsonFilename('Mijn box'), 'Mijn box.json');
  assert.equal(jsonFilename('Mijn box.JSON'), 'Mijn box.json');
});

test('rejects blank names and removes unsafe path characters', () => {
  assert.equal(jsonFilename('  ... '), undefined);
  assert.equal(jsonFilename('../Mijn box'), '_Mijn box.json');
  assert.equal(jsonFilename('a/b:c?d'), 'a_b_c_d.json');
});
