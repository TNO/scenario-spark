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
  setInconsistency,
  setManual,
  upsertCategory,
  validateBox,
} from '../src/index.ts';
import { sampleBox } from './fixtures.ts';

const withMeasures = () => {
  const box = sampleBox();
  box.categories.push({ id: 'measures', label: 'Measures', componentIds: ['response'] });
  box.components.push({
    id: 'response',
    label: 'Response',
    manual: true,
    values: [
      { id: 'evacuate', label: 'Evacuate' },
      { id: 'shelter', label: 'Shelter in place' },
      { id: 'monitor', label: 'Monitor' },
    ],
  });
  setInconsistency(box.inconsistencies, 'bank', 'evacuate', 'impossible');
  setInconsistency(box.inconsistencies, 'grid', 'monitor', 'unlikely');
  return box;
};

test('manual components are not generated unless locked or requested', () => {
  const box = withMeasures();
  for (let seed = 0; seed < 10; seed++) {
    const result = generateCombination(box, { random: createRandom(seed) });
    assert.ok(result.ok);
    assert.equal(result.selection.response, undefined);
    assert.ok(result.selection.asset);
  }
  const locked = generateCombination(box, { locked: { response: ['evacuate'] } });
  assert.ok(locked.ok);
  assert.deepEqual(locked.selection.asset, ['grid']);
  const all = generateCombination(box, { includeManual: true, random: createRandom(1) });
  assert.ok(all.ok);
  assert.equal(all.selection.response.length, 1);
});

test('assessOptions classifies values given the situation', () => {
  const options = assessOptions(withMeasures(), { asset: ['grid'] });
  const response = options.find((c) => c.componentId === 'response')!;
  assert.equal(response.manual, true);
  assert.deepEqual(
    response.values.map((v) => [v.id, v.status]),
    [['evacuate', 'available'], ['shelter', 'available'], ['monitor', 'unlikely']],
  );
  const bank = assessOptions(withMeasures(), { asset: ['bank'] }).find((c) => c.componentId === 'response')!;
  assert.deepEqual(bank.values[0], { id: 'evacuate', label: 'Evacuate', status: 'excluded', conflicts: ['bank'] });
  const asset = assessOptions(withMeasures(), { asset: ['bank'] }).find((c) => c.componentId === 'asset')!;
  assert.equal(asset.values[0].status, 'selected');
});

test('builder and validation support manual components', () => {
  let box = upsertCategory(createBox({ label: 'Flood' }), {
    label: 'Measures',
    manual: true,
    components: [{ label: 'Evacuation', values: ['None', 'Partial'] }, { label: 'Pumping', manual: false, values: ['Yes', 'No'] }],
  });
  assert.equal(box.components[0].manual, true);
  assert.equal(box.components[1].manual, undefined);
  box = setManual(box, ['pumping']);
  assert.equal(box.components[1].manual, true);
  box = setManual(box, ['measures'], false);
  assert.ok(box.components.every((c) => c.manual === undefined));
  assert.throws(() => setManual(box, ['nope']), /Unknown/);
  const invalid = withMeasures();
  (invalid.components[3] as { manual: unknown }).manual = 'yes';
  assert.ok(validateBox(invalid).errors.some((e) => e.code === 'invalid-manual'));
  // Infeasible manual components are still reported
  const infeasible = withMeasures();
  for (const a of ['bank', 'grid']) for (const r of ['evacuate', 'shelter', 'monitor']) setInconsistency(infeasible.inconsistencies, a, r, 'impossible');
  assert.ok(validateBox(infeasible).errors.some((e) => e.code === 'infeasible'));
});

test('CLI set-manual, options and generate --include-manual', () => {
  const cli = fileURLToPath(new URL('../src/cli.ts', import.meta.url));
  const run = (...args: string[]) => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', input: '' });
  const dir = mkdtempSync(join(tmpdir(), 'morph-box-'));
  const file = join(dir, 'box.json');
  try {
    writeFileSync(file, JSON.stringify({ ...withMeasures(), components: withMeasures().components.map(({ manual, ...c }) => c) }));
    assert.equal(run('set-manual', file, 'measures').status, 0);
    assert.equal(JSON.parse(readFileSync(file, 'utf8')).components[3].manual, true);
    assert.match(run('outline', file).stdout, /Response \[component: response\] \(manual\)/);
    const generated = run('generate', file, '-n', '2', '--seed', '1');
    assert.match(generated.stdout, /Response: \(manual, to be chosen\)/);
    assert.match(run('generate', file, '-n', '1', '--seed', '1', '--include-manual').stdout, /Response: (Evacuate|Shelter in place|Monitor)/);
    const options = run('options', file, '--select', 'bank');
    assert.equal(options.status, 0);
    assert.match(options.stdout, /X Evacuate \[evacuate\] <- bank/);
    assert.match(options.stdout, /\* Bank \[bank\]/);
    assert.equal(JSON.parse(run('options', file, '--select', 'grid', '--json').stdout)[3].values[2].status, 'unlikely');
    assert.equal(run('options', file, '--select', 'nope').status, 2);
    assert.equal(run('set-manual', file, 'response', '--off').status, 0);
    assert.equal(JSON.parse(readFileSync(file, 'utf8')).components[3].manual, undefined);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
