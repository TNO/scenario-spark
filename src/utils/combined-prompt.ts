/**
 * One prompt that asks an AI service for the narrative, decision reflections and persona
 * feedback at once, returned as a single JSON object that can be pasted back into Spark.
 */

export type CombinedPromptKey =
  | 'LLM_COMBINED_INTRO'
  | 'LLM_COMBINED_TASK_NARRATIVE'
  | 'LLM_COMBINED_CURRENT_NARRATIVE'
  | 'LLM_COMBINED_TASK_DECISIONS'
  | 'LLM_COMBINED_TASK_PERSONAS'
  | 'LLM_COMBINED_OUTPUT';

export type CombinedPromptOptions = {
  narrative: {
    /** Instructions of the narrative prompt */
    instructions: string;
    /** Selected factors of the narrative */
    input: string;
    /** Existing narrative text, to improve rather than replace blindly */
    currentText?: string;
  };
  decisions?: {
    instructions: string;
    coas: Array<{ id: string; label: string; input: string }>;
  };
  personas?: {
    instructions: string;
    list: Array<{ id: string; label: string; desc?: string }>;
  };
  tr: (key: CombinedPromptKey, params?: Record<string, string>) => string;
};

export const buildCombinedPrompt = ({ narrative, decisions, personas, tr }: CombinedPromptOptions) => {
  const coas = decisions?.coas.length ? decisions : undefined;
  const people = personas?.list.length ? personas : undefined;
  const template: Record<string, unknown> = { title: '…', narrative: '…' };
  if (coas) {
    template.decisions = coas.coas.map((c) => ({ id: c.id, name: c.label, reflection: '…' }));
  }
  if (people) {
    template.personas = people.list.map((p) => ({ id: p.id, name: p.label, feedback: '…' }));
  }
  const sections = [
    tr('LLM_COMBINED_INTRO'),
    `## ${tr('LLM_COMBINED_TASK_NARRATIVE')}`,
    narrative.instructions.trim(),
    narrative.input.trim(),
    narrative.currentText?.trim() &&
      tr('LLM_COMBINED_CURRENT_NARRATIVE', { narrative: narrative.currentText.trim() }),
    coas && `## ${tr('LLM_COMBINED_TASK_DECISIONS')}`,
    coas?.instructions.trim(),
    ...(coas?.coas.map((c) => `### ${c.label} (id: ${c.id})\n${c.input.trim()}`) || []),
    people && `## ${tr('LLM_COMBINED_TASK_PERSONAS')}`,
    people?.instructions.trim(),
    people?.list.map((p) => `- ${p.label} (id: ${p.id})${p.desc ? `: ${p.desc}` : ''}`).join('\n'),
    `## ${tr('LLM_COMBINED_OUTPUT')}`,
    '```json\n' + JSON.stringify(template, null, 2) + '\n```',
  ];
  return sections.filter(Boolean).join('\n\n');
};

export type CombinedResult = {
  title?: string;
  narrative?: string;
  decisions: Array<{ id: string; reflection: string }>;
  personas: Array<{ id: string; feedback: string }>;
  /** Names or ids in the response that do not match a course of action or persona */
  unmatched: string[];
};

/** The JSON text in a response: the first ```json block, or the outermost braces. */
const extractJson = (text: string) => {
  const fenced = text.match(/```(?:json)?\s*\n([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  return start >= 0 && end > start ? body.slice(start, end + 1) : '';
};

/** Fixes common LLM JSON slips: smart quotes, raw line breaks in strings and trailing commas. */
export const repairJson = (json: string) => {
  let out = '';
  let inString = false;
  for (let i = 0; i < json.length; i++) {
    let ch = json[i];
    if (!inString && (ch === '“' || ch === '”')) ch = '"';
    if (inString) {
      if (ch === '\\') {
        out += ch + (json[++i] ?? '');
        continue;
      }
      // A smart quote only closes a string when JSON syntax follows
      if (ch === '”' && /^\s*[:,}\]]/.test(json.slice(i + 1, i + 20))) ch = '"';
      if (ch === '"') inString = false;
      else if (ch === '\n') ch = '\\n';
      else if (ch === '\r') ch = '';
      else if (ch === '\t') ch = '\\t';
    } else if (ch === '"') {
      inString = true;
    } else if (ch === ',') {
      const rest = json.slice(i + 1).match(/^\s*([}\]])/);
      if (rest) continue;
    }
    out += ch;
  }
  return out;
};

const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const pick = (obj: Record<string, unknown>, ...keys: string[]) => {
  for (const key of keys) {
    const value = text(obj[key]);
    if (value) return value;
  }
  return '';
};
const norm = (s: string) => s.trim().toLowerCase();

type Target = { id: string; label: string };

/** Matches by id first, then by (case-insensitive) name. */
const matchTarget = (entry: Record<string, unknown>, targets: Target[]) => {
  const id = text(entry.id);
  const name = pick(entry, 'name', 'label', 'persona', 'coa');
  return (
    targets.find((t) => t.id === id) ||
    targets.find((t) => norm(t.label) === norm(name || id))
  );
};

/** Entries as an array; also accepts an object keyed by id or name. */
const entries = (value: unknown, field: string): Array<Record<string, unknown>> => {
  if (Array.isArray(value)) return value.filter((v) => v && typeof v === 'object');
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).map(([key, v]) =>
      v && typeof v === 'object' ? { id: key, ...(v as object) } : { id: key, [field]: v },
    );
  }
  return [];
};

/**
 * Parses a pasted AI response. Throws when no JSON object can be read.
 * Courses of action and personas are matched by id, or else by name.
 */
export const parseCombinedResponse = (
  response: string,
  coas: Target[] = [],
  personas: Target[] = [],
): CombinedResult => {
  const json = extractJson(response);
  if (!json) throw new Error('No JSON object found');
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    data = JSON.parse(repairJson(json));
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('No JSON object found');
  const obj = data as Record<string, unknown>;
  const unmatched: string[] = [];
  const collect = <K extends string>(value: unknown, targets: Target[], field: K, aliases: string[]) => {
    const result: Array<{ id: string } & Record<K, string>> = [];
    for (const entry of entries(value, field)) {
      const content = pick(entry, field, ...aliases);
      if (!content) continue;
      const target = matchTarget(entry, targets);
      if (!target) {
        unmatched.push(pick(entry, 'name', 'label', 'id') || '?');
        continue;
      }
      if (result.some((r) => r.id === target.id)) continue;
      result.push({ id: target.id, [field]: content } as { id: string } & Record<K, string>);
    }
    return result;
  };
  return {
    title: pick(obj, 'title', 'label', 'name') || undefined,
    narrative: pick(obj, 'narrative', 'story', 'scenario', 'description') || undefined,
    decisions: collect(obj.decisions ?? obj.coas ?? obj.coursesOfAction, coas, 'reflection', [
      'assessment',
      'remarks',
      'text',
    ]),
    personas: collect(obj.personas, personas, 'feedback', ['story', 'impression', 'text']),
    unmatched,
  };
};
