import { getBoxComponents, type RandomFn } from './generate.ts';
import { getInconsistency } from './inconsistencies.ts';
import type { Component, ID, MorphologicalBox, Selection } from './types.ts';

export type CoverageOptions = {
  /** Pre-selected value IDs per component ID; these are kept as-is in every scenario. */
  locked?: Selection;
  /** Random source in [0, 1). Defaults to Math.random. */
  random?: RandomFn;
  /**
   * 1 (default): every value is used about equally often.
   * 2: additionally prefer value pairs that have not been combined yet (pairwise coverage).
   */
  strength?: 1 | 2;
  /** Cost of one unlikely pair, relative to using a value once more than another. Default 1. */
  unlikelyWeight?: number;
  /** If true, also fill manual components that are not locked. */
  includeManual?: boolean;
  /** Existing selections that already count towards coverage (and are never duplicated). */
  existing?: Selection[];
  /** Number of randomized candidates per scenario; the best one is kept. Default 10. */
  tries?: number;
  /** Maximum number of search steps per candidate, to bound the search in huge, heavily constrained boxes. Default 100000. */
  maxSteps?: number;
};

export type CoverageResult = { selection: Selection; unlikelyCount: number };

export type CoverageGenerator = {
  /** Next scenario, or undefined when no new consistent scenario can be found. */
  next: () => CoverageResult | undefined;
  /** How often each value of the generated components has been used so far. */
  counts: () => Map<ID, number>;
};

const pairKey = (a: ID, b: ID) => (a < b ? `${a}|${b}` : `${b}|${a}`);

const selectionKey = (selection: Selection, keys: ID[]) =>
  [...keys]
    .sort()
    .map((key) => `${key}=${[...(selection[key] || [])].sort().join(',')}`)
    .join(';');

/**
 * Create scenarios that cover the box evenly: each new scenario prefers the
 * values that have been used least so far (a greedy, AETG-like construction of
 * a constrained, level-balanced design). Impossible pairs are never selected,
 * unlikely pairs are penalized, and locked values are kept.
 */
export const createCoverageGenerator = (box: MorphologicalBox, options: CoverageOptions = {}): CoverageGenerator => {
  const {
    locked = {},
    random = Math.random,
    strength = 1,
    unlikelyWeight = 1,
    includeManual = false,
    existing = [],
    tries = 10,
    maxSteps = 100000,
  } = options;
  const { inconsistencies } = box;
  const components = getBoxComponents(box)
    .filter((c) => !Object.hasOwn(locked, c.id) && (includeManual || !c.manual))
    .filter((c) => (c.values || []).length > 0);
  const lockedValueIds = Object.values(locked).flat();

  const counts = new Map<ID, number>();
  components.forEach((c) => (c.values || []).forEach((v) => counts.set(v.id, 0)));
  const coveredPairs = new Set<string>();
  const seen = new Set<string>();
  const keyIds = [...new Set([...Object.keys(locked), ...components.map((c) => c.id)])];
  const generatedIds = (selection: Selection) =>
    components.flatMap((c) => (selection[c.id] || []).filter((id) => counts.has(id)));
  const register = (selection: Selection) => {
    const ids = generatedIds(selection);
    ids.forEach((id) => counts.set(id, (counts.get(id) || 0) + 1));
    if (strength === 2) {
      for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) coveredPairs.add(pairKey(ids[i], ids[j]));
    }
  };
  existing.forEach((selection) => {
    register(selection);
    seen.add(selectionKey({ ...selection, ...locked }, keyIds));
  });

  // Each new pair is worth less than one extra use, so pair coverage only breaks ties in balance.
  const pairBonus = 1 / (components.length + 1);

  /**
   * Cost of adding `id`, or undefined when it forms an impossible pair. Usage above the least-used value
   * of its component (`minCount`) costs exponentially more, so no value runs far ahead of the others.
   */
  const valueCost = (id: ID, minCount: number, selectedIds: ID[], generated: ID[]) => {
    let unlikely = 0;
    for (const other of selectedIds) {
      const state = getInconsistency(inconsistencies, id, other);
      if (state === true) return undefined;
      if (state === false) unlikely++;
    }
    let newPairs = 0;
    if (strength === 2) for (const other of generated) if (!coveredPairs.has(pairKey(id, other))) newPairs++;
    const excess = (counts.get(id) || 0) - minCount;
    return { cost: 2 ** excess - 1 + unlikelyWeight * unlikely, unlikely, newPairs };
  };

  const feasible = (comps: Component[], from: number, selectedIds: ID[]) => {
    for (let i = from; i < comps.length; i++) {
      const ok = (comps[i].values || []).some(({ id }) =>
        selectedIds.every((other) => getInconsistency(inconsistencies, id, other) !== true),
      );
      if (!ok) return false;
    }
    return true;
  };

  type Candidate = { selection: Selection; cost: number; newPairs: number; unlikelyCount: number };
  const better = (a: Candidate, b?: Candidate) =>
    !b || a.cost < b.cost || (a.cost === b.cost && a.newPairs > b.newPairs);

  /**
   * One randomized branch-and-bound search for the cheapest scenario that does not exist yet:
   * values are tried least-used first, and branches that cannot beat the best scenario found are pruned.
   */
  const build = (): Candidate | undefined => {
    let steps = 0;
    let found: Candidate | undefined;
    const constraintWeight = (c: Component) =>
      (c.values || []).reduce((sum, v) => sum + Object.keys(inconsistencies[v.id] || {}).length, 0);
    const order = components
      .map((c) => ({ c, rank: random() }))
      .sort((a, b) => constraintWeight(b.c) - constraintWeight(a.c) || a.rank - b.rank)
      .map(({ c }) => c);
    const minCounts = order.map((c) => Math.min(...(c.values || []).map((v) => counts.get(v.id) || 0)));
    const search = (
      index: number,
      selection: Selection,
      selectedIds: ID[],
      generated: ID[],
      cost: number,
      newPairs: number,
      unlikely: number,
    ) => {
      if (++steps > maxSteps) return;
      if (found && cost >= found.cost) return;
      if (index >= order.length) {
        const candidate = { selection, cost, newPairs, unlikelyCount: unlikely };
        if (!seen.has(selectionKey(selection, keyIds)) && better(candidate, found)) found = candidate;
        return;
      }
      const component = order[index];
      const candidates = (component.values || [])
        .map(({ id }) => ({ id, score: valueCost(id, minCounts[index], selectedIds, generated), jitter: random() }))
        .filter((c): c is { id: ID; score: NonNullable<ReturnType<typeof valueCost>>; jitter: number } => !!c.score)
        .sort(
          (a, b) =>
            a.score.cost - pairBonus * a.score.newPairs - (b.score.cost - pairBonus * b.score.newPairs) ||
            a.jitter - b.jitter,
        );
      for (const { id, score } of candidates) {
        if (steps > maxSteps) return;
        const nextSelected = selectedIds.concat(id);
        if (!feasible(order, index + 1, nextSelected)) continue;
        search(
          index + 1,
          { ...selection, [component.id]: [id] },
          nextSelected,
          generated.concat(id),
          cost + score.cost,
          newPairs + score.newPairs,
          unlikely + score.unlikely,
        );
      }
    };
    for (let i = 0; i < lockedValueIds.length; i++) {
      for (let j = i + 1; j < lockedValueIds.length; j++) {
        if (getInconsistency(inconsistencies, lockedValueIds[i], lockedValueIds[j]) === true) return undefined;
      }
    }
    let lockedUnlikely = 0;
    for (let i = 0; i < lockedValueIds.length; i++) {
      for (let j = i + 1; j < lockedValueIds.length; j++) {
        if (getInconsistency(inconsistencies, lockedValueIds[i], lockedValueIds[j]) === false) lockedUnlikely++;
      }
    }
    const start: Selection = Object.fromEntries(Object.entries(locked).map(([id, ids]) => [id, ids || []]));
    if (!feasible(order, 0, lockedValueIds)) return undefined;
    search(0, start, lockedValueIds, [], 0, 0, lockedUnlikely);
    return found;
  };

  const next = (): CoverageResult | undefined => {
    let best: Candidate | undefined;
    for (let attempt = 0; attempt < tries; attempt++) {
      const candidate = build();
      if (!candidate) break;
      if (better(candidate, best)) best = candidate;
    }
    if (!best) return undefined;
    seen.add(selectionKey(best.selection, keyIds));
    register(best.selection);
    return { selection: best.selection, unlikelyCount: best.unlikelyCount };
  };

  return { next, counts: () => new Map(counts) };
};

/** Generate up to `count` distinct scenarios that use all values as evenly as the constraints allow. */
export const generateCoverage = (box: MorphologicalBox, count: number, options: CoverageOptions = {}): CoverageResult[] => {
  const generator = createCoverageGenerator(box, options);
  const results: CoverageResult[] = [];
  while (results.length < count) {
    const result = generator.next();
    if (!result) break;
    results.push(result);
  }
  return results;
};

/** How often each value of the box's components is used in the given selections. */
export const valueUsage = (box: Pick<MorphologicalBox, 'categories' | 'components'>, selections: Selection[]) => {
  const usage = new Map<ID, number>();
  getBoxComponents(box).forEach((c) => (c.values || []).forEach((v) => usage.set(v.id, 0)));
  selections.forEach((s) => Object.values(s).flat().forEach((id) => usage.has(id) && usage.set(id, usage.get(id)! + 1)));
  return usage;
};
