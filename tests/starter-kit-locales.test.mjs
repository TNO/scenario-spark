import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { addStarterKitToModel, loadStarterKit } from '../src/models/starter-kit.ts';

const languages = ['nl', 'en', 'fr', 'de', 'es', 'pl'];
const readKit = (language) => JSON.parse(
  readFileSync(new URL(`../src/models/starter-kits/${language}.json`, import.meta.url), 'utf8')
);
const reference = readKit('nl');
const boxStructure = (box) => ({
  id: box.id,
  categories: box.categories.map((category) => ({
    id: category.id,
    factors: category.factors.map((factor) => ({
      id: factor.id,
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
    assert.deepEqual(data.boxes.map(boxStructure), reference.boxes.map(boxStructure), language);
    assert.equal(data.boxes.length, 10, language);
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
      const count = box.categories.flatMap(({ factors }) => factors).length;
      assert.deepEqual(
        numbers.slice().sort((a, b) => a - b),
        Array.from({ length: count }, (_, i) => i + 1),
        `${language}: ${box.id}`
      );
      assert.equal(box.template.trim().split('\n').length, box.categories.length, `${language}: ${box.id}`);
      assert.ok(box.prompt.length > 100 && box.example.desc.includes('<p>'), `${language}: ${box.id}`);
      assert.ok(box.categories.every(({ desc, factors }) =>
        desc && factors.every(({ label, desc, values }) =>
          label && desc && values.every(([, choice]) => choice))
      ), `${language}: ${box.id}`);
      if (language !== 'nl') {
        assert.notEqual(box.label, original.label, `${language}: ${box.id}`);
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
    assert.equal(model.scenarios.length, 9, language);
    assert.equal(model.scenario.label, data.boxes[0].label, language);
    assert.equal(model.scenario.components.length, data.boxes[0].categories.flatMap(({ factors }) => factors).length);
    assert.ok(model.scenario.llm.prompts[0].prompt.includes(data.effectsPrompt), language);
  }
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
