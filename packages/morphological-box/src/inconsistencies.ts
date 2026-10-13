import type { ID, Inconsistencies, InconsistencyType } from './types.ts';

/** Raw state of a pair: `true` impossible, `false` unlikely, `undefined` possible. */
export const getInconsistency = (
  inconsistencies: Inconsistencies,
  a: ID,
  b: ID,
): boolean | undefined => {
  const ab = inconsistencies[a]?.[b];
  if (typeof ab === 'boolean') return ab;
  const ba = inconsistencies[b]?.[a];
  return typeof ba === 'boolean' ? ba : undefined;
};

export const toInconsistencyType = (state: boolean | undefined): InconsistencyType =>
  state === true ? 'impossible' : state === false ? 'unlikely' : 'possible';

export const getInconsistencyType = (
  inconsistencies: Inconsistencies,
  a: ID,
  b: ID,
): InconsistencyType => toInconsistencyType(getInconsistency(inconsistencies, a, b));

/**
 * Set the state of a value pair symmetrically. Mutates and returns `inconsistencies`.
 * Setting `possible` removes the entry.
 */
export const setInconsistency = (
  inconsistencies: Inconsistencies,
  a: ID,
  b: ID,
  type: InconsistencyType,
): Inconsistencies => {
  if (a === b) return inconsistencies;
  if (type === 'possible') {
    for (const [from, to] of [
      [a, b],
      [b, a],
    ]) {
      const row = inconsistencies[from];
      if (!row) continue;
      delete row[to];
      if (Object.keys(row).length === 0) delete inconsistencies[from];
    }
    return inconsistencies;
  }
  const state = type === 'impossible';
  (inconsistencies[a] ||= {})[b] = state;
  (inconsistencies[b] ||= {})[a] = state;
  return inconsistencies;
};

/** Pair entry, each pair listed once. */
export type InconsistencyEntry = { a: ID; b: ID; type: Exclude<InconsistencyType, 'possible'> };

/** List each constrained pair once (a < b). */
export const listInconsistencies = (inconsistencies: Inconsistencies): InconsistencyEntry[] => {
  const seen = new Set<string>();
  const result: InconsistencyEntry[] = [];
  for (const [from, row] of Object.entries(inconsistencies)) {
    for (const to of Object.keys(row)) {
      const [a, b] = from < to ? [from, to] : [to, from];
      const key = `${a}\u0000${b}`;
      if (a === b || seen.has(key)) continue;
      seen.add(key);
      const state = getInconsistency(inconsistencies, a, b);
      if (typeof state === 'boolean') result.push({ a, b, type: state ? 'impossible' : 'unlikely' });
    }
  }
  return result;
};

/**
 * Return a symmetric copy without self-references or empty rows. When the two
 * directions disagree, `impossible` wins. Optionally keep only known value IDs.
 */
export const normalizeInconsistencies = (
  inconsistencies: Inconsistencies,
  knownValueIds?: Set<ID>,
): Inconsistencies => {
  const result: Inconsistencies = {};
  for (const [from, row] of Object.entries(inconsistencies || {})) {
    for (const [to, state] of Object.entries(row || {})) {
      if (from === to || typeof state !== 'boolean') continue;
      if (knownValueIds && (!knownValueIds.has(from) || !knownValueIds.has(to))) continue;
      const current = result[from]?.[to];
      setInconsistency(result, from, to, state || current === true ? 'impossible' : 'unlikely');
    }
  }
  return result;
};
