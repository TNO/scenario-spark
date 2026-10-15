import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  coaComparisonRows,
  coaTitle,
  comparedNarratives,
  comparisonNarrativeId,
  selectedNarratives,
  robustnessGrid,
} from '../src/utils/decision.ts';

const box = {
  categories: [
    { id: 'sit', label: 'Situation', componentIds: ['threat'] },
    { id: 'dec', label: 'Measures', decisionSupport: true, componentIds: ['measure', 'comms'] },
    { id: 'dec2', label: 'Organisation', decisionSupport: true, componentIds: ['lead', 'measure'] },
  ],
  components: [
    { id: 'threat', label: 'Threat', values: [{ id: 'fire', label: 'Fire' }, { id: 'flood', label: 'Flood' }] },
    {
      id: 'measure',
      label: 'Measure',
      values: [
        { id: 'evacuate', label: 'Evacuate' },
        { id: 'water', label: 'Use water' },
      ],
    },
    { id: 'comms', label: 'Communication', values: [{ id: 'sms', label: 'SMS' }, { id: 'radio', label: 'Radio' }] },
    { id: 'lead', label: 'Lead', values: [{ id: 'police', label: 'Police' }] },
  ],
  inconsistencies: { flood: { water: true }, water: { flood: true } },
};

const flood = {
  id: 'n1',
  label: 'Flood',
  components: { threat: ['flood'] },
  activeCoaId: 'b',
  coas: [
    { id: 'a', label: 'A', components: { measure: ['evacuate'], comms: ['sms'] } },
    { id: 'b', label: 'B', components: { measure: ['water', 'evacuate'], comms: ['sms'] } },
  ],
};

const fire = {
  id: 'n2',
  label: 'Fire',
  components: { threat: ['fire'] },
  coas: [{ id: 'c', label: 'A', components: { measure: ['evacuate'], comms: ['radio'] } }],
};

test('coaComparisonRows: COAs as columns, rows grouped by decision category', () => {
  const { coas, groups } = coaComparisonRows(box, flood);
  assert.deepEqual(
    coas.map((c) => [c.id, c.label, c.active, c.conflicts]),
    [
      ['a', 'A', false, 0],
      ['b', 'B', true, 1],
    ],
  );
  assert.deepEqual(
    groups.map((g) => [g.id, g.label, g.rows.map((r) => r.id)]),
    [
      ['dec', 'Measures', ['measure', 'comms']],
      ['dec2', 'Organisation', ['lead']],
    ],
  );
  const measure = groups[0].rows[0];
  assert.equal(measure.label, 'Measure');
  assert.equal(measure.same, false);
  assert.deepEqual(measure.cells[0], { values: [{ id: 'evacuate', label: 'Evacuate', conflict: false }], conflict: false });
  assert.equal(measure.cells[1].conflict, true);
  assert.deepEqual(
    measure.cells[1].values.map((v) => [v.label, v.conflict, v.causes]),
    [
      ['Use water', true, 'Flood'],
      ['Evacuate', false, undefined],
    ],
  );
  assert.equal(groups[0].rows[1].same, true);
  assert.equal(groups[1].rows[0].same, true);
});

test('coaComparisonRows: differences only hides equal rows and empty groups', () => {
  const { groups } = coaComparisonRows(box, flood, { differencesOnly: true });
  assert.deepEqual(
    groups.map((g) => [g.id, g.rows.map((r) => r.id)]),
    [['dec', ['measure']]],
  );
  const sameOrder = {
    ...flood,
    coas: [
      { id: 'a', label: 'A', components: { measure: ['water', 'evacuate'] } },
      { id: 'b', label: 'B', components: { measure: ['evacuate', 'water'], lead: [] } },
    ],
  };
  assert.deepEqual(coaComparisonRows(box, sameOrder, { differencesOnly: true }).groups, []);
});

test('coaComparisonRows: no COAs or no decision categories', () => {
  assert.deepEqual(coaComparisonRows(box, { components: { threat: ['fire'] } }), { coas: [], groups: [] });
  assert.deepEqual(coaComparisonRows(box, undefined), { coas: [], groups: [] });
  const noDecisions = { ...box, categories: [box.categories[0]] };
  const result = coaComparisonRows(noDecisions, flood);
  assert.equal(result.coas.length, 2);
  assert.deepEqual(result.groups, []);
});

test('comparisonNarrativeId: selected, else current if included, else first', () => {
  const narratives = [{ id: 'n1' }, { id: 'n2' }];
  assert.equal(comparisonNarrativeId(narratives, 'n2', 'n1'), 'n1');
  assert.equal(comparisonNarrativeId(narratives, 'n2', 'gone'), 'n2');
  assert.equal(comparisonNarrativeId(narratives, 'n2'), 'n2');
  assert.equal(comparisonNarrativeId(narratives, 'other'), 'n1');
  assert.equal(comparisonNarrativeId([], 'n1'), undefined);
});

test('comparedNarratives: included ones plus the current saved one, sorted by label', () => {
  const narratives = [
    { id: 'n1', label: 'Beta', included: true, saved: true },
    { id: 'n2', label: 'Alpha', saved: true },
    { id: 'n3', label: 'Gamma', included: false, saved: true },
  ];
  assert.deepEqual(comparedNarratives(narratives).map((n) => n.id), ['n1']);
  assert.deepEqual(comparedNarratives(narratives, 'n2').map((n) => n.id), ['n2', 'n1']);
  assert.deepEqual(comparedNarratives(narratives, 'n1').map((n) => n.id), ['n1']);
  assert.deepEqual(comparedNarratives(narratives, 'unsaved').map((n) => n.id), ['n1']);
  assert.deepEqual(comparedNarratives([]), []);
});

test('selectedNarratives: only scenarios selected for analysis, sorted by label', () => {
  const narratives = [
    { id: 'n1', label: 'Beta', included: true },
    { id: 'n2', label: 'Alpha' },
    { id: 'n3', label: 'Aardvark', included: true },
  ];
  assert.deepEqual(selectedNarratives(narratives).map((n) => n.id), ['n3', 'n1']);
});

test('robustnessGrid: chosen, excluded and unused per narrative using the active COA', () => {
  const { narratives, groups, robustCount } = robustnessGrid(box, [flood, fire]);
  assert.deepEqual(
    narratives.map((n) => [n.id, n.label, n.coaLabel]),
    [
      ['n1', 'Flood', 'B'],
      ['n2', 'Fire', 'A'],
    ],
  );
  assert.deepEqual(groups.map((g) => [g.id, g.components.map((c) => c.id)]), [
    ['dec', ['measure', 'comms']],
    ['dec2', ['lead']],
  ]);
  const [evacuate, water] = groups[0].components[0].rows;
  assert.deepEqual(
    evacuate.cells.map((c) => c.status),
    ['chosen', 'chosen'],
  );
  assert.equal(evacuate.chosenCount, 2);
  assert.equal(evacuate.robust, true);
  assert.equal(evacuate.scenarioSpecific, false);
  // Chosen although excluded by the situation: chosen, flagged as conflict
  assert.deepEqual(water.cells[0], { status: 'chosen', conflict: true, causes: 'Flood' });
  assert.deepEqual(water.cells[1], { status: 'unused' });
  assert.equal(water.scenarioSpecific, true);
  assert.equal(water.robust, false);
  const [sms, radio] = groups[0].components[1].rows;
  assert.deepEqual(sms.cells.map((c) => c.status), ['chosen', 'unused']);
  assert.equal(radio.scenarioSpecific, true);
  const police = groups[1].components[0].rows[0];
  assert.deepEqual(police.cells.map((c) => c.status), ['unused', 'unused']);
  assert.equal(police.chosenCount, 0);
  assert.equal(police.scenarioSpecific, false);
  assert.equal(robustCount, 1);
});

test('robustnessGrid: excluded when impossible and not chosen', () => {
  const noWater = { ...flood, coas: [{ id: 'a', label: 'A', components: { measure: ['evacuate'] } }], activeCoaId: 'a' };
  const water = robustnessGrid(box, [noWater]).groups[0].components[0].rows[1];
  assert.deepEqual(water.cells[0], { status: 'excluded', causes: 'Flood' });
  const evacuate = robustnessGrid(box, [noWater]).groups[0].components[0].rows[0];
  // A single scenario: chosen everywhere is robust, never scenario-specific
  assert.equal(evacuate.robust, true);
  assert.equal(evacuate.scenarioSpecific, false);
});

test('robustnessGrid: narratives without COAs and empty input', () => {
  const unmigrated = { id: 'n3', label: 'Old', components: { threat: ['fire'], comms: ['radio'] } };
  const grid = robustnessGrid(box, [unmigrated]);
  assert.equal(grid.narratives[0].coaLabel, undefined);
  assert.equal(grid.groups[0].components[1].rows[1].cells[0].status, 'chosen');
  const empty = robustnessGrid(box, []);
  assert.equal(empty.narratives.length, 0);
  assert.equal(empty.groups[0].components[0].rows[0].robust, false);
});

test('coaTitle prefixes short labels only', () => {
  assert.equal(coaTitle('A', 'Course of action'), 'Course of action A');
  assert.equal(coaTitle('B12', 'Course of action'), 'Course of action B12');
  assert.equal(coaTitle('Evacuate', 'Course of action'), 'Evacuate');
  assert.equal(coaTitle('  ', 'Course of action'), 'Course of action');
  assert.equal(coaTitle(undefined, 'Course of action'), 'Course of action');
});
