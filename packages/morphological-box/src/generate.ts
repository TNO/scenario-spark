import { getInconsistency } from './inconsistencies.ts';
import type { Component, ID, Inconsistencies, MorphologicalBox, Selection } from './types.ts';

export type RandomFn = () => number;

/** Deterministic pseudo-random generator (mulberry32), handy for reproducible output. */
export const createRandom = (seed: number): RandomFn => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** Diagnostic result for a morphological box dead-end. */
export type GenerationDiagnostic = {
  /** Components that have severely constrained values (< 2 available) */
  blockedComponents: Array<{
    componentId: ID;
    componentLabel: string;
    totalValues: number;
    availableValues: number;
    blockedValueIds: ID[];
  }>;
  /** Total number of impossible constraint entries */
  totalConstraints: number;
};

export type GenerationResult =
  | { ok: true; selection: Selection; unlikelyCount: number }
  | { ok: false; diagnostic: GenerationDiagnostic };

export type GenerateOptions = {
  /** Pre-selected value IDs per component ID; these are kept as-is. */
  locked?: Selection;
  /** Random source in [0, 1). Defaults to Math.random. */
  random?: RandomFn;
  /**
   * If true (default), return the combination with the fewest unlikely pairs.
   * If false, return the first combination without impossible pairs.
   */
  optimize?: boolean;
  /**
   * If true, also fill manual components (e.g. measures) that are not locked.
   * By default they are left out of the selection, so a person can choose them.
   */
  includeManual?: boolean;
};

/** Components that are part of a category, in category order, without duplicates. */
export const getBoxComponents = <C extends Component>(box: Pick<MorphologicalBox<C>, 'categories' | 'components'>): C[] => {
  const seen = new Set<ID>();
  const byId = new Map(box.components.map((component) => [component.id, component]));
  return box.categories
    .flatMap((category) => category.componentIds || [])
    .map((id) => byId.get(id))
    .filter((component): component is C => {
      if (!component || seen.has(component.id)) return false;
      seen.add(component.id);
      return true;
    });
};

/**
 * IDs of components that belong to a decision category (`decisionSupport`).
 * A component listed in several categories belongs to the first one only.
 */
export const getDecisionComponentIds = (box: Pick<MorphologicalBox, 'categories'>): Set<ID> => {
  const seen = new Set<ID>();
  const decisions = new Set<ID>();
  for (const category of box.categories) {
    for (const id of category.componentIds || []) {
      if (seen.has(id)) continue;
      seen.add(id);
      if (category.decisionSupport === true) decisions.add(id);
    }
  }
  return decisions;
};

/**
 * Explain why generation may fail: lists components with fewer than two
 * unconstrained values.
 */
export const diagnoseGeneration = (box: MorphologicalBox): GenerationDiagnostic => {
  const { inconsistencies } = box;
  const blockedComponents = getBoxComponents(box)
    .filter((comp) => comp.values && comp.values.length > 0)
    .map((comp) => {
      const values = comp.values || [];
      const blockedValueIds = values
        .filter((v) => inconsistencies[v.id] && Object.keys(inconsistencies[v.id]).length > 0)
        .map((v) => v.id);
      return {
        componentId: comp.id,
        componentLabel: comp.label || comp.id,
        totalValues: values.length,
        availableValues: values.length - blockedValueIds.length,
        blockedValueIds,
      };
    })
    .filter((c) => c.blockedValueIds.length > 0 && c.availableValues < 2)
    .sort((a, b) => a.availableValues - b.availableValues);

  const totalConstraints = Object.values(inconsistencies).reduce(
    (sum, row) => sum + Object.values(row).filter(Boolean).length,
    0,
  );

  return { blockedComponents, totalConstraints };
};

const countConstraints = (inconsistencies: Inconsistencies, id: ID) =>
  Object.values(inconsistencies[id] || {}).reduce((count, value) => count + (value ? 2 : 1), 0);

/** Number of unlikely pairs, or undefined when an impossible pair occurs. */
const getPairScore = (inconsistencies: Inconsistencies, id: ID, selectedIds: ID[]) => {
  let unlikely = 0;
  for (const selectedId of selectedIds) {
    const state = getInconsistency(inconsistencies, id, selectedId);
    if (state === true) return undefined;
    if (state === false) unlikely++;
  }
  return unlikely;
};

const shuffle = <T>(array: T[], random: RandomFn) =>
  array
    .map((value) => ({ value, rank: random() }))
    .sort((a, b) => a.rank - b.rank)
    .map(({ value }) => value);

/**
 * Generate one combination (one value per component) that contains no
 * impossible pairs and, by default, as few unlikely pairs as possible.
 */
export const generateCombination = (box: MorphologicalBox, options: GenerateOptions = {}): GenerationResult => {
  const { locked = {}, random = Math.random, optimize = true, includeManual = false } = options;
  const { inconsistencies } = box;
  const valueWeight = (component: Component) =>
    (component.values || []).reduce((sum, value) => sum + countConstraints(inconsistencies, value.id), 0);
  const orderedComponents = getBoxComponents(box)
    .filter((component) => Object.hasOwn(locked, component.id) || (includeManual || !component.manual))
    .filter((component) => (component.values || []).length > 0 || Object.hasOwn(locked, component.id))
    .sort((a, b) => valueWeight(b) - valueWeight(a));

  const chosen: Selection = Object.fromEntries(
    Object.entries(locked).map(([id, valueIds]) => [id, valueIds || []]),
  );
  const lockedValueIds = Object.values(chosen).flat();
  let lockedUnlikelyCount = 0;
  for (let i = 0; i < lockedValueIds.length; i++) {
    const score = getPairScore(inconsistencies, lockedValueIds[i], lockedValueIds.slice(i + 1));
    if (typeof score === 'undefined') return { ok: false, diagnostic: diagnoseGeneration(box) };
    lockedUnlikelyCount += score;
  }

  let best: { selection: Selection; unlikelyCount: number } | undefined;

  /** Forward check: every remaining component must keep at least one usable value. */
  const remainingFeasible = (fromIndex: number, current: Selection, selectedValueIds: ID[]) => {
    for (let i = fromIndex; i < orderedComponents.length; i++) {
      const component = orderedComponents[i];
      if (Object.hasOwn(current, component.id)) continue;
      const ok = (component.values || []).some(
        ({ id }) => typeof getPairScore(inconsistencies, id, selectedValueIds) !== 'undefined',
      );
      if (!ok) return false;
    }
    return true;
  };

  const search = (index: number, current: Selection, selectedValueIds: ID[], unlikelyCount: number): boolean => {
    if (best && (!optimize || unlikelyCount >= best.unlikelyCount)) return !optimize;
    if (index >= orderedComponents.length) {
      best = { selection: current, unlikelyCount };
      return !optimize || unlikelyCount === 0;
    }
    const component = orderedComponents[index];
    if (Object.hasOwn(current, component.id)) {
      return search(index + 1, current, selectedValueIds, unlikelyCount);
    }
    const candidates = shuffle(component.values || [], random)
      .map(({ id }) => ({ id, score: getPairScore(inconsistencies, id, selectedValueIds) }))
      .filter((c): c is { id: ID; score: number } => typeof c.score !== 'undefined')
      .sort((a, b) => a.score - b.score);
    for (const candidate of candidates) {
      const nextSelected = selectedValueIds.concat(candidate.id);
      const next = { ...current, [component.id]: [candidate.id] };
      if (!remainingFeasible(index + 1, next, nextSelected)) continue;
      if (search(index + 1, next, nextSelected, unlikelyCount + candidate.score)) return true;
    }
    return false;
  };

  if (remainingFeasible(0, chosen, lockedValueIds)) search(0, chosen, lockedValueIds, lockedUnlikelyCount);

  return best ? { ok: true, ...best } : { ok: false, diagnostic: diagnoseGeneration(box) };
};

const selectionKey = (selection: Selection) =>
  Object.keys(selection)
    .sort()
    .map((key) => `${key}=${[...selection[key]].sort().join(',')}`)
    .join(';');

/**
 * Generate up to `count` distinct combinations, each (by default) with the
 * minimal number of unlikely pairs. May return fewer when the box does not
 * allow that many distinct combinations.
 */
export const generateCombinations = (
  box: MorphologicalBox,
  count: number,
  options: GenerateOptions & { maxAttempts?: number } = {},
): Array<{ selection: Selection; unlikelyCount: number }> => {
  const { maxAttempts = count * 20, ...rest } = options;
  const results = new Map<string, { selection: Selection; unlikelyCount: number }>();
  for (let attempt = 0; attempt < maxAttempts && results.size < count; attempt++) {
    const result = generateCombination(box, rest);
    if (!result.ok) break;
    const { selection, unlikelyCount } = result;
    results.set(selectionKey(selection), { selection, unlikelyCount });
  }
  return [...results.values()];
};

export type SelectionCheck = {
  /** True when no impossible pairs are present */
  consistent: boolean;
  impossible: Array<[ID, ID]>;
  unlikely: Array<[ID, ID]>;
};

/** Check an (existing or user-made) selection against the cross-consistency matrix. */
export const checkSelection = (box: Pick<MorphologicalBox, 'inconsistencies'>, selection: Selection): SelectionCheck => {
  const ids = [...new Set(Object.values(selection).flat())];
  const impossible: Array<[ID, ID]> = [];
  const unlikely: Array<[ID, ID]> = [];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const state = getInconsistency(box.inconsistencies, ids[i], ids[j]);
      if (state === true) impossible.push([ids[i], ids[j]]);
      else if (state === false) unlikely.push([ids[i], ids[j]]);
    }
  }
  return { consistent: impossible.length === 0, impossible, unlikely };
};

/** Total number of combinations, ignoring constraints (product of value counts). */
export const countCombinations = (box: MorphologicalBox): number =>
  getBoxComponents(box).reduce((product, component) => {
    const n = (component.values || []).length;
    return n > 0 ? product * n : product;
  }, 1);

export type OptionStatus = 'selected' | 'available' | 'unlikely' | 'excluded';

export type ComponentOptions = {
  componentId: ID;
  label: string;
  manual: boolean;
  /** True if the component belongs to a decision category */
  decision: boolean;
  values: Array<{
    id: ID;
    label: string;
    status: OptionStatus;
    /** Selected value IDs that make this value impossible (excluded) or unlikely */
    conflicts: ID[];
  }>;
};

/**
 * Decision support: given a (partial) selection, e.g. the current situation,
 * classify every value of every component as selected, available, unlikely or
 * excluded (impossible with a selected value of another component).
 */
export const assessOptions = (box: MorphologicalBox, selection: Selection): ComponentOptions[] => {
  const selected = Object.entries(selection).flatMap(([componentId, ids]) =>
    (ids || []).map((id) => ({ componentId, id })),
  );
  const decisions = getDecisionComponentIds(box);
  return getBoxComponents(box).map((component) => ({
    componentId: component.id,
    label: component.label,
    manual: !!component.manual,
    decision: decisions.has(component.id),
    values: (component.values || []).map(({ id, label }) => {
      if ((selection[component.id] || []).includes(id)) return { id, label, status: 'selected' as const, conflicts: [] };
      const others = selected.filter((s) => s.componentId !== component.id);
      const impossible = others.filter((s) => getInconsistency(box.inconsistencies, id, s.id) === true).map((s) => s.id);
      const unlikely = others.filter((s) => getInconsistency(box.inconsistencies, id, s.id) === false).map((s) => s.id);
      return impossible.length
        ? { id, label, status: 'excluded' as const, conflicts: impossible }
        : unlikely.length
          ? { id, label, status: 'unlikely' as const, conflicts: unlikely }
          : { id, label, status: 'available' as const, conflicts: [] };
    }),
  }));
};
