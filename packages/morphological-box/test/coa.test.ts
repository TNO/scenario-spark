import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  activeCoa,
  assessCoa,
  compareCoas,
  createLlmInput,
  createLlmPrompt,
  effectiveSelection,
  LLM_PROMPT_TYPES,
  nextCoaLabel,
  setInconsistency,
  setLlmPrompt,
  validateBox,
  type CourseOfAction,
  type MorphologicalBox,
  type NarrativeSettings,
} from '../src/index.ts';
import { sampleBox } from './fixtures.ts';

/** Sample box with a decision category: two measure factors. */
const withDecisions = (): MorphologicalBox & NarrativeSettings => {
  const box = sampleBox();
  box.categories.push({ id: 'measures', label: 'Measures', decisionSupport: true, componentIds: ['response', 'comms'] });
  box.components.push(
    {
      id: 'response',
      label: 'Response',
      desc: 'Population protection',
      manual: true,
      values: [
        { id: 'evacuate', label: 'Evacuate' },
        { id: 'shelter', label: 'Shelter in place' },
      ],
    },
    {
      id: 'comms',
      label: 'Communication',
      manual: true,
      values: [
        { id: 'alert', label: 'NL-Alert' },
        { id: 'press', label: 'Press conference' },
      ],
    },
  );
  setInconsistency(box.inconsistencies, 'bank', 'evacuate', 'impossible');
  setInconsistency(box.inconsistencies, 'ideology', 'press', 'unlikely');
  setInconsistency(box.inconsistencies, 'shelter', 'press', 'impossible');
  return box;
};

const coaA: CourseOfAction = { id: 'a', label: 'A', components: { response: ['evacuate'], comms: ['alert', 'press'] } };
const coaB: CourseOfAction = { id: 'b', label: 'B', desc: 'Stay inside', components: { response: ['shelter'], comms: ['press'] } };

test('effectiveSelection only takes decision factors from the COA', () => {
  const box = withDecisions();
  const narrative = { components: { motive: ['money'] }, coas: [{ id: 'a', label: 'A', components: { motive: ['ideology'], response: ['evacuate'] } }] };
  assert.deepEqual(effectiveSelection(box, narrative), { motive: ['money'], response: ['evacuate'] });
  box.categories.find((c) => c.id === 'measures')!.decisionSupport = false;
  assert.deepEqual(effectiveSelection(box, narrative), { motive: ['money'] });
});

test('CourseOfAction helpers mirror the app: active COA, effective selection, labels', () => {
  const narrative = { components: { motive: ['money'] }, coas: [coaA, coaB], activeCoaId: 'b' };
  assert.equal(activeCoa(narrative)?.id, 'b');
  assert.equal(activeCoa(narrative, 'a')?.id, 'a');
  assert.equal(activeCoa({ coas: [coaA, coaB] })?.id, 'a');
  assert.equal(activeCoa({}), undefined);
  const box = withDecisions();
  assert.deepEqual(effectiveSelection(box, narrative), { motive: ['money'], response: ['shelter'], comms: ['press'] });
  assert.equal(nextCoaLabel([]), 'A');
  assert.equal(nextCoaLabel([coaA, coaB]), 'C');
  assert.equal(nextCoaLabel(Array.from({ length: 26 }, (_, i) => ({ label: String.fromCharCode(65 + i) }))), 'AA');
});

test('assessCoa reports COA values excluded or made unlikely by the situation', () => {
  const box = withDecisions();
  const result = assessCoa(box, { motive: ['ideology'], asset: ['bank'] }, coaA);
  assert.equal(result.label, 'A');
  assert.deepEqual(
    result.values.map((v) => [v.id, v.status, v.conflicts]),
    [
      ['evacuate', 'excluded', ['bank']],
      ['alert', 'available', []],
      ['press', 'unlikely', ['ideology']],
    ],
  );
  assert.deepEqual(result.excluded, ['evacuate']);
  assert.deepEqual(result.unlikely, ['press']);
  assert.equal(result.consistent, false);
  assert.equal(result.values[0].componentLabel, 'Response');
  assert.equal(result.values[0].decision, true);
  const ok = assessCoa(box, { asset: ['grid'] }, { label: 'X', components: { response: ['evacuate'] } });
  assert.equal(ok.consistent, true);
  assert.deepEqual(ok.internalConflicts, []);
  const clash = assessCoa(box, { asset: ['grid'] }, coaB);
  assert.deepEqual(clash.internalConflicts, [['shelter', 'press']]);
  assert.equal(clash.consistent, false);
});

test('compareCoas lists decision components and an assessment per COA', () => {
  const box = withDecisions();
  const result = compareCoas(box, { asset: ['bank'] }, [coaA, coaB]);
  assert.deepEqual(result.components.map((c) => c.componentId), ['response', 'comms']);
  assert.deepEqual(result.coas.map((c) => [c.label, c.consistent]), [['A', false], ['B', false]]);
  assert.deepEqual(result.coas[0].excluded, ['evacuate']);
  assert.deepEqual(result.coas[1].excluded, []);
});

test('prompt types include decision; validation warns when the box has no decision categories', () => {
  assert.equal(LLM_PROMPT_TYPES.includes('decision'), true);
  const box = setLlmPrompt(withDecisions(), { type: 'decision', prompt: 'Assess the course of action.' });
  assert.deepEqual(box.llm!.prompts[0].categories, ['actor', 'target', 'measures']);
  assert.equal(validateBox(box).warnings.some((w) => w.code === 'decision-prompt-without-decisions'), false);
  const plain = setLlmPrompt(sampleBox(), { type: 'decision', prompt: 'Assess.' });
  assert.equal(validateBox(plain).warnings.some((w) => w.code === 'decision-prompt-without-decisions'), true);
  assert.throws(() => setLlmPrompt(withDecisions(), { type: 'decision', prompt: 'x', categories: ['nope'] }), /Unknown category/);
});

test('narrative LLM input splits situation and suggested actions, listing all values per factor', () => {
  const box = withDecisions();
  const narrative = { components: { motive: ['money', 'ideology'], asset: ['grid'] }, coas: [coaA] };
  const input = createLlmInput(box, { narrative });
  assert.equal(
    input,
    [
      'Situation (use these elements to describe the incident):',
      '- Motive: Money, Ideology',
      '- Asset: Power grid',
      '',
      'Suggested actions (measures to describe and assess):',
      '- Response (Population protection): Evacuate',
      '- Communication: NL-Alert, Press conference',
    ].join('\n'),
  );
  const none = createLlmInput(box, { narrative: { components: { motive: ['money'] } } });
  assert.match(none, /^Situation .*\n- Motive: Money\n\nNo measures were selected: describe only the incident/);
  const off = createLlmInput(box, { narrative, decisionSupport: false });
  assert.doesNotMatch(off, /Evacuate/);
  assert.match(off, /No measures were selected/);
  // Only the prompt's categories are included
  const actorOnly = createLlmInput(box, { narrative, categories: ['actor'] });
  assert.match(actorOnly, /Motive/);
  assert.doesNotMatch(actorOnly, /Asset|Evacuate/);
  // Boxes without decision categories and other prompt types keep a plain list
  assert.equal(createLlmInput(sampleBox(), { narrative: { components: { motive: ['money'], asset: ['bank'] } } }), '- Motive: Money\n- Asset: Bank');
  assert.equal(createLlmInput(box, { type: 'effect', narrative }), '- Motive: Money, Ideology\n- Asset: Power grid\n- Response (Population protection): Evacuate\n- Communication: NL-Alert, Press conference');
  // Custom (translated) headings
  assert.match(createLlmInput(box, { narrative, labels: { situation: 'Situatie:' } }), /^Situatie:\n/);
});

test('decision LLM input: situation, narrative text, COA decisions and other COAs', () => {
  const box = withDecisions();
  const narrative = { components: { motive: ['money'], asset: ['grid'] }, coas: [coaA, coaB], activeCoaId: 'a' };
  const input = createLlmInput(box, { type: 'decision', narrative, narrativeText: '  The grid fails.  ', categories: ['target'] });
  assert.equal(
    input,
    [
      'Situation (the incident the decisions respond to):',
      '- Asset: Power grid',
      '',
      'Scenario narrative:\nThe grid fails.',
      '',
      'Course of action A: decisions to assess:',
      '- Response (Population protection): Evacuate',
      '- Communication: NL-Alert, Press conference',
      '',
      'Other courses of action considered (for contrast only; do not assess them):',
      '- B: Stay inside',
    ].join('\n'),
  );
  const b = createLlmInput(box, { type: 'decision', narrative, coaId: 'b' });
  assert.match(b, /Course of action B: decisions to assess:\n- Response \(Population protection\): Shelter in place\n- Communication: Press conference/);
  assert.match(b, /- A\n?$/);
  const empty = createLlmInput(box, { type: 'decision', narrative: { components: { motive: ['money'] } } });
  assert.match(empty, /Course of action A has no decisions selected yet/);
  assert.doesNotMatch(empty, /Other courses of action|Scenario narrative/);
});

test('createLlmPrompt prefixes the box prompt of the type', () => {
  const box = setLlmPrompt(withDecisions(), { type: 'decision', prompt: 'Assess the course of action.' });
  const prompt = createLlmPrompt(box, { type: 'decision', narrative: { components: { asset: ['grid'] }, coas: [coaA] } });
  assert.match(prompt, /^Assess the course of action\.\n\nSituation \(the incident/);
  assert.match(createLlmPrompt(box, { narrative: { components: { asset: ['grid'] } } }), /^Situation/);
});

const cli = fileURLToPath(new URL('../src/cli.ts', import.meta.url));
const run = (...args: string[]) => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', input: '' });

test('CLI: decision prompt, options --coa, compare-coas and llm-prompt', () => {
  const dir = mkdtempSync(join(tmpdir(), 'morph-box-'));
  const file = join(dir, 'box.json');
  try {
    writeFileSync(file, JSON.stringify(withDecisions()));
    const set = run('set-llm-prompt', file, '--type', 'decision', '--data', 'Assess the course of action. Do not invent facts.');
    assert.equal(set.status, 0, set.stderr);
    assert.equal(JSON.parse(readFileSync(file, 'utf8')).llm.prompts[0].type, 'decision');
    assert.equal(run('validate', file).status, 0);

    const options = run('options', file, '--select', 'bank,ideology', '--coa', 'evacuate,alert,press');
    assert.equal(options.status, 0, options.stderr);
    assert.match(options.stdout, /## Course of action A/);
    assert.match(options.stdout, /X Evacuate \[evacuate\] <- bank/);
    assert.match(options.stdout, /~ Press conference \[press\] <- ideology/);
    assert.match(options.stdout, /Excluded by the situation: evacuate/);
    const json = JSON.parse(run('options', file, '--select', 'bank', '--coa', 'B=shelter', '--json').stdout);
    assert.equal(json.options.length, 5);
    assert.equal(json.coas[0].label, 'B');
    assert.equal(json.coas[0].consistent, true);
    assert.equal(run('options', file, '--select', 'bank', '--coa', 'money').status, 2);
    assert.equal(run('options', file, '--select', 'bank', '--coa', 'nope').status, 2);

    const compare = run('compare-coas', file, '--select', 'bank', '--coa', 'A=evacuate,alert', '--coa', 'B=shelter,press');
    assert.equal(compare.status, 0, compare.stderr);
    assert.match(compare.stdout, /\| Decision \| A \| B \|/);
    assert.match(compare.stdout, /\| Response \| X Evacuate \| \+ Shelter in place \|/);
    assert.match(compare.stdout, /A: Evacuate \[evacuate\] is excluded by Bank \[bank\]/);
    assert.match(compare.stdout, /B: Shelter in place \[shelter\] conflicts with Press conference \[press\]/);
    const compareJson = JSON.parse(run('compare-coas', file, '--select', 'bank', '--coa', 'evacuate', '--coa', 'shelter', '--json').stdout);
    assert.deepEqual(compareJson.coas.map((c: { label: string }) => c.label), ['A', 'B']);
    assert.equal(run('compare-coas', file, '--select', 'bank').status, 2);

    const prompt = run('llm-prompt', file, '--type', 'decision', '--select', 'grid', '--coa', 'A=evacuate', '--coa', 'B=shelter', '--text', 'The grid fails.');
    assert.equal(prompt.status, 0, prompt.stderr);
    assert.match(prompt.stdout, /^Assess the course of action\. Do not invent facts\.\n\nSituation/);
    assert.match(prompt.stdout, /Course of action A: decisions to assess:\n- Response \(Population protection\): Evacuate/);
    assert.match(prompt.stdout, /Other courses of action[^\n]*\n- B/);
    const second = run('llm-prompt', file, '--type', 'decision', '--select', 'grid', '--coa', 'A=evacuate', '--coa', 'B=shelter', '--active', 'B');
    assert.match(second.stdout, /Course of action B: decisions to assess/);
    const story = run('llm-prompt', file, '--select', 'grid,money', '--coa', 'evacuate');
    assert.equal(story.status, 0, story.stderr);
    assert.match(story.stdout, /Situation[^\n]*\n- Motive: Money\n- Asset: Power grid\n\nSuggested actions[^\n]*\n- Response/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('CourseOfAction accepts residual risk and criteria scores without affecting assessments', () => {
  const box = withDecisions();
  const scored: CourseOfAction = {
    ...coaA,
    probability: 'probability_1',
    impact: 'impact_2',
    risk: 'risk_2',
    scores: { effect: 4, speed: 2, safety: 5 },
  };
  const situation = { motive: ['ideology'], asset: ['bank'] };
  const plain = assessCoa(box, situation, coaA);
  const withScores = assessCoa(box, situation, scored);
  assert.deepEqual(withScores.values, plain.values);
  assert.equal(withScores.consistent, plain.consistent);
  assert.deepEqual(effectiveSelection(box, { components: situation, coas: [scored] }), effectiveSelection(box, { components: situation, coas: [coaA] }));
  const roundTrip: CourseOfAction = JSON.parse(JSON.stringify(scored));
  assert.deepEqual(roundTrip.scores, { effect: 4, speed: 2, safety: 5 });
});
