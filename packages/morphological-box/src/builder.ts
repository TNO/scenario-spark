import { normalizeInconsistencies, setInconsistency } from './inconsistencies.ts';
import { remapTemplate, type NarrativeSettings } from './narrative.ts';
import type { Category, Component, ID, InconsistencyType, MorphologicalBox, Value } from './types.ts';

/** Turn a label into a lowercase, dash-separated id. */
export const slugify = (label: string) =>
  label
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'item';

const uniqueIdFor = (base: string, used: Set<ID>) => {
  let id = base;
  for (let i = 2; used.has(id); i++) id = `${base}-${i}`;
  used.add(id);
  return id;
};

/** Default extra fields that make a box directly importable in Scenario Spark. */
export const scenarioSparkDefaults = () => ({
  hideInconsistentValues: false,
  includeDecisionSupport: false,
  narratives: [] as unknown[],
  thresholdColors: [
    { threshold: 0, color: '#ddeced' },
    { threshold: 1, color: '#FF7800' },
    { threshold: 2, color: '#ffff00' },
    { threshold: 3, color: '#ff0000' },
  ],
});

export type BoxDetails = {
  id?: ID;
  label: string;
  desc?: string;
  /** ISO 639-1 code of the language used for labels, template and prompts */
  language?: string;
};

/** Create an empty box (including Scenario Spark defaults). */
export const createBox = ({ id, label, desc, language }: BoxDetails): MorphologicalBox & NarrativeSettings =>
  ({
    id: id || slugify(label),
    label,
    ...(desc ? { desc } : {}),
    ...(language ? { language } : {}),
    ...scenarioSparkDefaults(),
    categories: [],
    components: [],
    inconsistencies: {},
  }) as MorphologicalBox;

/** Add missing Scenario Spark fields and normalize the inconsistency matrix. */
export const toScenarioSpark = <B extends MorphologicalBox>(box: B): B => {
  const valueIds = new Set(box.components.flatMap((c) => (c.values || []).map((v) => v.id)));
  return {
    ...scenarioSparkDefaults(),
    ...box,
    inconsistencies: normalizeInconsistencies(box.inconsistencies || {}, valueIds),
  };
};

export const setBoxDetails = <B extends MorphologicalBox>(box: B, details: Partial<BoxDetails>): B => ({
  ...box,
  ...(details.id ? { id: details.id } : {}),
  ...(details.label ? { label: details.label } : {}),
  ...(details.desc !== undefined ? { desc: details.desc } : {}),
  ...(details.language ? { language: details.language } : {}),
});

/** Keep `{n}` template placeholders on the same components after a structural change. */
const withComponents = <B extends MorphologicalBox>(box: B, changes: Partial<MorphologicalBox>): B => {
  const next = { ...box, ...changes } as B & NarrativeSettings;
  const { template } = box as B & NarrativeSettings;
  if (template && changes.components) next.template = remapTemplate(template, box.components, changes.components);
  return next;
};

export type ValueInput = string | { id?: ID; label: string; desc?: string };
export type ComponentInput = { id?: ID; label: string; desc?: string; manual?: boolean; values: ValueInput[] };
/** `manual` applies to all components of the category, unless a component overrides it. */
export type CategoryInput = { id?: ID; label: string; desc?: string; manual?: boolean; components: ComponentInput[] };

const collectIds = (box: MorphologicalBox, skipCategory?: Category) => {
  const skipComponents = new Set(skipCategory?.componentIds || []);
  const ids = new Set<ID>([box.id]);
  for (const cat of box.categories) if (cat !== skipCategory) ids.add(cat.id);
  for (const comp of box.components) {
    if (skipComponents.has(comp.id)) continue;
    ids.add(comp.id);
    for (const v of comp.values || []) ids.add(v.id);
  }
  return ids;
};

/**
 * Add a category with its components and values, or replace the category with
 * the same id (or label). Missing ids are derived from labels; explicit ids are
 * kept. Components that disappear from a replaced category are removed, as are
 * inconsistencies of removed values.
 */
export const upsertCategory = <B extends MorphologicalBox>(box: B, input: CategoryInput): B => {
  if (!input || typeof input.label !== 'string' || !input.label.trim()) throw new Error('Category needs a label.');
  if (!Array.isArray(input.components) || input.components.length === 0) {
    throw new Error(`Category "${input.label}" needs at least one component.`);
  }
  const existing = box.categories.find(
    (c) => (input.id && c.id === input.id) || (!input.id && c.label.trim().toLowerCase() === input.label.trim().toLowerCase()),
  );
  const used = collectIds(box, existing);
  const oldComponentIds = new Set(existing?.componentIds || []);
  const takeId = (explicit: ID | undefined, base: string, what: string) => {
    if (explicit) {
      if (used.has(explicit)) throw new Error(`${what} id "${explicit}" is already used elsewhere in the box.`);
      used.add(explicit);
      return explicit;
    }
    return uniqueIdFor(base, used);
  };

  const categoryId = existing ? existing.id : takeId(input.id, slugify(input.label), 'Category');
  if (existing) used.add(existing.id);
  const newComponents: Component[] = input.components.map((ci) => {
    if (!ci || typeof ci.label !== 'string' || !ci.label.trim()) throw new Error(`Component in "${input.label}" needs a label.`);
    if (!Array.isArray(ci.values) || ci.values.length === 0) throw new Error(`Component "${ci.label}" needs values.`);
    const componentId = takeId(ci.id, slugify(ci.label), 'Component');
    const values: Value[] = ci.values.map((vi) => {
      const v = typeof vi === 'string' ? { label: vi } : vi;
      if (!v || typeof v.label !== 'string' || !v.label.trim()) throw new Error(`Value in "${ci.label}" needs a label.`);
      return {
        id: takeId(v.id, `${componentId}-${slugify(v.label)}`, 'Value'),
        label: v.label,
        ...(v.desc ? { desc: v.desc } : {}),
      };
    });
    const previous = box.components.find((c) => c.id === componentId && oldComponentIds.has(c.id));
    const { manual: previousManual, ...rest } = previous || ({} as Partial<Component>);
    const manual = ci.manual ?? input.manual ?? previousManual;
    return {
      ...rest,
      id: componentId,
      label: ci.label,
      ...(ci.desc ? { desc: ci.desc } : {}),
      ...(manual ? { manual: true } : {}),
      values,
    };
  });

  const category: Category = {
    ...(existing || {}),
    id: categoryId,
    label: input.label,
    ...(input.desc ? { desc: input.desc } : {}),
    componentIds: newComponents.map((c) => c.id),
  };
  // Replace in place so the position (and template numbering) of other components is kept.
  const firstOld = box.components.findIndex((c) => oldComponentIds.has(c.id));
  const kept = box.components.filter((c) => !oldComponentIds.has(c.id));
  const insertAt = firstOld < 0 ? kept.length : box.components.slice(0, firstOld).filter((c) => !oldComponentIds.has(c.id)).length;
  const components = [...kept.slice(0, insertAt), ...newComponents, ...kept.slice(insertAt)];
  const categories = existing
    ? box.categories.map((c) => (c === existing ? category : c))
    : [...box.categories, category];
  const valueIds = new Set(components.flatMap((c) => (c.values || []).map((v) => v.id)));
  return withComponents(box, {
    categories,
    components,
    inconsistencies: normalizeInconsistencies(box.inconsistencies || {}, valueIds),
  });
};

/** Remove a category, its components, and their inconsistencies. */
export const removeCategory = <B extends MorphologicalBox>(box: B, categoryId: ID): B => {
  const category = box.categories.find((c) => c.id === categoryId);
  if (!category) throw new Error(`Unknown category "${categoryId}".`);
  const removed = new Set(category.componentIds || []);
  const components = box.components.filter((c) => !removed.has(c.id));
  const valueIds = new Set(components.flatMap((c) => (c.values || []).map((v) => v.id)));
  const next = withComponents(box, {
    categories: box.categories.filter((c) => c !== category),
    components,
    inconsistencies: normalizeInconsistencies(box.inconsistencies || {}, valueIds),
  }) as B & NarrativeSettings;
  if (next.llm?.prompts) {
    next.llm = {
      ...next.llm,
      prompts: next.llm.prompts.map((p) => ({ ...p, categories: (p.categories || []).filter((id) => id !== categoryId) })),
    };
  }
  return next;
};

export type InconsistencyInput = {
  a: ID;
  b: ID;
  type: InconsistencyType;
  /** Optional rationale; not stored in the box but useful in review logs */
  reason?: string;
};

/**
 * Apply a list of pair constraints. Each id must be a value id, or a component
 * id to address all of its values. Throws on unknown ids or same-component pairs.
 */
export const applyInconsistencies = <B extends MorphologicalBox>(box: B, entries: InconsistencyInput[]): B => {
  if (!Array.isArray(entries)) throw new Error('Expected an array of {a, b, type} entries.');
  const owner = new Map<ID, ID>();
  const componentValues = new Map<ID, ID[]>();
  for (const comp of box.components) {
    componentValues.set(comp.id, (comp.values || []).map((v) => v.id));
    for (const v of comp.values || []) owner.set(v.id, comp.id);
  }
  const expand = (id: ID, index: number) => {
    if (owner.has(id)) return [id];
    const values = componentValues.get(id);
    if (values) return values;
    throw new Error(`Entry ${index}: unknown value or component id "${id}".`);
  };
  const inconsistencies = normalizeInconsistencies(box.inconsistencies || {});
  entries.forEach((entry, index) => {
    if (!entry || typeof entry.a !== 'string' || typeof entry.b !== 'string') {
      throw new Error(`Entry ${index}: expected {"a": id, "b": id, "type": ...}.`);
    }
    if (!['possible', 'unlikely', 'impossible'].includes(entry.type)) {
      throw new Error(`Entry ${index}: type must be "impossible", "unlikely" or "possible".`);
    }
    for (const a of expand(entry.a, index)) {
      for (const b of expand(entry.b, index)) {
        if (owner.get(a) === owner.get(b)) {
          throw new Error(`Entry ${index}: "${a}" and "${b}" belong to the same component.`);
        }
        setInconsistency(inconsistencies, a, b, entry.type);
      }
    }
  });
  return { ...box, inconsistencies };
};

/**
 * Mark components as manual (chosen by a person, not generated) or automatic.
 * Each id may be a component or category id (all its components).
 */
export const setManual = <B extends MorphologicalBox>(box: B, ids: ID[], manual = true): B => {
  const targets = new Set<ID>();
  for (const id of ids) {
    const category = box.categories.find((c) => c.id === id);
    if (category) (category.componentIds || []).forEach((cid) => targets.add(cid));
    else if (box.components.some((c) => c.id === id)) targets.add(id);
    else throw new Error(`Unknown category or component id "${id}".`);
  }
  return {
    ...box,
    components: box.components.map((c) => {
      if (!targets.has(c.id)) return c;
      const { manual: _old, ...rest } = c;
      return (manual ? { ...rest, manual: true } : rest) as typeof c;
    }),
  };
};
