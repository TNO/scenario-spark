import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  addDecisionLogEntry,
  decisionLogRows,
  formatLogTimestamp,
  removeDecisionLogEntry,
  sortDecisionLog,
  updateDecisionLogEntry,
} from '../src/utils/decision.ts';

const makeBox = () => ({
  narratives: [
    {
      id: 'n1',
      label: 'Flood',
      components: {},
      coas: [
        { id: 'a', label: 'A', components: {} },
        { id: 'b', label: 'B', components: {} },
      ],
    },
    { id: 'n2', label: 'Storm', components: {} },
  ],
});

let counter = 0;
const makeId = () => `e${++counter}`;

test('addDecisionLogEntry creates the log, stores labels and a timestamp', () => {
  const box = makeBox();
  const entry = addDecisionLogEntry(
    box,
    { narrativeId: 'n1', coaId: 'b', decision: 'Go with B', rationale: 'Faster', author: 'Erik' },
    { now: 1000, makeId },
  );
  assert.ok(entry);
  assert.deepEqual(box.decisionLog, [entry]);
  assert.equal(entry.timestamp, 1000);
  assert.equal(entry.narrativeLabel, 'Flood');
  assert.equal(entry.coaLabel, 'B');
  assert.equal(entry.decision, 'Go with B');
  assert.equal(entry.rationale, 'Faster');
  assert.equal(entry.author, 'Erik');
});

test('addDecisionLogEntry ignores blank decisions, unknown references and blank optional text', () => {
  const box = makeBox();
  assert.equal(addDecisionLogEntry(box, { decision: '   ' }, { now: 1, makeId }), undefined);
  assert.equal(box.decisionLog, undefined);
  const entry = addDecisionLogEntry(
    box,
    { narrativeId: 'missing', coaId: 'a', decision: 'General decision', rationale: '  ', author: '' },
    { now: 2, makeId },
  );
  assert.equal(entry.narrativeId, undefined);
  assert.equal(entry.coaId, undefined);
  assert.equal('rationale' in entry, false);
  assert.equal('author' in entry, false);
  // A COA that is not part of the narrative is dropped, the narrative is kept
  const other = addDecisionLogEntry(box, { narrativeId: 'n2', coaId: 'a', decision: 'x' }, { now: 3, makeId });
  assert.equal(other.narrativeId, 'n2');
  assert.equal(other.coaId, undefined);
});

test('updateDecisionLogEntry edits text, keeps the timestamp and stored labels of removed references', () => {
  const box = makeBox();
  const entry = addDecisionLogEntry(box, { narrativeId: 'n1', coaId: 'a', decision: 'Old' }, { now: 10, makeId });
  box.narratives = box.narratives.filter((n) => n.id !== 'n1');
  const updated = updateDecisionLogEntry(
    box,
    entry.id,
    { narrativeId: 'n1', coaId: 'a', decision: 'New', rationale: 'Because' },
    { now: 20 },
  );
  assert.equal(updated, entry);
  assert.equal(entry.decision, 'New');
  assert.equal(entry.rationale, 'Because');
  assert.equal(entry.timestamp, 10);
  assert.equal(entry.edited, 20);
  assert.equal(entry.narrativeId, 'n1');
  assert.equal(entry.narrativeLabel, 'Flood');
  assert.equal(entry.coaLabel, 'A');
  // Clearing the rationale removes it; blank decisions are refused
  updateDecisionLogEntry(box, entry.id, { narrativeId: 'n1', coaId: 'a', decision: 'New', rationale: '' }, { now: 30 });
  assert.equal('rationale' in entry, false);
  assert.equal(updateDecisionLogEntry(box, entry.id, { decision: ' ' }, { now: 40 }), undefined);
  assert.equal(entry.decision, 'New');
  assert.equal(updateDecisionLogEntry(box, 'unknown', { decision: 'x' }), undefined);
});

test('updateDecisionLogEntry can point an entry to another scenario and COA', () => {
  const box = makeBox();
  const entry = addDecisionLogEntry(box, { narrativeId: 'n1', coaId: 'a', decision: 'D' }, { now: 1, makeId });
  updateDecisionLogEntry(box, entry.id, { narrativeId: 'n2', decision: 'D' }, { now: 2 });
  assert.equal(entry.narrativeId, 'n2');
  assert.equal(entry.narrativeLabel, 'Storm');
  assert.equal('coaId' in entry, false);
  assert.equal('coaLabel' in entry, false);
});

test('removeDecisionLogEntry removes only the given entry', () => {
  const box = makeBox();
  const a = addDecisionLogEntry(box, { decision: 'a' }, { now: 1, makeId });
  const b = addDecisionLogEntry(box, { decision: 'b' }, { now: 2, makeId });
  assert.equal(removeDecisionLogEntry(box, a.id), true);
  assert.deepEqual(box.decisionLog, [b]);
  assert.equal(removeDecisionLogEntry(box, 'unknown'), false);
});

test('sortDecisionLog lists newest first without changing the stored order', () => {
  const log = [
    { id: '1', timestamp: 5, decision: 'a' },
    { id: '2', timestamp: 9, decision: 'b' },
    { id: '3', timestamp: 5, decision: 'c' },
  ];
  assert.deepEqual(sortDecisionLog(log).map((e) => e.id), ['2', '3', '1']);
  assert.deepEqual(log.map((e) => e.id), ['1', '2', '3']);
  assert.deepEqual(sortDecisionLog(undefined), []);
});

test('decisionLogRows resolves current labels and marks removed scenarios and COAs', () => {
  const box = makeBox();
  addDecisionLogEntry(box, { narrativeId: 'n1', coaId: 'a', decision: 'first' }, { now: 1, makeId });
  addDecisionLogEntry(box, { narrativeId: 'n1', coaId: 'b', decision: 'second' }, { now: 2, makeId });
  addDecisionLogEntry(box, { narrativeId: 'n2', decision: 'third' }, { now: 3, makeId });
  addDecisionLogEntry(box, { decision: 'general' }, { now: 4, makeId });
  box.narratives[0].label = 'Flood (renamed)';
  box.narratives[0].coas = box.narratives[0].coas.filter((c) => c.id !== 'b');
  box.narratives = box.narratives.filter((n) => n.id !== 'n2');
  const rows = decisionLogRows(box);
  assert.deepEqual(
    rows.map((r) => [r.entry.decision, r.narrativeLabel, r.narrativeRemoved, r.coaLabel, r.coaRemoved]),
    [
      ['general', undefined, false, undefined, false],
      ['third', 'Storm', true, undefined, false],
      ['second', 'Flood (renamed)', false, 'B', true],
      ['first', 'Flood (renamed)', false, 'A', false],
    ],
  );
  // Stored labels are untouched
  assert.equal(box.decisionLog[0].narrativeLabel, 'Flood');
});

test('formatLogTimestamp is locale aware', () => {
  const ts = Date.UTC(2026, 9, 14, 12, 30);
  const nl = formatLogTimestamp(ts, 'nl');
  const en = formatLogTimestamp(ts, 'en');
  assert.match(nl, /2026/);
  assert.match(en, /2026/);
  assert.notEqual(nl, en);
  assert.equal(formatLogTimestamp(ts, 'not a locale!'), formatLogTimestamp(ts, 'en'));
});
