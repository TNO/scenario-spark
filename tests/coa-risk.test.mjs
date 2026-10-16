import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  COA_CRITERIA,
  coaRiskRows,
  coaScores,
  levelIndex,
  narrativeCoaRows,
  riskLevel,
  riskMatrix,
  updateRisk,
} from '../src/utils/decision.ts';

test('riskLevel uses the 5x5 probability x impact matrix', () => {
  const expected = [
    [0, 0, 1, 2, 3],
    [0, 1, 2, 3, 4],
    [1, 2, 3, 4, 4],
    [2, 3, 4, 4, 4],
    [3, 4, 4, 4, 4],
  ];
  for (let p = 0; p < 5; p++) {
    for (let i = 0; i < 5; i++) {
      assert.equal(riskLevel(`probability_${p}`, `impact_${i}`), `risk_${expected[p][i]}`);
    }
  }
  assert.equal(riskLevel(undefined, 'impact_2'), undefined);
  assert.equal(riskLevel('probability_2', undefined), undefined);
  assert.equal(riskLevel('probability_9', 'impact_1'), undefined);
  assert.equal(levelIndex('risk_3'), 3);
  assert.equal(levelIndex(undefined), undefined);
  assert.equal(levelIndex('nonsense'), undefined);
});

test('updateRisk keeps the narrative behaviour: only sets risk when both are set', () => {
  const narrative = { probability: 'probability_4', impact: 'impact_0' };
  updateRisk(narrative);
  assert.equal(narrative.risk, 'risk_3');
  const partial = { probability: 'probability_4', risk: 'risk_1' };
  updateRisk(partial);
  assert.equal(partial.risk, 'risk_1');
  const coa = { id: 'a', label: 'A', components: {}, probability: 'probability_1', impact: 'impact_1' };
  updateRisk(coa);
  assert.equal(coa.risk, 'risk_1');
});

const narrative = {
  id: 'n1',
  label: 'Flood',
  components: {},
  risk: 'risk_3',
  probability: 'probability_3',
  impact: 'impact_1',
  activeCoaId: 'b',
  coas: [
    { id: 'a', label: 'A', components: {}, probability: 'probability_1', impact: 'impact_1', risk: 'risk_1' },
    { id: 'b', label: 'B', components: {} },
    { id: 'c', label: 'C', components: {}, probability: 'probability_4', impact: 'impact_4', risk: 'risk_4' },
    { id: 'd', label: 'D', components: {}, risk: 'risk_3' },
  ],
};

test('coaRiskRows compares situation risk with residual risk per COA', () => {
  const rows = coaRiskRows(narrative);
  assert.deepEqual(
    rows.map((r) => [r.label, r.active, r.before, r.after, r.change]),
    [
      ['A', false, 3, 1, 'lower'],
      ['B', true, 3, undefined, undefined],
      ['C', false, 3, 4, 'higher'],
      ['D', false, 3, 3, 'same'],
    ],
  );
  assert.deepEqual(coaRiskRows({ components: {} }), []);
  const noSituation = coaRiskRows({ components: {}, coas: [{ id: 'x', label: 'X', components: {}, risk: 'risk_2' }] });
  assert.equal(noSituation[0].before, undefined);
  assert.equal(noSituation[0].after, 2);
  assert.equal(noSituation[0].change, undefined);
});

test('narrativeCoaRows reports the residual risk only when set', () => {
  const box = {
    includeDecisionSupport: true,
    categories: [{ id: 'dec', label: 'Measures', decisionSupport: true, componentIds: ['m'] }],
    components: [{ id: 'm', label: 'Measure', values: [{ id: 'x', label: 'X' }] }],
    inconsistencies: {},
  };
  const n = {
    components: {},
    risk: 'risk_3',
    coas: [
      { id: 'a', label: 'A', components: { m: ['x'] }, risk: 'risk_1' },
      { id: 'b', label: 'B', components: { m: ['x'] } },
    ],
  };
  const rows = narrativeCoaRows(box, n);
  assert.deepEqual(rows[0].risk, { before: 'risk_3', after: 'risk_1' });
  assert.equal(rows[1].risk, undefined);
});

test('narrativeCoaRows exports the reflection, also of a COA with only a reflection', () => {
  const box = {
    includeDecisionSupport: true,
    categories: [{ id: 'dec', label: 'Measures', decisionSupport: true, componentIds: ['m'] }],
    components: [{ id: 'm', label: 'Measure', values: [{ id: 'x', label: 'X' }] }],
    inconsistencies: {},
  };
  const n = {
    components: {},
    coas: [
      { id: 'a', label: 'A', components: { m: ['x'] }, reflection: '- **Risk**: late' },
      { id: 'b', label: 'B', components: {}, reflection: 'Only a reflection' },
      { id: 'c', label: 'C', components: {}, reflection: '  ' },
    ],
  };
  const rows = narrativeCoaRows(box, n);
  assert.deepEqual(rows.map((r) => [r.label, r.reflection]), [
    ['A', '- **Risk**: late'],
    ['B', 'Only a reflection'],
  ]);
});

test('riskMatrix places scenarios and the COAs of the selected scenario', () => {
  const other = { id: 'n2', label: 'Fire', components: {}, probability: 'probability_0', impact: 'impact_4', risk: 'risk_3' };
  const unplaced = { id: 'n3', label: 'Storm', components: {} };
  const matrix = riskMatrix([narrative, other, unplaced], 'n1');
  assert.equal(matrix.cells.length, 5);
  assert.equal(matrix.cells[0].length, 5);
  assert.equal(matrix.cells[4][4].risk, 4);
  assert.equal(matrix.cells[0][0].risk, 0);
  assert.deepEqual(
    matrix.markers.map((mk) => [mk.kind, mk.marker, mk.label, mk.probability, mk.impact, mk.risk]),
    [
      ['situation', '1', 'Flood', 3, 1, 3],
      ['situation', '2', 'Fire', 0, 4, 3],
      ['coa', 'A', 'A', 1, 1, 1],
      ['coa', 'C', 'C', 4, 4, 4],
    ],
  );
  assert.deepEqual(matrix.cells[3][1].markers.map((mk) => mk.marker), ['1']);
  assert.deepEqual(matrix.cells[4][4].markers.map((mk) => mk.marker), ['C']);
  // COAs without probability/impact (B, D) and scenarios without them (Storm) are not placed
  assert.deepEqual(
    matrix.unplaced.map((u) => [u.kind, u.label]),
    [
      ['situation', 'Storm'],
      ['coa', 'B'],
      ['coa', 'D'],
    ],
  );
  const noSelection = riskMatrix([narrative, other]);
  assert.equal(noSelection.markers.filter((mk) => mk.kind === 'coa').length, 0);
});

test('coaScores: weighted sum, missing weights count 1, zero weights are ignored', () => {
  assert.deepEqual(COA_CRITERIA, ['effect', 'speed', 'capacity', 'safety', 'legality', 'acceptance']);
  const coas = [
    { id: 'a', label: 'A', components: {}, scores: { effect: 5, speed: 1 } },
    { id: 'b', label: 'B', components: {}, scores: { effect: 3, speed: 4, capacity: 2 } },
    { id: 'c', label: 'C', components: {} },
  ];
  const equal = coaScores(coas);
  assert.deepEqual(
    equal.rows.map((r) => [r.label, r.total, r.max, r.missing, r.rank]),
    [
      ['A', 6, 30, 4, 2],
      ['B', 9, 30, 3, 1],
      ['C', undefined, 30, 6, undefined],
    ],
  );
  assert.equal(equal.used, true);

  const weighted = coaScores(coas, { effect: 3, speed: 0, capacity: 0, safety: 0, legality: 0, acceptance: 0 });
  assert.equal(weighted.used, true);
  assert.deepEqual(
    weighted.rows.map((r) => [r.label, r.total, r.max, r.missing, r.rank]),
    [
      ['A', 15, 15, 0, 1],
      ['B', 9, 15, 0, 2],
      ['C', undefined, 15, 1, undefined],
    ],
  );
  assert.deepEqual(weighted.weights, { effect: 3, speed: 0, capacity: 0, safety: 0, legality: 0, acceptance: 0 });
});

test('coaScores: ties share a rank, all-zero weights give no ranking, invalid scores ignored', () => {
  const coas = [
    { id: 'a', label: 'A', components: {}, scores: { effect: 4 } },
    { id: 'b', label: 'B', components: {}, scores: { effect: 4 } },
    { id: 'c', label: 'C', components: {}, scores: { effect: 2, speed: Number.NaN } },
  ];
  assert.deepEqual(
    coaScores(coas).rows.map((r) => r.rank),
    [1, 1, 3],
  );
  const zero = coaScores(coas, Object.fromEntries(COA_CRITERIA.map((c) => [c, 0])));
  assert.deepEqual(zero.rows.map((r) => [r.total, r.rank]), [[undefined, undefined], [undefined, undefined], [undefined, undefined]]);
  assert.equal(coaScores(coas).rows[2].missing, 5);
  assert.equal(coaScores([]).used, false);
  assert.equal(coaScores(coas).used, true);
});
