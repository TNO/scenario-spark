import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const cli = fileURLToPath(new URL('../src/cli.ts', import.meta.url));
const run = (...args: string[]) => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', input: '' });

test('CLI builds, validates and samples a box', () => {
  const dir = mkdtempSync(join(tmpdir(), 'morph-box-'));
  const file = join(dir, 'box.json');
  try {
    assert.equal(run('init', file, '--label', 'Flood', '--desc', 'River flooding').status, 0);
    assert.equal(run('init', file, '--label', 'Flood').status, 2);
    const category = JSON.stringify({ label: 'Weather', components: [{ label: 'Rain', values: ['Light', 'Heavy'] }] });
    assert.equal(run('add-category', file, '--data', category).status, 0);
    const stdinResult = execFileSync(process.execPath, [cli, 'add-category', file], {
      encoding: 'utf8',
      input: JSON.stringify({ label: 'Impact', components: [{ label: 'Damage', values: ['None', 'Severe'] }] }),
    });
    assert.match(stdinResult, /damage-severe/);
    const inc = JSON.stringify([{ a: 'rain-light', b: 'damage-severe', type: 'impossible' }]);
    assert.equal(run('set-inconsistencies', file, '--data', inc).status, 0);
    assert.equal(run('validate', file).status, 0);
    assert.match(run('matrix', file, 'rain', 'damage').stdout, /rain-light\s+\.\s+X/);
    assert.match(run('generate', file, '-n', '3', '--seed', '1').stdout, /Scenario 1/);
    const box = JSON.parse(readFileSync(file, 'utf8'));
    assert.equal(box.inconsistencies['damage-severe']['rain-light'], true);
    assert.deepEqual(box.narratives, []);
    assert.equal(run('set-inconsistencies', file, '--data', '[{"a":"rain","b":"damage","type":"impossible"}]').status, 0);
    const result = run('validate', file, '--json');
    assert.equal(result.status, 1);
    assert.equal(JSON.parse(result.stdout).errors[0].code, 'infeasible');
    assert.equal(run('bogus', file).status, 2);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
