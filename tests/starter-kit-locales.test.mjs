import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { addStarterKitToModel, loadStarterKit } from '../src/models/starter-kit.ts';

const languages = ['nl', 'en', 'fr', 'de', 'es', 'pl'];
const readKit = (language) => JSON.parse(
  readFileSync(new URL(`../src/models/starter-kits/${language}.json`, import.meta.url), 'utf8')
);
const reference = readKit('nl');
// Hazard names that are identical in several languages.
const loanwordLabels = new Set(['Tsunami', 'Storm']);
const boxStructure = (box) => ({
  id: box.id,
  categories: box.categories.map((category) => ({
    id: category.id,
    manual: !!category.manual,
    decision: !!category.decision,
    factors: category.factors.map((factor) => ({
      id: factor.id,
      manual: !!factor.manual,
      valueIds: factor.values.map(([id]) => id),
    })),
  })),
  exclusions: box.exclusions,
  choices: box.example.choices,
});

test('each translated starter kit preserves every factor, constraint and template placeholder', async () => {
  for (const language of languages) {
    const data = readKit(language);
    assert.ok(data.effectsPrompt.length > 100, language);
    assert.ok(data.personaPrompt.length > 100, language);
    assert.deepEqual(data.boxes.map(boxStructure), reference.boxes.map(boxStructure), language);
    assert.equal(data.boxes.length, 45, language);
    for (const [index, box] of data.boxes.entries()) {
      const original = reference.boxes[index];
      assert.deepEqual(
        [...box.desc.matchAll(/https?:\/\/[^)\s]+/g)].map(([url]) => url),
        [...original.desc.matchAll(/https?:\/\/[^)\s]+/g)].map(([url]) => url),
        `${language}: ${box.id} sources`
      );
      assert.deepEqual(
        [...box.example.desc.matchAll(/<\/?p>/g)].map(([tag]) => tag),
        [...original.example.desc.matchAll(/<\/?p>/g)].map(([tag]) => tag),
        `${language}: ${box.id} example markup`
      );
      const numbers = [...box.template.matchAll(/\{(\d+)\}/g)].map(([, value]) => Number(value));
      // Decision factors are listed separately, so the template only covers the situation.
      const situationNumbers = box.categories
        .flatMap(({ decision, factors }) => factors.map(() => !!decision))
        .flatMap((isDecision, i) => (isDecision ? [] : [i + 1]));
      assert.deepEqual(numbers.slice().sort((a, b) => a - b), situationNumbers, `${language}: ${box.id}`);
      assert.equal(
        box.template.trim().split('\n').length,
        box.categories.filter(({ decision }) => !decision).length,
        `${language}: ${box.id}`
      );
      assert.ok(box.prompt.length > 100 && box.example.desc.includes('<p>'), `${language}: ${box.id}`);
      assert.ok(box.categories.every(({ desc, factors }) =>
        desc && factors.every(({ label, desc, values }) =>
          label && desc && values.every(([, choice]) => choice))
      ), `${language}: ${box.id}`);
      if (language !== 'nl') {
        if (!loanwordLabels.has(box.label)) assert.notEqual(box.label, original.label, `${language}: ${box.id}`);
        assert.notEqual(box.desc, original.desc, `${language}: ${box.id}`);
        assert.notEqual(box.template, original.template, `${language}: ${box.id}`);
        assert.notEqual(box.prompt, original.prompt, `${language}: ${box.id}`);
        assert.notEqual(box.example.label, original.example.label, `${language}: ${box.id}`);
        assert.notEqual(box.example.desc, original.example.desc, `${language}: ${box.id}`);
        for (const [categoryIndex, category] of box.categories.entries()) {
          const sourceCategory = original.categories[categoryIndex];
          assert.notEqual(category.desc, sourceCategory.desc, `${language}: ${box.id}/${category.id}`);
          for (const [factorIndex, factor] of category.factors.entries()) {
            assert.notEqual(
              factor.desc,
              sourceCategory.factors[factorIndex].desc,
              `${language}: ${box.id}/${factor.id}`
            );
          }
        }
      }
    }
    const model = await loadStarterKit(language, []);
    assert.equal(model.scenarios.length, 44, language);
    assert.equal(model.scenario.label, data.boxes[0].label, language);
    assert.equal(model.scenario.components.length, data.boxes[0].categories.flatMap(({ factors }) => factors).length);
    assert.ok(model.scenario.llm.prompts[0].prompt.includes(data.effectsPrompt), language);
    const personaPrompt = model.scenario.llm.prompts.find(({ type }) => type === 'persona');
    assert.equal(personaPrompt.prompt, data.personaPrompt, language);
    assert.deepEqual(personaPrompt.categories, model.scenario.categories.map(({ id }) => id), language);
    assert.deepEqual(model.personas, data.personas, language);
    assert.deepEqual(
      model.scenario.personas,
      ['starter-event-visitor', 'starter-event-organiser', 'starter-nearby-resident', 'starter-reduced-mobility'],
      language
    );
    assert.ok(model.personas.every(({ id, label, desc, url }) =>
      id && label && desc && url
    ), language);
    if (language !== 'nl') {
      assert.deepEqual(
        model.personas.map(({ id }) => id),
        reference.personas.map(({ id }) => id),
        language
      );
      assert.ok(model.personas.every((persona, index) =>
        persona.label !== reference.personas[index].label &&
        persona.desc !== reference.personas[index].desc
      ), language);
    }
    const boxes = [model.scenario, ...model.scenarios];
    assert.ok(boxes.every(({ personas = [] }) =>
      personas.length >= 3 && personas.length <= 5 &&
      personas.every((id) => model.personas.some((persona) => persona.id === id))
    ), language);
    const used = new Set(boxes.flatMap(({ personas = [] }) => personas));
    assert.ok(model.personas.every(({ id }) => used.has(id)), `${language}: unused persona`);
  }
});

test('adding missing starter boxes also adds only their missing personas', async () => {
  const starter = await loadStarterKit('en', []);
  const resident = { ...starter.personas.find(({ id }) => id === 'starter-nearby-resident'), desc: 'Custom description' };
  const existing = {
    scenario: { id: 'own', label: 'My box' },
    scenarios: [starter.scenarios[1]],
    personas: [resident, { id: 'own-persona', label: 'Mine' }],
  };
  const merged = addStarterKitToModel(existing, starter);
  assert.equal(merged.added, 44);
  assert.equal(merged.model.scenarios[0], existing.scenarios[0]);
  assert.equal(merged.model.personas[0], resident);
  const ids = merged.model.personas.map(({ id }) => id);
  assert.deepEqual(ids.slice(0, 2), ['starter-nearby-resident', 'own-persona']);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(
    [...ids.slice(2)].sort(),
    starter.personas.map(({ id }) => id).filter((id) => id !== 'starter-nearby-resident').sort()
  );
});

test('switching languages never overwrites existing starter boxes', async () => {
  const dutch = await loadStarterKit('nl', []);
  dutch.scenario.label = 'Custom box';
  const english = await loadStarterKit('en', []);
  assert.deepEqual(
    [dutch.scenario, ...dutch.scenarios].map(({ id }) => id),
    [english.scenario, ...english.scenarios].map(({ id }) => id)
  );
  const merged = addStarterKitToModel(dutch, english);
  assert.equal(merged.added, 0);
  assert.equal(merged.model.scenario.label, 'Custom box');
});

test('decision categories are identical across locales', () => {
  const decisions = (kit) => kit.boxes.flatMap((box) =>
    box.categories.filter((category) => category.decision).map((category) => `${box.id}/${category.id}`));
  assert.ok(decisions(reference).length >= 40);
  for (const language of languages) assert.deepEqual(decisions(readKit(language)), decisions(reference), language);
});

test('re-adding the starter kit fills empty persona selections of existing starter boxes only', async () => {
  const starter = await loadStarterKit('en', []);
  const [first, second, ...rest] = [starter.scenario, ...starter.scenarios];
  const existing = {
    scenario: { ...first, personas: [] },
    scenarios: [{ ...second, personas: ['own-persona'] }, ...rest.map((s) => ({ ...s, personas: undefined }))],
    personas: [{ id: 'own-persona', label: 'Mine' }],
  };
  const merged = addStarterKitToModel(existing, starter);
  assert.equal(merged.added, 0);
  assert.equal(merged.updated, rest.length + 1);
  assert.deepEqual(merged.model.scenario.personas, first.personas);
  assert.deepEqual(merged.model.scenarios[0].personas, ['own-persona']);
  assert.deepEqual(merged.model.scenarios[1].personas, rest[0].personas);
  const ids = new Set(merged.model.personas.map(({ id }) => id));
  assert.ok([first, ...rest].every(({ personas }) => personas.every((id) => ids.has(id))));
  assert.equal(merged.model.personas[0].id, 'own-persona');
});
