import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  assessOptions,
  createBox,
  createRandom,
  generateCombination,
  getDecisionComponentIds,
  setDecision,
  setInconsistency,
  upsertCategory,
  validateBox,
} from '../src/index.ts';
import { sampleBox } from './fixtures.ts';

const withDecisions = () => {
  const box = sampleBox();
  box.categories.push({ id: 'measures', label: 'Measures', decisionSupport: true, componentIds: ['response'] });
  box.components.push({
    id: 'response',
    label: 'Response',
    manual: true,
    values: [
      { id: 'evacuate', label: 'Evacuate' },
      { id: 'shelter', label: 'Shelter in place' },
    ],
  });
  setInconsistency(box.inconsistencies, 'bank', 'evacuate', 'impossible');
  return box;
};

const codes = (box: unknown) => validateBox(box).warnings.map((w) => w.code);

test('builder: decision categories make their components manual by default', () => {
  const box = upsertCategory(createBox({ label: 'Flood' }), {
    label: 'Measures',
    decision: true,
    components: [
      { label: 'Evacuation', values: ['None', 'Partial'] },
      { label: 'Pumping', manual: false, values: ['Yes', 'No'] },
    ],
  });
  assert.equal(box.categories[0].decisionSupport, true);
  assert.equal(box.components[0].manual, true);
  assert.equal(box.components[1].manual, undefined);
  const alias = upsertCategory(createBox({ label: 'Flood' }), {
    label: 'Measures',
    decisionSupport: true,
    components: [{ label: 'Evacuation', values: ['None', 'Partial'] }],
  });
  assert.equal(alias.categories[0].decisionSupport, true);
  assert.equal(alias.components[0].manual, true);
  const plain = upsertCategory(createBox({ label: 'Flood' }), {
    label: 'Weather',
    components: [{ label: 'Rain', values: ['Light', 'Heavy'] }],
  });
  assert.equal(plain.categories[0].decisionSupport, undefined);
  assert.equal(plain.components[0].manual, undefined);
  // Replacing a decision category without the flag keeps it a decision category
  const replaced = upsertCategory(box, { label: 'Measures', components: [{ label: 'Evacuation', values: ['None', 'Full'] }] });
  assert.equal(replaced.categories[0].decisionSupport, true);
  assert.equal(replaced.components[0].manual, true);
  const cleared = upsertCategory(box, { label: 'Measures', decision: false, components: [{ label: 'Evacuation', values: ['None', 'Full'] }] });
  assert.equal(cleared.categories[0].decisionSupport, undefined);
});

test('setDecision sets the flag and manual; --off only clears the flag', () => {
  const box = sampleBox();
  box.components[2].manual = undefined;
  const on = setDecision(box, ['target']);
  assert.equal(on.categories[1].decisionSupport, true);
  assert.equal(on.components[2].manual, true);
  assert.equal(on.components[0].manual, undefined);
  assert.equal(box.categories[1].decisionSupport, undefined, 'input is not mutated');
  const off = setDecision(on, ['target'], false);
  assert.equal('decisionSupport' in off.categories[1], false);
  assert.equal(off.components[2].manual, true);
  const both = setDecision(box, ['actor', 'target']);
  assert.ok(both.categories.every((c) => c.decisionSupport));
  assert.ok(both.components.every((c) => c.manual));
  assert.throws(() => setDecision(box, ['motive']), /Unknown category/);
  assert.deepEqual(getDecisionComponentIds(both), new Set(['motive', 'capability', 'asset']));
});

test('generate keeps decision components empty unless includeManual', () => {
  const box = withDecisions();
  for (let seed = 0; seed < 5; seed++) {
    const result = generateCombination(box, { random: createRandom(seed) });
    assert.ok(result.ok);
    assert.equal(result.selection.response, undefined);
  }
  const all = generateCombination(box, { includeManual: true, random: createRandom(1) });
  assert.ok(all.ok);
  assert.equal(all.selection.response.length, 1);
});

test('assessOptions marks decision components', () => {
  const options = assessOptions(withDecisions(), { asset: ['bank'] });
  assert.equal(options.find((c) => c.componentId === 'response')!.decision, true);
  assert.equal(options.find((c) => c.componentId === 'asset')!.decision, false);
});

test('validation warns about non-manual decision components and unlinked decisions', () => {
  const box = withDecisions();
  assert.deepEqual(validateBox(box).warnings, []);
  const notManual = withDecisions();
  delete notManual.components[3].manual;
  const warning = validateBox(notManual).warnings.find((w) => w.code === 'decision-component-not-manual');
  assert.ok(warning);
  assert.equal(warning.level, 'warning');
  assert.equal(warning.path, '$.components[3].manual');
  assert.equal(validateBox(notManual).valid, true);
  const unlinked = withDecisions();
  unlinked.inconsistencies = {};
  assert.ok(codes(unlinked).includes('decision-unlinked'));
  assert.equal(validateBox(unlinked).valid, true);
  const unlikely = withDecisions();
  unlikely.inconsistencies = {};
  setInconsistency(unlikely.inconsistencies, 'grid', 'shelter', 'unlikely');
  assert.ok(codes(unlikely).includes('decision-unlinked'), 'only impossible pairs count as exclusions');
  const noDecisions = sampleBox();
  assert.ok(!codes(noDecisions).includes('decision-unlinked'));
  const invalid = withDecisions();
  (invalid.categories[2] as { decisionSupport: unknown }).decisionSupport = 'yes';
  assert.ok(validateBox(invalid).errors.some((e) => e.code === 'invalid-decision-support'));
});

test('CLI set-decision, outline, stats, options and generate', () => {
  const cli = fileURLToPath(new URL('../src/cli.ts', import.meta.url));
  const run = (...args: string[]) => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', input: '' });
  const dir = mkdtempSync(join(tmpdir(), 'morph-box-'));
  const file = join(dir, 'box.json');
  try {
    const box = withDecisions();
    box.categories[2] = { id: 'measures', label: 'Measures', componentIds: ['response'] };
    delete box.components[3].manual;
    writeFileSync(file, JSON.stringify(box));
    const set = run('set-decision', file, 'measures');
    assert.equal(set.status, 0);
    assert.match(set.stdout, /Decision categories: measures/);
    let saved = JSON.parse(readFileSync(file, 'utf8'));
    assert.equal(saved.categories[2].decisionSupport, true);
    assert.equal(saved.components[3].manual, true);
    assert.match(run('outline', file).stdout, /## Measures \[category: measures\] \(decision\)/);
    assert.equal(JSON.parse(run('stats', file, '--json').stdout).decisionCategories, 1);
    assert.match(run('stats', file).stdout, /decisionCategories: 1/);
    const options = run('options', file, '--select', 'bank');
    assert.equal(options.status, 0);
    assert.match(options.stdout, /## Situation[\s\S]*Asset \[asset\][\s\S]*## Decisions[\s\S]*Response \[response\]/);
    assert.match(options.stdout, /X Evacuate \[evacuate\] <- bank/);
    assert.equal(JSON.parse(run('options', file, '--select', 'bank', '--json').stdout)[3].decision, true);
    assert.match(run('generate', file, '-n', '1', '--seed', '1').stdout, /Response: \(manual, to be chosen\)/);
    assert.match(run('generate', file, '-n', '1', '--seed', '1', '--include-manual').stdout, /Response: (Evacuate|Shelter in place)/);
    assert.equal(run('set-decision', file, 'measures', '--off').status, 0);
    saved = JSON.parse(readFileSync(file, 'utf8'));
    assert.equal(saved.categories[2].decisionSupport, undefined);
    assert.equal(saved.components[3].manual, true);
    assert.doesNotMatch(run('options', file, '--select', 'bank').stdout, /## Decisions/);
    assert.equal(run('set-decision', file, 'response').status, 2);
    assert.equal(run('set-decision', file).status, 2);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
