import { activeCoa, effectiveSelection, nextCoaLabel, type CoaInput, type CoaNarrative } from './coa.ts';
import { getBoxComponents, getDecisionComponentIds } from './generate.ts';
import type { Component, ID, MorphologicalBox, Selection } from './types.ts';

/** Languages that the Scenario Spark user interface supports. */
export const SCENARIO_SPARK_LANGUAGES = ['en', 'nl', 'fr', 'de', 'es', 'pl'] as const;

/**
 * Prompt types of Scenario Spark. `decision` reflects on one course of action
 * (the decisions of a decision category) for a given situation.
 */
export type LlmPromptType = 'narrative' | 'effect' | 'persona' | 'communications' | 'decision';

export const LLM_PROMPT_TYPES: readonly LlmPromptType[] = ['narrative', 'effect', 'persona', 'communications', 'decision'];

/**
 * Instruction sent to an LLM, followed by "component: value" lines of the
 * selected categories (see `createLlmInput`). For `decision` prompts the
 * categories only filter the situation; the decisions are always listed.
 */
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

/** Section headings of the LLM input; defaults are the English texts of Scenario Spark. */
export type LlmInputLabels = {
  /** Narrative/persona prompts: heading of the situation values */
  situation: string;
  /** Narrative/persona prompts: heading of the selected decision values */
  suggestedActions: string;
  /** Narrative/persona prompts: line used when no decision values are selected */
  noMeasures: string;
  /** Decision prompt: heading of the situation values */
  decisionSituation: string;
  /** Decision prompt: narrative text section; `{narrative}` is the text */
  scenarioText: string;
  /** Decision prompt: heading of the decisions; `{coa}` is the COA label */
  coaDecisions: string;
  /** Decision prompt: line used when the COA has no decisions; `{coa}` is the COA label */
  coaNoDecisions: string;
  /** Decision prompt: heading of the other COAs (labels only) */
  otherCoas: string;
};

export const DEFAULT_LLM_INPUT_LABELS: LlmInputLabels = {
  situation: 'Situation (use these elements to describe the incident):',
  suggestedActions: 'Suggested actions (measures to describe and assess):',
  noMeasures: 'No measures were selected: describe only the incident and do not invent measures or a solution.',
  decisionSituation: 'Situation (the incident the decisions respond to):',
  scenarioText: 'Scenario narrative:\n{narrative}',
  coaDecisions: 'Course of action {coa}: decisions to assess:',
  coaNoDecisions: 'Course of action {coa} has no decisions selected yet: point out which decisions are needed.',
  otherCoas: 'Other courses of action considered (for contrast only; do not assess them):',
};

export type LlmInputOptions = {
  /** Prompt type, default 'narrative' */
  type?: LlmPromptType;
  /** Situation in `components`, decisions in `coas` (or, without COAs, also in `components`) */
  narrative: CoaNarrative;
  /** COA to use; default the active COA, else the first */
  coaId?: ID;
  /** Included category IDs; default the categories of the box prompt of this type, else all */
  categories?: ID[];
  /** Current narrative text (decision prompt) */
  narrativeText?: string;
  /**
   * Whether decision values are used (narrative/persona/effect/communications
   * prompts). Default: true when the box has decision categories. Scenario
   * Spark also requires its decision-support setting.
   */
  decisionSupport?: boolean;
  /** Translated section headings */
  labels?: Partial<LlmInputLabels>;
};

const fill = (text: string, params: Record<string, string>) =>
  text.replace(/\{(\w+)\}/g, (match, key: string) => (key in params ? params[key] : match));

/**
 * One line per component with selected values: `- Label (desc): value (desc), value`.
 * Components without (known) selected values are skipped.
 */
export const renderFactorLines = (components: Component[], selection: Selection) =>
  components
    .map((c) => {
      const values = (selection[c.id] || [])
        .map((id) => c.values?.find((v) => v.id === id))
        .filter((v) => v !== undefined)
        .map((v) => `${v.label}${v.desc ? ` (${v.desc})` : ''}`);
      return values.length ? `- ${c.label}${c.desc ? ` (${c.desc})` : ''}: ${values.join(', ')}` : '';
    })
    .filter(Boolean)
    .join('\n');

/**
 * The selected factors of a narrative as LLM input, as Scenario Spark builds it.
 * - Narrative and persona prompts of a box with decision categories get a
 *   situation section and a suggested-actions section (all selected values per
 *   factor); without decisions, a line says that no measures were selected, so
 *   the LLM does not invent them.
 * - Decision prompts get the situation, the narrative text, the decisions of
 *   one course of action and the labels of the other COAs.
 * - Other prompt types, and boxes without decision categories, get a plain list.
 */
export const createLlmInput = (box: MorphologicalBox & NarrativeSettings, options: LlmInputOptions) => {
  const { type = 'narrative', narrative, coaId, narrativeText } = options;
  const labels = { ...DEFAULT_LLM_INPUT_LABELS, ...options.labels };
  const promptCategories = box.llm?.prompts?.find((p) => p.type === type)?.categories;
  const categoryIds = options.categories || (promptCategories?.length ? promptCategories : box.categories.map((c) => c.id));
  const included = new Set(box.categories.filter((c) => categoryIds.includes(c.id)).flatMap((c) => c.componentIds || []));
  const decisionIds = getDecisionComponentIds(box);
  const components = getBoxComponents(box);
  const situation = components.filter((c) => !decisionIds.has(c.id));
  const decisions = components.filter((c) => decisionIds.has(c.id));
  const isIncluded = (c: Component) => included.has(c.id);

  if (type === 'decision') {
    const coa = activeCoa(narrative, coaId);
    const label = coa?.label ?? nextCoaLabel([]);
    const selection = effectiveSelection(narrative, coa?.id);
    const situationLines = renderFactorLines(situation.filter(isIncluded), selection);
    const decisionLines = renderFactorLines(decisions, selection);
    const others = (narrative.coas || [])
      .filter((c) => c !== coa)
      .map((c: CoaInput) => `- ${c.label}${c.desc ? `: ${c.desc}` : ''}`)
      .join('\n');
    return [
      situationLines && `${labels.decisionSituation}\n${situationLines}`,
      narrativeText?.trim() && fill(labels.scenarioText, { narrative: narrativeText.trim() }),
      decisionLines ? `${fill(labels.coaDecisions, { coa: label })}\n${decisionLines}` : fill(labels.coaNoDecisions, { coa: label }),
      others && `${labels.otherCoas}\n${others}`,
    ]
      .filter(Boolean)
      .join('\n\n');
  }

  const selection = effectiveSelection(narrative, coaId);
  const active = options.decisionSupport ?? decisionIds.size > 0;
  if (decisionIds.size === 0 || (type !== 'narrative' && type !== 'persona')) {
    // Components that are in no category keep their place in the plain list
    const ordered = box.components.filter((c) => isIncluded(c) && (!decisionIds.has(c.id) || active));
    return renderFactorLines(ordered, selection);
  }
  const situationLines = renderFactorLines(situation.filter(isIncluded), selection);
  const actionLines = active ? renderFactorLines(decisions.filter(isIncluded), selection) : '';
  return [situationLines && `${labels.situation}\n${situationLines}`, actionLines ? `${labels.suggestedActions}\n${actionLines}` : labels.noMeasures]
    .filter(Boolean)
    .join('\n\n');
};

/** The box prompt of the type (if any), followed by `createLlmInput`. */
export const createLlmPrompt = (box: MorphologicalBox & NarrativeSettings, options: LlmInputOptions) => {
  const prompt = box.llm?.prompts?.find((p) => p.type === (options.type || 'narrative'))?.prompt?.trim();
  return [prompt, createLlmInput(box, options)].filter(Boolean).join('\n\n');
};
