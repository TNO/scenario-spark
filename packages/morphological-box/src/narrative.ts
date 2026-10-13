import { getBoxComponents } from './generate.ts';
import type { Component, ID, MorphologicalBox, Selection } from './types.ts';

/** Languages that the Scenario Spark user interface supports. */
export const SCENARIO_SPARK_LANGUAGES = ['en', 'nl', 'fr', 'de', 'es', 'pl'] as const;

export type LlmPromptType = 'narrative' | 'effect' | 'persona' | 'communications';

export const LLM_PROMPT_TYPES: readonly LlmPromptType[] = ['narrative', 'effect', 'persona', 'communications'];

/** Instruction sent to an LLM, followed by "component: value" lines of the selected categories. */
export type LlmPrompt = { type: LlmPromptType; prompt: string; categories: ID[] };

export type LlmConfig = {
  /** Provider: 'clipboard' (copy the prompt), 'ollama' or 'openai' */
  id: string;
  url: string;
  model?: string;
  apiKey?: string;
  temperature?: number;
  autoLLMCount?: number;
  prompts: LlmPrompt[];
};

/** Optional Scenario Spark fields that describe how scenarios are written out. */
export type NarrativeSettings = {
  /** ISO 639-1 language code of the labels, template and prompts */
  language?: string;
  /** Narrative template; `{n}` is the n-th entry of `components` (1-based), `{id}` a component id */
  template?: string;
  llm?: LlmConfig;
};

/** English name of a language code, e.g. 'nl' -> 'Dutch'. */
export const languageName = (code: string) => {
  try {
    return new Intl.DisplayNames(['en'], { type: 'language' }).of(code) || code;
  } catch {
    return code;
  }
};

const PLACEHOLDER = /\{([^{}]+)\}/g;

export type TemplatePlaceholder = {
  /** Placeholder text without braces */
  token: string;
  component?: Component;
  /** Reason the placeholder cannot be resolved */
  problem?: string;
};

/** Resolve every placeholder in a template to its component. */
export const parseTemplate = (box: MorphologicalBox, template: string): TemplatePlaceholder[] => {
  const categorized = new Set(getBoxComponents(box).map((c) => c.id));
  return [...template.matchAll(PLACEHOLDER)].map(([, token]) => {
    const component = /^\d+$/.test(token)
      ? box.components[Number(token) - 1]
      : box.components.find((c) => c.id === token);
    if (!component) {
      return {
        token,
        problem: /^\d+$/.test(token)
          ? `{${token}} is out of range: use 1..${box.components.length}.`
          : `{${token}} is not a component id.`,
      };
    }
    return categorized.has(component.id)
      ? { token, component }
      : { token, component, problem: `{${token}} refers to "${component.id}", which is in no category and never gets a value.` };
  });
};

/**
 * Prompt that asks an LLM to write a narrative template for the box. Number
 * placeholders follow the order of `box.components`.
 */
export const createTemplatePrompt = (box: MorphologicalBox & NarrativeSettings, language = box.language || 'en') => {
  const lines: string[] = [
    'Please generate a template string for scenario narratives.',
    'Use {n} placeholders (where n is the number shown next to each key driver below) to reference key driver values.',
    'Write one paragraph per category. The text should flow naturally and professionally.',
    'Return only the template string, no explanation.',
    `The template should be written in ${languageName(language)}.`,
    '',
    'Morphological box structure:',
    '',
  ];
  for (const cat of box.categories) {
    lines.push(`## ${cat.label}`);
    if (cat.desc) lines.push(cat.desc);
    lines.push('');
    for (const cid of cat.componentIds || []) {
      const idx = box.components.findIndex((c) => c.id === cid);
      if (idx < 0) continue;
      const comp = box.components[idx];
      lines.push(`${idx + 1}. ${comp.label}${comp.desc ? ': ' + comp.desc : ''}`);
      for (const v of comp.values || []) lines.push(`   - ${v.label}`);
    }
    lines.push('');
  }
  return lines.join('\n');
};

/** Set the narrative template; throws when a placeholder cannot be resolved. */
export const setTemplate = <B extends MorphologicalBox>(box: B, template: string): B & NarrativeSettings => {
  if (typeof template !== 'string' || !template.trim()) throw new Error('The template is empty.');
  const problems = parseTemplate(box, template).filter((p) => p.problem);
  if (problems.length > 0) throw new Error(problems.map((p) => p.problem).join('\n'));
  return { ...box, template: template.trim() };
};

/**
 * Keep `{n}` placeholders pointing at the same components after the component
 * order changed. Placeholders of removed components become `{oldId}`, which
 * validation reports.
 */
export const remapTemplate = (template: string, before: Component[], after: Component[]) =>
  template.replace(PLACEHOLDER, (match, token: string) => {
    if (!/^\d+$/.test(token)) return match;
    const old = before[Number(token) - 1];
    if (!old) return match;
    const idx = after.findIndex((c) => c.id === old.id);
    return idx < 0 ? `{${old.id}}` : `{${idx + 1}}`;
  });

/** Fill a template with the labels of the selected values. */
export const renderTemplate = (
  box: MorphologicalBox,
  template: string,
  selection: Selection,
  joinValues = (labels: string[]) => labels.join(', '),
) =>
  template.replace(PLACEHOLDER, (match, token: string) => {
    const comp = /^\d+$/.test(token) ? box.components[Number(token) - 1] : box.components.find((c) => c.id === token);
    if (!comp) return match;
    const ids = selection[comp.id] || [];
    return joinValues((comp.values || []).filter((v) => ids.includes(v.id)).map((v) => v.label));
  });

export type LlmPromptInput = { type?: LlmPromptType; prompt: string; categories?: ID[] };

/**
 * Add or replace the LLM prompt of the given type (default 'narrative'). Creates
 * a clipboard LLM configuration when missing. Categories default to all.
 */
export const setLlmPrompt = <B extends MorphologicalBox & NarrativeSettings>(box: B, input: LlmPromptInput): B => {
  const type = input.type || 'narrative';
  if (!LLM_PROMPT_TYPES.includes(type)) throw new Error(`Prompt type must be one of: ${LLM_PROMPT_TYPES.join(', ')}.`);
  if (typeof input.prompt !== 'string' || !input.prompt.trim()) throw new Error('The prompt is empty.');
  const known = new Set(box.categories.map((c) => c.id));
  const categories = input.categories?.length ? input.categories : [...known];
  const unknown = categories.filter((id) => !known.has(id));
  if (unknown.length > 0) throw new Error(`Unknown category id(s): ${unknown.join(', ')}.`);
  const llm: LlmConfig = box.llm
    ? { ...box.llm, prompts: [...(box.llm.prompts || [])] }
    : { id: 'clipboard', url: '', model: 'gemma3', temperature: 0.7, prompts: [] };
  const prompt: LlmPrompt = { type, prompt: input.prompt.trim(), categories };
  const index = llm.prompts.findIndex((p) => p.type === type);
  if (index >= 0) llm.prompts[index] = prompt;
  else llm.prompts.push(prompt);
  return { ...box, llm };
};
