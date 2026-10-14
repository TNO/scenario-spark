import { generateCombination, getBoxComponents, getDecisionComponentIds } from './generate.ts';
import { getInconsistency } from './inconsistencies.ts';
import { LLM_PROMPT_TYPES, SCENARIO_SPARK_LANGUAGES, parseTemplate } from './narrative.ts';
import type { ID, MorphologicalBox } from './types.ts';

export type IssueLevel = 'error' | 'warning';

export type ValidationIssue = {
  level: IssueLevel;
  /** Stable machine-readable code */
  code: string;
  /** JSON path of the offending element, e.g. `components[2].values[0].id` */
  path: string;
  message: string;
};

export type ValidationResult = {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
};

export type ValidateOptions = {
  /** Check that at least one consistent combination exists (default true). */
  checkFeasibility?: boolean;
  /** Minimum number of values per component before a warning (default 2). */
  minValues?: number;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

/**
 * Validate a morphological box. Accepts unknown input, so it can be used on
 * freshly parsed JSON. Errors make the box unusable; warnings indicate quality issues.
 */
export const validateBox = (input: unknown, options: ValidateOptions = {}): ValidationResult => {
  const { checkFeasibility = true, minValues = 2 } = options;
  const issues: ValidationIssue[] = [];
  const add = (level: IssueLevel, code: string, path: string, message: string) =>
    issues.push({ level, code, path, message });
  const done = (): ValidationResult => {
    const errors = issues.filter((i) => i.level === 'error');
    return { valid: errors.length === 0, errors, warnings: issues.filter((i) => i.level === 'warning') };
  };

  if (!isRecord(input)) {
    add('error', 'not-an-object', '', 'The box must be a JSON object.');
    return done();
  }
  const checkItem = (item: unknown, path: string): item is { id: string; label: string } => {
    if (!isRecord(item)) {
      add('error', 'not-an-object', path, 'Expected an object with id and label.');
      return false;
    }
    let ok = true;
    if (!isNonEmptyString(item.id)) {
      add('error', 'missing-id', `${path}.id`, 'Missing or empty id.');
      ok = false;
    }
    if (!isNonEmptyString(item.label)) {
      add('error', 'missing-label', `${path}.label`, 'Missing or empty label.');
      ok = false;
    }
    if (item.desc !== undefined && typeof item.desc !== 'string') {
      add('error', 'invalid-desc', `${path}.desc`, 'desc must be a string.');
    }
    return ok;
  };

  checkItem(input, '$');
  if (!Array.isArray(input.categories)) add('error', 'missing-categories', '$.categories', 'categories must be an array.');
  if (!Array.isArray(input.components)) add('error', 'missing-components', '$.components', 'components must be an array.');
  if (input.inconsistencies !== undefined && !isRecord(input.inconsistencies)) {
    add('error', 'invalid-inconsistencies', '$.inconsistencies', 'inconsistencies must be an object.');
  }
  if (input.language !== undefined) {
    if (!isNonEmptyString(input.language)) add('error', 'invalid-language', '$.language', 'language must be a language code such as "en".');
    else if (!(SCENARIO_SPARK_LANGUAGES as readonly string[]).includes(input.language)) {
      add('warning', 'unsupported-language', '$.language', `Scenario Spark supports ${SCENARIO_SPARK_LANGUAGES.join(', ')}; "${input.language}" is kept but not used by its interface.`);
    }
  }
  if (input.template !== undefined && typeof input.template !== 'string') {
    add('error', 'invalid-template', '$.template', 'template must be a string.');
  }
  if (input.llm !== undefined && (!isRecord(input.llm) || !Array.isArray(input.llm.prompts))) {
    add('error', 'invalid-llm', '$.llm', 'llm must be an object with a prompts array.');
  }
  if (issues.some((i) => i.level === 'error' && i.path !== '$.id' && i.path !== '$.label')) return done();

  const categories = input.categories as unknown[];
  const components = input.components as unknown[];
  const inconsistencies = (input.inconsistencies || {}) as Record<string, unknown>;

  const allIds = new Map<ID, string>();
  const registerId = (id: ID, path: string) => {
    const existing = allIds.get(id);
    if (existing) add('error', 'duplicate-id', path, `Duplicate id "${id}" (also used at ${existing}).`);
    else allIds.set(id, path);
  };
  if (isNonEmptyString(input.id)) allIds.set(input.id, '$.id');

  const componentIds = new Map<ID, number>();
  const valueOwner = new Map<ID, ID>();
  components.forEach((component, ci) => {
    const path = `$.components[${ci}]`;
    if (!checkItem(component, path)) return;
    const comp = component as Record<string, unknown> & { id: string; label: string };
    registerId(comp.id, `${path}.id`);
    componentIds.set(comp.id, ci);
    if (comp.manual !== undefined && typeof comp.manual !== 'boolean') {
      add('error', 'invalid-manual', `${path}.manual`, 'manual must be a boolean.');
    }
    if (comp.values === undefined || (Array.isArray(comp.values) && comp.values.length === 0)) {
      add('error', 'no-values', `${path}.values`, `Component "${comp.label}" has no values.`);
      return;
    }
    if (!Array.isArray(comp.values)) {
      add('error', 'invalid-values', `${path}.values`, 'values must be an array.');
      return;
    }
    if (comp.values.length < minValues) {
      add('warning', 'too-few-values', `${path}.values`, `Component "${comp.label}" has fewer than ${minValues} values.`);
    }
    const labels = new Set<string>();
    comp.values.forEach((value, vi) => {
      const vPath = `${path}.values[${vi}]`;
      if (!checkItem(value, vPath)) return;
      const v = value as { id: string; label: string };
      registerId(v.id, `${vPath}.id`);
      valueOwner.set(v.id, comp.id);
      const key = v.label.trim().toLowerCase();
      if (labels.has(key)) add('warning', 'duplicate-label', `${vPath}.label`, `Duplicate value label "${v.label}" in "${comp.label}".`);
      labels.add(key);
    });
  });

  const categorized = new Map<ID, ID>();
  categories.forEach((category, ci) => {
    const path = `$.categories[${ci}]`;
    if (!checkItem(category, path)) return;
    const cat = category as Record<string, unknown> & { id: string; label: string };
    registerId(cat.id, `${path}.id`);
    if (cat.decisionSupport !== undefined && typeof cat.decisionSupport !== 'boolean') {
      add('error', 'invalid-decision-support', `${path}.decisionSupport`, 'decisionSupport must be a boolean.');
    }
    if (cat.componentIds === undefined || (Array.isArray(cat.componentIds) && cat.componentIds.length === 0)) {
      add('warning', 'empty-category', `${path}.componentIds`, `Category "${cat.label}" has no components.`);
      return;
    }
    if (!Array.isArray(cat.componentIds) || !cat.componentIds.every((id) => typeof id === 'string')) {
      add('error', 'invalid-component-ids', `${path}.componentIds`, 'componentIds must be an array of strings.');
      return;
    }
    cat.componentIds.forEach((id: string, i: number) => {
      const idPath = `${path}.componentIds[${i}]`;
      if (!componentIds.has(id)) {
        add('error', 'unknown-component', idPath, `Category "${cat.label}" refers to unknown component "${id}".`);
      } else if (categorized.has(id)) {
        add('warning', 'component-in-multiple-categories', idPath, `Component "${id}" is also in category "${categorized.get(id)}"; only the first is used.`);
      } else categorized.set(id, cat.id);
    });
  });
  for (const [id, ci] of componentIds) {
    if (!categorized.has(id)) {
      add('warning', 'uncategorized-component', `$.components[${ci}]`, `Component "${id}" is not in any category and is ignored when generating.`);
    }
  }

  let inconsistencyErrors = false;
  for (const [from, row] of Object.entries(inconsistencies)) {
    const rowPath = `$.inconsistencies["${from}"]`;
    if (!isRecord(row)) {
      add('error', 'invalid-inconsistencies', rowPath, 'Each inconsistency row must be an object.');
      inconsistencyErrors = true;
      continue;
    }
    if (!valueOwner.has(from)) {
      add('error', 'unknown-value', rowPath, `Inconsistency refers to unknown value "${from}".`);
      inconsistencyErrors = true;
      continue;
    }
    for (const [to, state] of Object.entries(row)) {
      const path = `${rowPath}["${to}"]`;
      if (typeof state !== 'boolean') {
        add('error', 'invalid-inconsistency-state', path, 'State must be true (impossible) or false (unlikely).');
        inconsistencyErrors = true;
      } else if (!valueOwner.has(to)) {
        add('error', 'unknown-value', path, `Inconsistency refers to unknown value "${to}".`);
        inconsistencyErrors = true;
      } else if (from === to) {
        add('warning', 'self-inconsistency', path, `Value "${from}" is marked inconsistent with itself.`);
      } else if (valueOwner.get(from) === valueOwner.get(to)) {
        add('warning', 'same-component-inconsistency', path, `"${from}" and "${to}" belong to the same component; the constraint has no effect.`);
      } else {
        const reverse = (inconsistencies[to] as Record<string, unknown> | undefined)?.[from];
        if (reverse === undefined) {
          add('warning', 'asymmetric-inconsistency', path, `Missing mirror entry inconsistencies["${to}"]["${from}"].`);
        } else if (reverse !== state) {
          add('error', 'conflicting-inconsistency', path, `"${from}"↔"${to}" is both impossible and unlikely.`);
          inconsistencyErrors = true;
        }
      }
    }
  }

  if (issues.some((i) => i.level === 'error')) return done();

  const box = { ...input, inconsistencies } as unknown as MorphologicalBox;
  const boxComponents = getBoxComponents(box);
  if (boxComponents.length === 0) {
    add('error', 'no-components', '$.categories', 'No categorized components: nothing to combine.');
    return done();
  }

  if (typeof input.template === 'string') {
    for (const p of parseTemplate(box, input.template)) {
      if (p.problem) add(p.component ? 'warning' : 'error', 'invalid-template-placeholder', '$.template', p.problem);
    }
  }
  if (isRecord(input.llm)) {
    const categoryIds = new Set(box.categories.map((c) => c.id));
    (input.llm.prompts as unknown[]).forEach((prompt, i) => {
      const path = `$.llm.prompts[${i}]`;
      if (!isRecord(prompt) || typeof prompt.prompt !== 'string' || !Array.isArray(prompt.categories)) {
        add('error', 'invalid-llm-prompt', path, 'Expected {type, prompt, categories}.');
        return;
      }
      if (!LLM_PROMPT_TYPES.includes(prompt.type as never)) {
        add('error', 'invalid-llm-prompt', `${path}.type`, `type must be one of: ${LLM_PROMPT_TYPES.join(', ')}.`);
      }
      if (!prompt.prompt.trim()) add('warning', 'empty-llm-prompt', `${path}.prompt`, 'The prompt is empty; Scenario Spark uses its default.');
      for (const id of prompt.categories as unknown[]) {
        if (typeof id !== 'string' || !categoryIds.has(id)) {
          add('warning', 'unknown-prompt-category', `${path}.categories`, `Prompt refers to unknown category "${String(id)}".`);
        }
      }
    });
  }

  const decisionIds = getDecisionComponentIds(box);
  if (decisionIds.size > 0) {
    for (const comp of boxComponents) {
      if (decisionIds.has(comp.id) && !comp.manual) {
        add('warning', 'decision-component-not-manual', `$.components[${componentIds.get(comp.id)}].manual`, `Component "${comp.id}" is in a decision category but not manual, so it is generated.`);
      }
    }
    const decisionValues = boxComponents.filter((c) => decisionIds.has(c.id)).flatMap((c) => (c.values || []).map((v) => v.id));
    const situationValues = boxComponents.filter((c) => !decisionIds.has(c.id)).flatMap((c) => (c.values || []).map((v) => v.id));
    const linked = situationValues.some((s) => decisionValues.some((d) => getInconsistency(box.inconsistencies, s, d) === true));
    if (!linked) {
      add('warning', 'decision-unlinked', '$.inconsistencies', 'The box has decision categories, but no impossible pair excludes a decision value for any situation value.');
    }
  }

  // A value that is impossible with every value of another component can never be used.
  for (const comp of boxComponents) {
    for (const value of comp.values || []) {
      const blocker = boxComponents.find(
        (other) =>
          other.id !== comp.id &&
          (other.values || []).length > 0 &&
          (other.values || []).every((ov) => getInconsistency(box.inconsistencies, value.id, ov.id) === true),
      );
      if (blocker) {
        add('warning', 'dead-value', `$.components[${componentIds.get(comp.id)}]`, `Value "${value.id}" is impossible with every value of "${blocker.id}" and can never be selected.`);
      }
    }
  }

  if (checkFeasibility && !inconsistencyErrors) {
    const result = generateCombination(box, { optimize: false, random: () => 0.5, includeManual: true });
    if (!result.ok) {
      add('error', 'infeasible', '$.inconsistencies', 'No combination exists without impossible pairs; relax some constraints.');
    }
  }
  return done();
};
