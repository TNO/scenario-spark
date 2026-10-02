import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createStarterKitNl } from '../src/models/starter-kit-nl.ts';
import { parseImportedModel } from '../src/utils/import-model.ts';

const scenarios = (model) => [model.scenario, ...model.scenarios];
const canComplete = (scenario, requiredId) => {
  const factors = scenario.components;
  const incompatible = (a, b) =>
    scenario.inconsistencies[a]?.[b] === true ||
    scenario.inconsistencies[b]?.[a] === true;
  const search = (index, selected) => {
    if (index === factors.length) return true;
    return factors[index].values.some(
      ({ id }) =>
        (!requiredId ||
          !factors[index].values.some((v) => v.id === requiredId) ||
          id === requiredId) &&
        selected.every((other) => !incompatible(id, other)) &&
        search(index + 1, [...selected, id])
    );
  };
  return search(0, []);
};

test('provides ten importable, distinct Dutch starter boxes', () => {
  const model = createStarterKitNl([{ threshold: 0, color: '#123456' }]);
  const boxes = scenarios(model);
  assert.equal(boxes.length, 10);
  assert.equal(new Set(boxes.map((box) => box.id)).size, 10);
  assert.equal(parseImportedModel(JSON.stringify(model)).kind, 'collection');
  for (const box of boxes) {
    assert.ok(box.label.trim());
    assert.ok(box.desc.trim());
    assert.ok(box.categories.length >= 2);
    assert.ok(box.components.length >= 5);
    assert.deepEqual(box.thresholdColors, [{ threshold: 0, color: '#123456' }]);
    assert.equal(box.llm.prompts.length, 1);
    assert.ok(box.llm.prompts[0].prompt.length >= 100);
    assert.equal(box.narratives.length, 1);
    assert.ok(box.narratives[0].desc.length >= 100);
  }
});

test('every driver and category has valid, documented, unique choices', () => {
  for (const box of scenarios(createStarterKitNl([]))) {
    const componentIds = new Set(box.components.map(({ id }) => id));
    const valueIds = box.components.flatMap(({ values }) => values.map(({ id }) => id));
    assert.equal(componentIds.size, box.components.length, box.label);
    assert.equal(new Set(valueIds).size, valueIds.length, box.label);
    assert.equal(new Set(box.categories.map(({ id }) => id)).size, box.categories.length);
    assert.deepEqual(
      new Set(box.categories.flatMap(({ componentIds }) => componentIds)),
      componentIds,
      box.label
    );
    assert.deepEqual(
      new Set(box.llm.prompts[0].categories),
      new Set(box.categories.map(({ id }) => id)),
      box.label
    );
    for (const category of box.categories) {
      assert.ok(category.desc?.trim(), `${box.label}: ${category.label}`);
      assert.ok(category.componentIds.length >= 2, `${box.label}: ${category.label}`);
    }
    for (const factor of box.components) {
      assert.ok(factor.desc?.trim(), `${box.label}: ${factor.label}`);
      assert.ok(factor.values.length >= 3, `${box.label}: ${factor.label}`);
      assert.ok(factor.values.every(({ label }) => label.trim()));
    }
  }
});

test('hard exclusions link different factors and leave every option feasible', () => {
  for (const box of scenarios(createStarterKitNl([]))) {
    const factorByValue = new Map(
      box.components.flatMap((factor) => factor.values.map(({ id }) => [id, factor.id]))
    );
    const exclusions = Object.entries(box.inconsistencies).flatMap(([from, row]) =>
      Object.entries(row).map(([to, impossible]) => [from, to, impossible])
    );
    assert.ok(exclusions.length >= 2, box.label);
    for (const [from, to, impossible] of exclusions) {
      assert.equal(impossible, true, box.label);
      assert.ok(factorByValue.has(from) && factorByValue.has(to), box.label);
      assert.notEqual(factorByValue.get(from), factorByValue.get(to), box.label);
    }
    assert.ok(canComplete(box), box.label);
    for (const id of factorByValue.keys()) {
      assert.ok(canComplete(box, id), `${box.label}: ${id}`);
    }
    const example = box.narratives[0];
    const exampleValues = Object.values(example.components).flat();
    assert.equal(exampleValues.length, box.components.length, box.label);
    for (let i = 0; i < exampleValues.length; i++) {
      for (const other of exampleValues.slice(i + 1)) {
        assert.notEqual(box.inconsistencies[exampleValues[i]]?.[other], true, box.label);
        assert.notEqual(box.inconsistencies[other]?.[exampleValues[i]], true, box.label);
      }
    }
  }
});

test('creating a new starter kit does not reuse mutable scenario data', () => {
  const first = createStarterKitNl([]);
  first.scenario.label = 'Changed by user';
  first.scenarios.length = 0;
  const second = createStarterKitNl([]);
  assert.notEqual(second.scenario.label, 'Changed by user');
  assert.equal(second.scenarios.length, 9);
});

test('the safety-region examples cite public background sources', () => {
  const boxes = scenarios(createStarterKitNl([]));
  for (const label of ['Hoogwater en wateroverlast', 'Dijkdoorbraak', 'Natuurbrand']) {
    const box = boxes.find((item) => item.label === label);
    assert.ok(box, label);
    assert.match(box.desc, /\[[^\]]+\]\(https:\/\/[^)]+\)/, label);
  }
});
