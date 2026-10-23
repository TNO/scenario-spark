import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { buildCombinedPrompt, parseCombinedResponse, repairJson } from '../src/utils/combined-prompt.ts';

const tr = (key, params) => (params ? `<${key}:${Object.values(params).join('|')}>` : `<${key}>`);
const coas = [{ id: 'c1', label: 'COA A' }, { id: 'c2', label: 'COA B' }];
const personas = [{ id: 'p1', label: 'Mayor' }, { id: 'p2', label: 'Resident' }];

test('builds one prompt with all tasks and a JSON template carrying the ids', () => {
  const prompt = buildCombinedPrompt({
    narrative: { instructions: 'Write a story.', input: '- Place: Station', currentText: 'Old story' },
    decisions: { instructions: 'Assess.', coas: [{ id: 'c1', label: 'COA A', input: 'Evacuate' }] },
    personas: { instructions: 'Give feedback.', list: [{ id: 'p1', label: 'Mayor', desc: 'Leads' }] },
    tr,
  });
  for (const part of ['<LLM_COMBINED_INTRO>', 'Write a story.', '- Place: Station', '<LLM_COMBINED_CURRENT_NARRATIVE:Old story>',
    'Assess.', '### COA A (id: c1)', 'Evacuate', 'Give feedback.', '- Mayor (id: p1): Leads', '```json']) {
    assert.ok(prompt.includes(part), part);
  }
  const json = JSON.parse(prompt.match(/```json\n([\s\S]*)\n```/)[1]);
  assert.deepEqual(Object.keys(json), ['title', 'narrative', 'decisions', 'personas']);
  assert.deepEqual(json.decisions[0], { id: 'c1', name: 'COA A', reflection: '…' });
  assert.deepEqual(json.personas[0], { id: 'p1', name: 'Mayor', feedback: '…' });
});

test('omits empty decision and persona tasks', () => {
  const prompt = buildCombinedPrompt({
    narrative: { instructions: 'Write.', input: 'x' },
    decisions: { instructions: 'Assess.', coas: [] },
    personas: { instructions: 'Feedback.', list: [] },
    tr,
  });
  assert.ok(!prompt.includes('<LLM_COMBINED_TASK_DECISIONS>'));
  assert.ok(!prompt.includes('<LLM_COMBINED_TASK_PERSONAS>'));
  assert.ok(!prompt.includes('<LLM_COMBINED_CURRENT_NARRATIVE'));
  assert.deepEqual(Object.keys(JSON.parse(prompt.match(/```json\n([\s\S]*)\n```/)[1])), ['title', 'narrative']);
});

test('parses a fenced response surrounded by chat text and matches ids and names', () => {
  const response = `Here you go!\n\n\`\`\`json\n${JSON.stringify({
    title: 'Flood',
    narrative: '## Start\nWater rises.',
    decisions: [{ id: 'c1', reflection: 'Good' }, { name: 'coa b', reflection: 'Weak' }, { id: 'zz', name: 'COA Z', reflection: 'x' }],
    personas: [{ id: 'p2', feedback: 'Scared' }, { name: 'MAYOR', feedback: 'Busy' }],
  })}\n\`\`\`\nAnything else?`;
  const result = parseCombinedResponse(response, coas, personas);
  assert.equal(result.title, 'Flood');
  assert.equal(result.narrative, '## Start\nWater rises.');
  assert.deepEqual(result.decisions, [{ id: 'c1', reflection: 'Good' }, { id: 'c2', reflection: 'Weak' }]);
  assert.deepEqual(result.personas, [{ id: 'p2', feedback: 'Scared' }, { id: 'p1', feedback: 'Busy' }]);
  assert.deepEqual(result.unmatched, ['COA Z']);
});

test('repairs raw line breaks, smart quotes and trailing commas', () => {
  const response = '{\n  “title”: "A",\n  "narrative": "Line 1\nLine 2",\n  "personas": [{"id": "p1", "feedback": "Ok",},],\n}';
  const result = parseCombinedResponse(response, coas, personas);
  assert.equal(result.title, 'A');
  assert.equal(result.narrative, 'Line 1\nLine 2');
  assert.deepEqual(result.personas, [{ id: 'p1', feedback: 'Ok' }]);
  assert.equal(repairJson('{"a": "x, }"}'), '{"a": "x, }"}');
});

test('accepts objects keyed by id or name and field aliases', () => {
  const result = parseCombinedResponse(
    JSON.stringify({ story: 'S', decisions: { c2: { assessment: 'Fine' } }, personas: { Resident: 'Calm' } }),
    coas,
    personas,
  );
  assert.equal(result.narrative, 'S');
  assert.equal(result.title, undefined);
  assert.deepEqual(result.decisions, [{ id: 'c2', reflection: 'Fine' }]);
  assert.deepEqual(result.personas, [{ id: 'p2', feedback: 'Calm' }]);
});

test('throws when no JSON object is found', () => {
  assert.throws(() => parseCombinedResponse('Sorry, I cannot help.'));
  assert.throws(() => parseCombinedResponse('{ not json at all'));
});

test('all locales define the combined prompt keys', () => {
  const keys = ['COMBINED_HINT_API', 'COMBINED_GENERATE', 'COMBINED_GENERATE_ERROR', 'LLM_FIELD_PROMPTS', 'LLM_FIELD_PROMPTS_DESC',
    'AI_NARRATIVE', 'COPY_NARRATIVE_PROMPT', 'NARRATIVE_PASTE_HINT', 'NARRATIVE_PROMPT_COPIED',
    'NARRATIVE_GENERATE_ERROR', 'LLM_COMBINED_INTRO', 'LLM_COMBINED_TASK_NARRATIVE', 'LLM_COMBINED_CURRENT_NARRATIVE', 'LLM_COMBINED_TASK_DECISIONS',
    'LLM_COMBINED_TASK_PERSONAS', 'LLM_COMBINED_OUTPUT', 'COMBINED_PROMPT'];
  for (const lang of ['en', 'nl', 'de', 'fr', 'es', 'pl']) {
    const source = readFileSync(new URL(`../src/services/translations/${lang}.ts`, import.meta.url), 'utf8');
    for (const key of keys) assert.match(source, new RegExp(`^\\s+${key}: `, 'm'), `${lang}: ${key}`);
  }
});
