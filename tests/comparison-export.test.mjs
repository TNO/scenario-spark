import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildComparisonExport } from '../src/utils/decision.ts';

/** Fake translator: shows the key and its argument, so the tests check which text is used */
const tr = (key, arg) =>
  arg === undefined
    ? key
    : typeof arg === 'object'
    ? `${key}(${Object.entries(arg)
        .map(([k, v]) => `${k}=${v}`)
        .join(',')})`
    : `${key}.${arg}`;
const formatDate = (ts) => `date:${ts}`;

const makeBox = () => ({
  label: 'Floods',
  categories: [
    { id: 'sit', label: 'Situation', componentIds: ['threat'] },
    { id: 'dec', label: 'Measures', decisionSupport: true, componentIds: ['measure', 'comms'] },
  ],
  components: [
    { id: 'threat', label: 'Threat', values: [{ id: 'fire', label: 'Fire' }, { id: 'flood', label: 'Flood' }] },
    { id: 'measure', label: 'Measure', values: [{ id: 'evacuate', label: 'Evacuate' }, { id: 'water', label: 'Use water' }] },
    { id: 'comms', label: 'Communication', values: [{ id: 'sms', label: 'SMS' }, { id: 'radio', label: 'Radio' }] },
  ],
  inconsistencies: { flood: { water: true }, water: { flood: true } },
  includeDecisionSupport: true,
  narratives: [],
  decisionLog: [
    { id: 'l1', timestamp: 100, narrativeId: 'n1', narrativeLabel: 'Flood', coaId: 'b', coaLabel: 'B', decision: 'Pick B', rationale: 'Safer', author: 'Erik' },
    { id: 'l2', timestamp: 200, narrativeId: 'gone', narrativeLabel: 'Old scenario', decision: 'Drop it' },
  ],
});

const flood = {
  id: 'n1',
  label: 'Flood',
  included: true,
  components: { threat: ['flood'] },
  probability: 'probability_3',
  impact: 'impact_2',
  risk: 'risk_4',
  activeCoaId: 'b',
  coas: [
    { id: 'a', label: 'A', components: { measure: ['evacuate'], comms: ['sms'] }, probability: 'probability_1', impact: 'impact_1', risk: 'risk_1', scores: { effect: 4 } },
    { id: 'b', label: 'B', components: { measure: ['water', 'evacuate'], comms: ['sms'] }, scores: { effect: 2 } },
  ],
};

const fire = {
  id: 'n2',
  label: 'Fire',
  included: true,
  components: { threat: ['fire'] },
  coas: [{ id: 'c', label: 'A', components: { measure: ['evacuate'], comms: ['radio'] } }],
};

const setup = () => {
  const box = makeBox();
  box.narratives = [flood, fire];
  return { box, data: buildComparisonExport(box, [flood, fire], { narrativeId: 'n1', tr, formatDate, now: 5 }) };
};

const headings = (data) => data.blocks.filter((b) => b.kind === 'heading').map((b) => b.text);
const tableAfter = (data, heading) => {
  const start = data.blocks.findIndex((b) => b.kind === 'heading' && b.text === heading);
  return data.blocks.slice(start + 1).find((b) => b.kind === 'table');
};
const text = (cell) => (typeof cell === 'string' ? cell : cell.text);

test('buildComparisonExport: title, date and sections in page order', () => {
  const { data } = setup();
  assert.equal(data.title, 'DECISION_EXPORT_TITLE: Floods');
  assert.equal(data.blocks[0].text, 'DECISION_EXPORT_DATE(date=date:5)');
  assert.deepEqual(headings(data), [
    'DECISION_VIEW_OVERVIEW',
    'SUGGESTED_WHY',
    'DECISION_VIEW_COA',
    'CRITERIA_SCORING',
    'DECISION_VIEW_ROBUSTNESS',
    'DECISION_VIEW_RISK',
    'DECISION_LOG',
  ]);
});

test('buildComparisonExport: overview table with the active COA and the suggested approach', () => {
  const { data } = setup();
  const table = tableAfter(data, 'DECISION_VIEW_OVERVIEW');
  assert.deepEqual(table.header, ['NAME', 'PROBABILITY', 'IMPACT', 'RISK', 'Measure', 'Communication']);
  assert.deepEqual(table.rows.map((r) => r.cells.map(text)), [
    ['Flood – COURSE_OF_ACTION B', 'PROB5.3', 'IMP5.2', 'RISK5.4', 'Use water, Evacuate', 'SMS'],
    ['Fire – COURSE_OF_ACTION A', '', '', '', 'Evacuate', 'Radio'],
    ['SUGGESTED_APPROACH.TITLE', '', '', '', 'Evacuate', 'SMS'],
  ]);
  const whyAt = data.blocks.findIndex((b) => b.text === 'SUGGESTED_WHY');
  assert.equal(data.blocks[whyAt + 1].text, 'SUGGESTED_HINT');
  const why = data.blocks[whyAt + 2];
  assert.equal(why.kind, 'list');
  assert.ok(why.items.some((i) => i.startsWith('Measure: Evacuate – SUGGESTED_PICK(count=2,total=2,weight=6)')));
});

test('buildComparisonExport: COA comparison with risk, conflicts and criteria scores', () => {
  const { data } = setup();
  const start = data.blocks.findIndex((b) => b.text === 'DECISION_VIEW_COA');
  assert.equal(data.blocks[start + 1].text, 'COMPARE_SCENARIO: Flood');
  const table = tableAfter(data, 'DECISION_VIEW_COA');
  assert.deepEqual(table.header, ['DECISIONS', 'COURSE_OF_ACTION A', 'COURSE_OF_ACTION B (COA_ACTIVE)']);
  assert.deepEqual(table.rows.map((r) => [r.group || false, ...r.cells.map(text)]), [
    [true, 'RISK'],
    [false, 'RISK_BEFORE_AFTER', 'RISK_TRANSITION(before=RISK5.4,after=RISK5.1) ↓', 'RISK_TRANSITION(before=RISK5.4,after=RISK_NOT_SET)'],
    [true, 'Measures'],
    [false, 'Measure', 'Evacuate', 'Use water ⚠, Evacuate'],
    [false, 'Communication', 'SMS', 'SMS'],
  ]);
  const notes = data.blocks.slice(start).find((b) => b.kind === 'list');
  assert.deepEqual(notes.items, ['COURSE_OF_ACTION B: COA_CONFLICT(value=Use water,situation=Flood)']);
  const scores = tableAfter(data, 'CRITERIA_SCORING');
  assert.deepEqual(scores.header, ['CRITERIA_CRITERION', 'CRITERIA_WEIGHT', 'COURSE_OF_ACTION A', 'COURSE_OF_ACTION B']);
  assert.deepEqual(scores.rows[0].cells.map(text), ['CRITERIA.effect', '1', '4', '2']);
  assert.deepEqual(scores.rows[1].cells.map(text), ['CRITERIA.speed', '1', '–', '–']);
  const total = scores.rows.at(-2).cells.map(text);
  assert.equal(total[0], 'CRITERIA_TOTAL');
  assert.match(total[2], /^CRITERIA_TOTAL_OF\(total=4,max=30\)/);
  assert.deepEqual(scores.rows.at(-1).cells.map(text), ['CRITERIA_RANK', '', '1', '2']);
});

test('buildComparisonExport: robustness grid with symbols', () => {
  const { data } = setup();
  const table = tableAfter(data, 'DECISION_VIEW_ROBUSTNESS');
  assert.deepEqual(table.header, ['ROBUSTNESS_MEASURE', 'Flood (B)', 'Fire (A)', 'ROBUSTNESS_CHOSEN_IN']);
  const rows = table.rows.map((r) => r.cells.map(text));
  assert.deepEqual(rows[0], ['Measures']);
  assert.deepEqual(rows[1], ['Measure']);
  assert.deepEqual(rows[2], ['Evacuate', '✓', '✓', 'ROBUSTNESS_COUNT(count=2,total=2) ★']);
  assert.deepEqual(rows[3], ['Use water', '✓ ⚠', '–', 'ROBUSTNESS_COUNT(count=1,total=2) ①']);
});

test('buildComparisonExport: risk grid coloured by level, marker list and decision log', () => {
  const { data } = setup();
  const grid = tableAfter(data, 'DECISION_VIEW_RISK');
  assert.equal(grid.header.length, 6);
  // Top row is very high probability; probability 3 (second row), impact 2 has scenario 1
  const p3 = grid.rows[1].cells;
  assert.equal(text(p3[0]), 'PROB5.3');
  assert.equal(p3[3].risk, 4);
  assert.equal(p3[3].text, '1');
  assert.equal(grid.rows[3].cells[2].text, 'A');
  const start = data.blocks.findIndex((b) => b.text === 'DECISION_VIEW_RISK');
  const tables = data.blocks.slice(start).filter((b) => b.kind === 'table');
  assert.deepEqual(tables[1].rows.map((r) => r.cells.map(text)), [
    ['1', 'Flood', 'PROB5.3', 'IMP5.2', 'RISK5.4'],
    ['A', 'COURSE_OF_ACTION A (Flood)', 'PROB5.1', 'IMP5.1', 'RISK5.1'],
  ]);
  const unplaced = data.blocks.slice(start).find((b) => b.kind === 'paragraph' && b.text.startsWith('RISK_MATRIX_UNPLACED'));
  assert.equal(unplaced.text, 'RISK_MATRIX_UNPLACED(items=Fire, COURSE_OF_ACTION B (Flood))');

  const log = tableAfter(data, 'DECISION_LOG');
  assert.deepEqual(log.header, [
    'DECISION_LOG_DATE',
    'DECISION_LOG_SCENARIO',
    'COURSE_OF_ACTION',
    'DECISION_LOG_DECISION',
    'DECISION_LOG_RATIONALE',
    'DECISION_LOG_AUTHOR',
  ]);
  assert.deepEqual(log.rows.map((r) => r.cells.map(text)), [
    ['date:200', 'Old scenario (DECISION_LOG_REMOVED)', '', 'Drop it', '', ''],
    ['date:100', 'Flood', 'B', 'Pick B', 'Safer', 'Erik'],
  ]);
});

test('buildComparisonExport: without decision categories only overview, risk and log', () => {
  const box = makeBox();
  box.categories = [box.categories[0]];
  box.decisionLog = [];
  box.narratives = [flood];
  const data = buildComparisonExport(box, [flood], { tr, formatDate, now: 1 });
  assert.deepEqual(headings(data), ['DECISION_VIEW_OVERVIEW', 'DECISION_VIEW_RISK', 'DECISION_LOG']);
  assert.deepEqual(tableAfter(data, 'DECISION_VIEW_OVERVIEW').header, ['NAME', 'PROBABILITY', 'IMPACT', 'RISK']);
  assert.equal(data.blocks.at(-1).text, 'DECISION_LOG_EMPTY');
});

test('buildComparisonExport: no included scenarios', () => {
  const box = makeBox();
  const data = buildComparisonExport(box, [], { tr, formatDate, now: 1 });
  assert.deepEqual(headings(data), ['DECISION_LOG']);
  assert.equal(data.blocks[1].text, 'NO_INCLUDED_NARRATIVES');
});

test('comparisonDocument renders the export blocks as a landscape Word document', async () => {
  const { createRequire } = await import('node:module');
  const require = createRequire(import.meta.url);
  const docxPath = require.resolve('docx');
  const { Packer } = await import(docxPath);
  const JSZip = createRequire(docxPath)('jszip');
  const { comparisonDocument } = await import('../src/utils/comparison-docx.ts');
  const { data } = setup();
  const doc = await comparisonDocument(data, ['#00ff00', '#99ff00', '#ffff00', '#ff9900', '#ff0000']);
  const zip = await JSZip.loadAsync(await Packer.toBuffer(doc));
  const xml = await zip.file('word/document.xml').async('string');
  for (const expected of ['DECISION_EXPORT_TITLE: Floods', 'DECISION_VIEW_ROBUSTNESS', 'Use water ⚠, Evacuate', 'Pick B', 'Old scenario (DECISION_LOG_REMOVED)']) {
    assert.ok(xml.includes(expected), expected);
  }
  assert.match(xml, /w:orient="landscape"/);
  assert.match(xml, /w:fill="ff0000"/);
  assert.match(xml, /w:gridSpan w:val="3"/);
});
