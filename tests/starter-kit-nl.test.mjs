import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addStarterKitToModel, loadStarterKit } from '../src/models/starter-kit.ts';
import { parseImportedModel } from '../src/utils/import-model.ts';

const scenarios = (model) => [model.scenario, ...model.scenarios];
const createStarterKitNl = (colors) => loadStarterKit('nl', colors);
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

test('provides ten importable, distinct Dutch starter boxes', async () => {
  const model = await createStarterKitNl([{ threshold: 0, color: '#123456' }]);
  const boxes = scenarios(model);
  assert.equal(boxes.length, 10);
  assert.equal(new Set(boxes.map((box) => box.id)).size, 10);
  assert.equal(parseImportedModel(JSON.stringify(model)).kind, 'collection');
  for (const box of boxes) {
    assert.ok(box.label.trim());
    assert.ok(box.desc.trim());
    assert.ok(box.categories.length >= 4, box.label);
    assert.ok(box.components.length >= 12, box.label);
    assert.deepEqual(box.thresholdColors, [{ threshold: 0, color: '#123456' }]);
    assert.equal(box.llm.prompts.length, 1);
    assert.ok(box.llm.prompts[0].prompt.length >= 100);
    assert.equal(box.narratives.length, 1);
    assert.ok(box.narratives[0].desc.length >= 100);
  }
});

test('every starter box has a complete prose template and an effects-focused LLM prompt', async () => {
  for (const box of scenarios(await createStarterKitNl([]))) {
    const placeholders = [...box.template.matchAll(/\{(\d+)\}/g)].map(([, number]) => Number(number));
    assert.deepEqual(
      placeholders.slice().sort((a, b) => a - b),
      box.components.map((_, index) => index + 1),
      box.label
    );
    assert.equal(box.template.trim().split(/\n+/).length, box.categories.length, box.label);
    assert.ok(box.template.split(/\n+/).every((paragraph) => paragraph.trim().endsWith('.')), box.label);
    const prompt = box.llm.prompts[0].prompt;
    assert.match(prompt, /korte termijn/i, box.label);
    assert.match(prompt, /middellange termijn/i, box.label);
    assert.match(prompt, /gamechangers/i, box.label);
    assert.match(prompt, /voorwaarde.*gevolg/i, box.label);
  }
});

test('event safety and cyber continuity offer source-level depth', async () => {
  const boxes = scenarios(await createStarterKitNl([]));
  assert.ok(boxes.find(({ id }) => id.endsWith('evenementenveiligheid')).components.length >= 20);
  assert.ok(boxes.find(({ id }) => id.endsWith('cybercontinuiteit')).components.length >= 16);
  const event = boxes.find(({ id }) => id.endsWith('evenementenveiligheid'));
  for (const theme of ['evenement', 'verstoring', 'maatregel', 'effect']) {
    assert.ok(
      event.categories.some((category) => category.label.toLowerCase().includes(theme)),
      theme
    );
  }
  const expected = 'starter-nl-evenementenveiligheid-opkomst-groot';
  const permitted = 'starter-nl-evenementenveiligheid-maximum-vijfhonderd';
  assert.notEqual(event.inconsistencies[expected]?.[permitted], true);
  assert.notEqual(event.inconsistencies[permitted]?.[expected], true);
});

test('every driver and category has valid, documented, unique choices', async () => {
  for (const box of scenarios(await createStarterKitNl([]))) {
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

test('hard exclusions link different factors and leave every option feasible', async () => {
  for (const box of scenarios(await createStarterKitNl([]))) {
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

test('creating a new starter kit does not reuse mutable scenario data', async () => {
  const first = await createStarterKitNl([]);
  first.scenario.label = 'Changed by user';
  first.scenarios.length = 0;
  const second = await createStarterKitNl([]);
  assert.notEqual(second.scenario.label, 'Changed by user');
  assert.equal(second.scenarios.length, 9);
});

test('the safety-region examples cite public background sources', async () => {
  const boxes = scenarios(await createStarterKitNl([]));
  for (const label of ['Hoogwater en wateroverlast', 'Dijkdoorbraak', 'Natuurbrand']) {
    const box = boxes.find((item) => item.label === label);
    assert.ok(box, label);
    assert.match(box.desc, /\[[^\]]+\]\(https:\/\/[^)]+\)/, label);
  }
});

test('adding the kit is non-destructive, idempotent and preserves edited starter boxes', async () => {
  const kit = await createStarterKitNl([]);
  const standalone = {
    scenario: { ...kit.scenario, id: 'standalone', label: 'Bestaande box' },
    scenarios: [],
  };
  const appended = addStarterKitToModel(standalone, kit);
  assert.equal(appended.added, 10);
  assert.equal(appended.model.scenario, standalone.scenario);
  assert.equal(standalone.scenarios.length, 0);
  assert.equal(parseImportedModel(JSON.stringify(appended.model)).kind, 'collection');
  const personal = {
    scenario: { id: 'personal', label: 'Eigen box', categories: [], components: [], narratives: [], inconsistencies: {} },
    scenarios: [{ ...kit.scenario, label: 'Eigen aanpassing' }],
  };
  const first = addStarterKitToModel(personal, kit);
  assert.equal(first.added, 9);
  assert.equal(first.model.scenario, personal.scenario);
  assert.equal(first.model.scenarios[0], personal.scenarios[0]);
  assert.equal(first.model.scenarios[0].label, 'Eigen aanpassing');
  assert.equal(personal.scenarios.length, 1);
  assert.equal(first.model.scenarios.length, 10);
  const second = addStarterKitToModel(first.model, kit);
  assert.equal(second.added, 0);
  assert.equal(second.model, first.model);
});
