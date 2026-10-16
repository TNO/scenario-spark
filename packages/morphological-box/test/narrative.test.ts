import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  createBox,
  createTemplatePrompt,
  remapTemplate,
  removeCategory,
  renderTemplate,
  setLlmPrompt,
  setTemplate,
  upsertCategory,
  validateBox,
} from '../src/index.ts';

const build = () => {
  let box = createBox({ label: 'Flood', language: 'nl' });
  box = upsertCategory(box, { label: 'Weer', components: [{ label: 'Regen', values: ['Licht', 'Zwaar'] }] });
  box = upsertCategory(box, { label: 'Impact', components: [{ label: 'Schade', values: ['Geen', 'Ernstig'] }] });
  return box;
};

test('template prompt numbers key drivers and names the language', () => {
  const prompt = createTemplatePrompt(build());
  assert.match(prompt, /written in Dutch/);
  assert.match(prompt, /^1\. Regen$/m);
  assert.match(prompt, /^2\. Schade$/m);
  assert.match(createTemplatePrompt(build(), 'fr'), /written in French/);
});

test('setTemplate accepts numbers and ids, rejects unknown placeholders', () => {
  const box = setTemplate(build(), 'Er valt {1} regen. Schade: {schade}.');
  assert.equal(validateBox(box).valid, true);
  assert.equal(renderTemplate(box, box.template!, { regen: ['regen-zwaar'], schade: ['schade-geen'] }), 'Er valt Zwaar regen. Schade: Geen.');
  assert.throws(() => setTemplate(build(), 'Bad {3}'), /out of range/);
  assert.throws(() => setTemplate(build(), 'Bad {nope}'), /not a component id/);
  const invalid = validateBox({ ...build(), template: '{0} and {x}' });
  assert.equal(invalid.errors.filter((e) => e.code === 'invalid-template-placeholder').length, 2);
});

test('replacing or removing a category keeps template numbers on their components', () => {
  let box = setTemplate(build(), '{1} / {2}');
  box = upsertCategory(box, { label: 'Weer', components: [{ label: 'Regen', values: ['Licht', 'Zwaar'] }, { label: 'Wind', values: ['Stil', 'Storm'] }] });
  assert.deepEqual(box.components.map((c) => c.id), ['regen', 'wind', 'schade']);
  assert.equal(box.template, '{1} / {3}');
  box = removeCategory(box, 'weer');
  assert.equal(box.template, '{regen} / {1}');
  assert.equal(validateBox(box).valid, false);
  assert.equal(remapTemplate('{9}', [], []), '{9}');
});

test('setLlmPrompt creates a clipboard config and validates categories', () => {
  let box = setLlmPrompt(build(), { prompt: 'Schrijf een realistisch scenario.' });
  assert.equal(box.llm!.id, 'clipboard');
  assert.deepEqual(box.llm!.prompts, [{ type: 'narrative', prompt: 'Schrijf een realistisch scenario.', categories: ['weer', 'impact'] }]);
  box = setLlmPrompt(box, { prompt: 'Alleen het weer.', categories: ['weer'] });
  assert.equal(box.llm!.prompts.length, 1);
  box = setLlmPrompt(box, { type: 'persona', prompt: 'Persona' });
  assert.equal(box.llm!.prompts.length, 2);
  assert.throws(() => setLlmPrompt(box, { prompt: 'x', categories: ['nope'] }), /Unknown category/);
  assert.throws(() => setLlmPrompt(box, { type: 'bogus' as never, prompt: 'x' }), /Prompt type/);
  assert.equal(validateBox(box).valid, true);
  const removed = removeCategory(box, 'weer');
  assert.deepEqual(removed.llm!.prompts[0].categories, []);
  const stale = validateBox({ ...box, llm: { ...box.llm, prompts: [{ type: 'narrative', prompt: 'x', categories: ['gone'] }] } });
  assert.equal(stale.warnings.some((w) => w.code === 'unknown-prompt-category'), true);
});

test('language is validated', () => {
  assert.equal(validateBox({ ...build(), language: 'it' }).warnings.some((w) => w.code === 'unsupported-language'), true);
  assert.equal(validateBox({ ...build(), language: 3 }).errors.some((e) => e.code === 'invalid-language'), true);
});

const cli = fileURLToPath(new URL('../src/cli.ts', import.meta.url));
const run = (...args: string[]) => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', input: '' });

test('CLI sets language, template and LLM prompt', () => {
  const dir = mkdtempSync(join(tmpdir(), 'morph-box-'));
  const file = join(dir, 'box.json');
  try {
    assert.equal(run('init', file, '--label', 'Overstroming', '--language', 'nl').status, 0);
    run('add-category', file, '--data', JSON.stringify({ label: 'Weer', components: [{ label: 'Regen', values: ['Licht', 'Zwaar'] }] }));
    assert.match(run('template-prompt', file).stdout, /written in Dutch[\s\S]*1\. Regen/);
    const set = run('set-template', file, '--data', 'Er valt {1} regen.');
    assert.equal(set.status, 0);
    assert.match(set.stdout, /\{1\} -> Regen \[regen\]/);
    assert.equal(run('set-template', file, '--data', 'Fout {2}').status, 2);
    assert.equal(run('set-llm-prompt', file, '--data', 'Schrijf een scenario.').status, 0);
    assert.equal(run('set-llm-prompt', file, '--type', 'persona', '--categories', 'weer', '--data', 'Persona').status, 0);
    const personaInput = run('llm-prompt', file, '--type', 'persona', '--select', 'regen-zwaar');
    assert.equal(personaInput.status, 0);
    assert.match(personaInput.stdout, /^Persona\n\n- Regen: Zwaar\n$/);
    assert.equal(run('set-llm-prompt', file, '--categories', 'nope', '--data', 'x').status, 2);
    assert.match(run('generate', file, '-n', '1', '--seed', '2').stdout, /Er valt (Licht|Zwaar) regen\./);
    const box = JSON.parse(readFileSync(file, 'utf8'));
    assert.equal(box.language, 'nl');
    assert.equal(box.template, 'Er valt {1} regen.');
    assert.deepEqual(box.llm.prompts.map((p: { type: string }) => p.type), ['narrative', 'persona']);
    assert.equal(run('validate', file, '--strict').status, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

const withDecisions = () => {
  const box = build();
  return { ...box, categories: box.categories.map((c) => (c.label === 'Impact' ? { ...c, decisionSupport: true } : c)) };
};

test('template prompt leaves out decision categories', () => {
  const prompt = createTemplatePrompt(withDecisions());
  assert.match(prompt, /^1\. Regen$/m);
  assert.doesNotMatch(prompt, /Schade/);
});

test('renderTemplate drops decision-only lines until a decision is chosen', () => {
  const box = withDecisions();
  const template = 'Er valt {1} regen.\nMaatregel: {2}.';
  assert.equal(renderTemplate(box, template, { regen: ['regen-zwaar'] }), 'Er valt Zwaar regen.');
  assert.equal(
    renderTemplate(box, template, { regen: ['regen-zwaar'], schade: ['schade-geen'] }),
    'Er valt Zwaar regen.\nMaatregel: Geen.',
  );
});
