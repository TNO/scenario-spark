import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  applyInconsistencies,
  createBox,
  toScenarioSpark,
  upsertCategory,
  validateBox,
} from '../packages/morphological-box/src/index.ts';
import { parseImportedModel } from '../src/utils/import-model.ts';

test('a box built with the morphological-box library imports as a Scenario Spark scenario', () => {
  let box = createBox({ label: 'Port attack' });
  box = upsertCategory(box, {
    label: 'Actor',
    components: [{ label: 'Motive', values: ['Money', 'Revenge'] }],
  });
  box = upsertCategory(box, {
    label: 'Target',
    components: [{ label: 'Asset', values: ['Cranes', 'Ship'] }],
  });
  box = applyInconsistencies(box, [
    { a: 'motive-revenge', b: 'asset-ship', type: 'impossible' },
  ]);
  assert.equal(validateBox(box).valid, true);

  const imported = parseImportedModel(JSON.stringify(toScenarioSpark(box)));
  assert.equal(imported.kind, 'scenario');
  assert.deepEqual(imported.value.narratives, []);
  assert.equal(imported.value.inconsistencies['asset-ship']['motive-revenge'], true);
});
