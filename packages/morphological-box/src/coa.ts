import { assessOptions, checkSelection, getBoxComponents, getDecisionComponentIds, type OptionStatus } from './generate.ts';
import type { CourseOfAction, ID, MorphologicalBox, Selection } from './types.ts';

/** Minimal course of action: a label and decision selections. */
export type CoaInput = Pick<CourseOfAction, 'label' | 'components'> & Partial<Pick<CourseOfAction, 'id' | 'desc'>>;

/** Narrative (situation) with optional courses of action, as stored by Scenario Spark. */
export type CoaNarrative<C extends CoaInput = CoaInput> = {
  /** Situation: selected value IDs per component ID */
  components?: Selection;
  coas?: C[];
  activeCoaId?: ID;
};

const coaLetters = (n: number): string =>
  (n >= 26 ? coaLetters(Math.floor(n / 26) - 1) : '') + String.fromCharCode(65 + (n % 26));

/** First free default COA label: A, B, ..., Z, AA, AB, ... */
export const nextCoaLabel = (coas: Array<Pick<CourseOfAction, 'label'>> = []) => {
  const used = new Set(coas.map((c) => c.label));
  for (let i = 0; ; i++) {
    const label = coaLetters(i);
    if (!used.has(label)) return label;
  }
};

/** The given COA (when `coaId` is set), else the active COA, else the first one. */
export const activeCoa = <C extends CoaInput>(narrative: Pick<CoaNarrative<C>, 'coas' | 'activeCoaId'>, coaId?: ID) => {
  const { coas = [], activeCoaId } = narrative;
  if (coaId) return coas.find((c) => c.id === coaId);
  return coas.find((c) => c.id === activeCoaId) || coas[0];
};

/** Situation plus the decisions of the active (or given) COA; the COA wins per component. */
export const effectiveSelection = (narrative: CoaNarrative, coaId?: ID): Selection => {
  const coa = activeCoa(narrative, coaId);
  return { ...(narrative.components || {}), ...(coa?.components || {}) };
};

export type CoaValueAssessment = {
  componentId: ID;
  componentLabel: string;
  /** True if the component belongs to a decision category */
  decision: boolean;
  id: ID;
  label: string;
  /** Status given the situation only */
  status: Exclude<OptionStatus, 'selected'>;
  /** Situation value IDs that make this value impossible (excluded) or unlikely */
  conflicts: ID[];
};

export type CoaAssessment = {
  id?: ID;
  label: string;
  /** Selected COA values in box order */
  values: CoaValueAssessment[];
  /** COA value IDs that are impossible given the situation */
  excluded: ID[];
  /** COA value IDs that are unlikely given the situation */
  unlikely: ID[];
  /** Impossible pairs within the COA itself */
  internalConflicts: Array<[ID, ID]>;
  /** True when nothing is excluded and there are no internal conflicts */
  consistent: boolean;
};

/**
 * Assess the decisions of a course of action against a situation: which COA
 * values are excluded (impossible) or unlikely given the situation, and which
 * COA values are impossible together. Built on `assessOptions`; unknown
 * component or value IDs are ignored.
 */
export const assessCoa = (box: MorphologicalBox, situation: Selection, coa: CoaInput): CoaAssessment => {
  const chosen = coa.components || {};
  const values: CoaValueAssessment[] = assessOptions(box, situation).flatMap((comp) =>
    (chosen[comp.componentId] || []).flatMap((id) => {
      const v = comp.values.find((value) => value.id === id);
      if (!v) return [];
      const status = v.status === 'selected' ? 'available' : v.status;
      return [{ componentId: comp.componentId, componentLabel: comp.label, decision: comp.decision, id, label: v.label, status, conflicts: v.conflicts }];
    }),
  );
  const internalConflicts = checkSelection(box, chosen).impossible;
  const excluded = values.filter((v) => v.status === 'excluded').map((v) => v.id);
  return {
    ...(coa.id !== undefined ? { id: coa.id } : {}),
    label: coa.label,
    values,
    excluded,
    unlikely: values.filter((v) => v.status === 'unlikely').map((v) => v.id),
    internalConflicts,
    consistent: excluded.length === 0 && internalConflicts.length === 0,
  };
};

export type CoaComparison = {
  /** Decision components, plus other components that a COA selects, in box order */
  components: Array<{ componentId: ID; label: string; decision: boolean }>;
  coas: CoaAssessment[];
};

/** Assess several courses of action for the same situation, for a side-by-side comparison. */
export const compareCoas = (box: MorphologicalBox, situation: Selection, coas: CoaInput[]): CoaComparison => {
  const decisions = getDecisionComponentIds(box);
  const used = new Set(coas.flatMap((c) => Object.keys(c.components || {})));
  return {
    components: getBoxComponents(box)
      .filter((c) => decisions.has(c.id) || used.has(c.id))
      .map((c) => ({ componentId: c.id, label: c.label, decision: decisions.has(c.id) })),
    coas: coas.map((coa) => assessCoa(box, situation, coa)),
  };
};
