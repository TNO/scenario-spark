import type {
  Category,
  CourseOfAction,
  DataModel,
  ID,
  Narrative,
  Scenario,
  ScenarioComponent,
} from '../models';

type Box = Pick<Scenario, 'categories' | 'components'> &
  Partial<Pick<Scenario, 'includeDecisionSupport' | 'inconsistencies'>>;
type Selection = Record<ID, ID[] | undefined>;

export type DecisionSplit = {
  situationCategories: Category[];
  decisionCategories: Category[];
  /** Components of the situation (non-decision categories) */
  situation: ScenarioComponent[];
  /** Components of decision categories */
  decisions: ScenarioComponent[];
  decisionIds: Set<ID>;
};

/** Ids of the categories that are marked as decision categories. */
export const getDecisionCategoryIds = (box: Pick<Scenario, 'categories'>) =>
  new Set((box.categories || []).filter((c) => c.decisionSupport).map((c) => c.id));

/**
 * Split a box into situation and decision categories and components.
 * A component listed in several categories belongs to the first one (as in the
 * morphological-box package).
 */
export const splitDecisionComponents = (box: Box): DecisionSplit => {
  const { categories = [], components = [] } = box;
  const lookup = new Map(components.map((c) => [c.id, c]));
  const seen = new Set<ID>();
  const situation: ScenarioComponent[] = [];
  const decisions: ScenarioComponent[] = [];
  for (const category of categories) {
    for (const id of category.componentIds || []) {
      const component = lookup.get(id);
      if (!component || seen.has(id)) continue;
      seen.add(id);
      (category.decisionSupport ? decisions : situation).push(component);
    }
  }
  return {
    situationCategories: categories.filter((c) => !c.decisionSupport),
    decisionCategories: categories.filter((c) => c.decisionSupport),
    situation,
    decisions,
    decisionIds: new Set(decisions.map((c) => c.id)),
  };
};

/** Decision components are only used when decision support is on and the box has decision categories. */
export const decisionSupportActive = (box: Box) =>
  !!box.includeDecisionSupport && splitDecisionComponents(box).decisions.length > 0;

/**
 * Values to lock when generating a narrative: the locked components, the manual
 * situation components, and the decisions (never generated: the user's choice when
 * decision support is on, empty when it is off).
 */
export const generationLocks = (
  box: Box,
  selection: Selection = {},
  lockedComps: Record<ID, boolean | undefined> = {},
) => {
  const { decisionIds } = splitDecisionComponents(box);
  const active = !!box.includeDecisionSupport;
  const locks: Record<ID, ID[]> = {};
  for (const [id, isLocked] of Object.entries(lockedComps)) {
    if (isLocked && !decisionIds.has(id)) locks[id] = selection[id] || [];
  }
  for (const c of box.components || []) {
    if (decisionIds.has(c.id)) {
      locks[c.id] = active ? selection[c.id] || [] : [];
    } else if (c.manual) {
      locks[c.id] = selection[c.id] || [];
    }
  }
  return locks;
};

export type ExclusionCause = { componentId: ID; valueId: ID; label: string };

/**
 * For each decision value that is impossible given the selected situation values,
 * the situation value(s) that cause the exclusion.
 */
export const decisionExclusions = (box: Box, selection: Selection = {}) => {
  const { situation, decisions } = splitDecisionComponents(box);
  const inconsistencies = box.inconsistencies || {};
  const isImpossible = (a: ID, b: ID) =>
    inconsistencies[a]?.[b] === true || inconsistencies[b]?.[a] === true;
  const selected: ExclusionCause[] = situation.flatMap((c) =>
    (selection[c.id] || []).map((valueId) => ({
      componentId: c.id,
      valueId,
      label: c.values?.find((v) => v.id === valueId)?.label || valueId,
    })),
  );
  const result: Record<ID, ExclusionCause[]> = {};
  if (selected.length === 0) return result;
  for (const decision of decisions) {
    for (const value of decision.values || []) {
      const causes = selected.filter((s) => isImpossible(s.valueId, value.id));
      if (causes.length > 0) result[value.id] = causes;
    }
  }
  return result;
};

/**
 * Set `manual` on the components of categories that became decision categories
 * since `previousDecisionIds`. Unticking leaves `manual` as is.
 * Returns true when a component changed.
 */
export const applyDecisionCategoryManual = (
  box: Pick<Scenario, 'categories' | 'components'>,
  previousDecisionIds: Set<ID>,
) => {
  const ids = new Set<ID>();
  for (const category of box.categories || []) {
    if (category.decisionSupport && !previousDecisionIds.has(category.id)) {
      (category.componentIds || []).forEach((id) => ids.add(id));
    }
  }
  let changed = false;
  for (const component of box.components || []) {
    if (ids.has(component.id) && !component.manual) {
      component.manual = true;
      changed = true;
    }
  }
  return changed;
};

type CoaNarrative = Pick<Narrative, 'components'> & Partial<Pick<Narrative, 'coas' | 'activeCoaId' | 'risk'>>;

/** Selected decisions of a narrative's active (or given) COA (factor label and value labels), empty when decision support is not active. */
export const narrativeDecisionRows = (box: Box, narrative?: CoaNarrative, coaId?: ID) => {
  if (!box.includeDecisionSupport || !narrative?.components) return [];
  const components = effectiveSelection(narrative, coaId);
  return splitDecisionComponents(box)
    .decisions.map((c) => ({
      label: c.label,
      values: (components[c.id] || []).map(
        (id) => c.values?.find((v) => v.id === id)?.label || id,
      ),
    }))
    .filter((row) => row.values.length > 0);
};

/** Ask once per scenario whether to turn on decision support when it has decision categories. */
export const shouldPromptDecisionSupport = (
  scenario?: Pick<Scenario, 'categories' | 'includeDecisionSupport' | 'decisionSupportPrompted'>,
) =>
  !!scenario &&
  !scenario.includeDecisionSupport &&
  !scenario.decisionSupportPrompted &&
  getDecisionCategoryIds(scenario).size > 0;

/** Remember the answer to the decision-support prompt; `enable` turns decision support on. */
export const answerDecisionSupportPrompt = (
  scenario: Pick<Scenario, 'includeDecisionSupport' | 'decisionSupportPrompted'>,
  enable: boolean,
) => {
  scenario.decisionSupportPrompted = true;
  if (enable) scenario.includeDecisionSupport = true;
};

export type StoryInputKey = 'LLM_SITUATION' | 'LLM_SUGGESTED_ACTIONS' | 'LLM_NO_MEASURES_SELECTED';

export type StoryInputOptions = {
  box: Pick<Scenario, 'categories' | 'components'> & Partial<Pick<Scenario, 'includeDecisionSupport'>>;
  narrative: CoaNarrative;
  /** Ids of the categories included by the prompt */
  includedCategories: ID[];
  storyType?: 'narrative' | 'effect' | 'persona' | 'communications';
  /** Translation function for the section headings */
  tr: (key: StoryInputKey) => string;
};

const factorLines = (components: ScenarioComponent[], selection: Narrative['components']) =>
  components
    .filter((c) => Array.isArray(selection[c.id]) && selection[c.id].length > 0)
    .map((c) => {
      const values = selection[c.id]
        .map((id) => c.values?.find((v) => v.id === id))
        .filter((v) => v !== undefined)
        .map((v) => `${v.label}${v.desc ? ` (${v.desc})` : ''}`)
        .join(', ');
      return `- ${c.label}${c.desc ? ` (${c.desc})` : ''}: ${values}`;
    })
    .join('\n');

/**
 * The selected factors of a narrative as LLM input. Only categories included by the
 * prompt are used. When the box has decision categories, narrative and persona prompts
 * get a situation section and a suggested-actions section; without selected (or active)
 * decisions the actions section is replaced by a line saying no measures were selected.
 * Other prompt types get a plain list, without decisions when decision support is off.
 */
export const buildStoryInput = ({
  box,
  narrative,
  includedCategories,
  storyType = 'narrative',
  tr,
}: StoryInputOptions) => {
  const selection = effectiveSelection(narrative);
  const included = new Set(
    (box.categories || [])
      .filter((c) => includedCategories.includes(c.id))
      .flatMap((c) => c.componentIds || []),
  );
  const split = splitDecisionComponents(box);
  const active = decisionSupportActive(box);
  const situation = split.situation.filter((c) => included.has(c.id));
  const decisions = active ? split.decisions.filter((c) => included.has(c.id)) : [];
  // Components that are not part of any category keep their place in the plain list
  const ordered = (box.components || []).filter(
    (c) => included.has(c.id) && (!split.decisionIds.has(c.id) || active),
  );

  if (split.decisionCategories.length === 0 || (storyType !== 'narrative' && storyType !== 'persona')) {
    return factorLines(ordered, selection);
  }

  const situationLines = factorLines(situation, selection);
  const actionLines = factorLines(decisions, selection);
  return [
    situationLines && `${tr('LLM_SITUATION')}\n${situationLines}`,
    actionLines ? `${tr('LLM_SUGGESTED_ACTIONS')}\n${actionLines}` : tr('LLM_NO_MEASURES_SELECTED'),
  ]
    .filter(Boolean)
    .join('\n\n');
};

export type DecisionInputKey =
  | 'LLM_DECISION_SITUATION'
  | 'LLM_SCENARIO_TEXT'
  | 'LLM_COA_DECISIONS'
  | 'LLM_COA_NO_DECISIONS'
  | 'LLM_OTHER_COAS';

export type DecisionInputOptions = {
  box: Pick<Scenario, 'categories' | 'components'>;
  narrative: CoaNarrative;
  /** COA to assess; default the active COA */
  coaId?: ID;
  /** Ids of the categories included by the prompt; they filter the situation only. Default: all. */
  includedCategories?: ID[];
  /** Current narrative text */
  narrativeText?: string;
  /** Translation function for the section headings */
  tr: (key: DecisionInputKey, params?: Record<string, string>) => string;
};

/**
 * LLM input to reflect on one course of action: the situation (non-decision values and
 * the narrative text), the decisions of the COA factor by factor with all selected
 * values, and the labels of the other COAs for contrast.
 */
export const buildDecisionInput = ({
  box,
  narrative,
  coaId,
  includedCategories,
  narrativeText,
  tr,
}: DecisionInputOptions) => {
  const split = splitDecisionComponents(box);
  const included = includedCategories
    ? new Set(
        (box.categories || [])
          .filter((c) => includedCategories.includes(c.id))
          .flatMap((c) => c.componentIds || []),
      )
    : undefined;
  const situation = split.situation.filter((c) => !included || included.has(c.id));
  const coa = activeCoa(narrative, coaId);
  const label = coa?.label ?? nextCoaLabel([]);
  const situationLines = factorLines(situation, narrative.components || {});
  const decisionLines = factorLines(split.decisions, effectiveSelection(narrative, coa?.id));
  const others = (narrative.coas || [])
    .filter((c) => c !== coa)
    .map((c) => `- ${c.label}${c.desc ? `: ${c.desc}` : ''}`)
    .join('\n');
  return [
    situationLines && `${tr('LLM_DECISION_SITUATION')}\n${situationLines}`,
    narrativeText?.trim() && tr('LLM_SCENARIO_TEXT', { narrative: narrativeText.trim() }),
    decisionLines
      ? `${tr('LLM_COA_DECISIONS', { coa: label })}\n${decisionLines}`
      : tr('LLM_COA_NO_DECISIONS', { coa: label }),
    others && `${tr('LLM_OTHER_COAS')}\n${others}`,
  ]
    .filter(Boolean)
    .join('\n\n');
};

/** Version of the scenario data format: 2 = decisions are stored in courses of action. */
export const SCENARIO_DATA_VERSION = 2;

const randomId = () => Math.random().toString(36).slice(2, 10);

const coaLetters = (n: number): string =>
  (n >= 26 ? coaLetters(Math.floor(n / 26) - 1) : '') + String.fromCharCode(65 + (n % 26));

/** First free default COA label: A, B, ..., Z, AA, AB, ... */
export const nextCoaLabel = (coas: Pick<CourseOfAction, 'label'>[] = []) => {
  const used = new Set(coas.map((c) => c.label));
  for (let i = 0; ; i++) {
    const label = coaLetters(i);
    if (!used.has(label)) return label;
  }
};

/** The given COA (when `coaId` is set), else the active COA, else the first one. */
export const activeCoa = (narrative: Partial<Pick<Narrative, 'coas' | 'activeCoaId'>>, coaId?: ID) => {
  const { coas = [], activeCoaId } = narrative;
  if (coaId) return coas.find((c) => c.id === coaId);
  return coas.find((c) => c.id === activeCoaId) || coas[0];
};

/** Situation plus the decisions of the active (or given) COA. */
export const effectiveSelection = (narrative: CoaNarrative, coaId?: ID): Narrative['components'] => {
  const coa = activeCoa(narrative, coaId);
  return { ...(narrative.components || {}), ...(coa?.components || {}) };
};

/** Add an empty COA and make it active. */
export const addCoa = (narrative: Partial<Pick<Narrative, 'coas' | 'activeCoaId'>>, makeId = randomId) => {
  const coas = (narrative.coas ||= []);
  const coa: CourseOfAction = { id: makeId(), label: nextCoaLabel(coas), components: {} };
  coas.push(coa);
  narrative.activeCoaId = coa.id;
  return coa;
};

/** The active COA, creating COA "A" when the narrative has none. */
export const ensureActiveCoa = (narrative: Partial<Pick<Narrative, 'coas' | 'activeCoaId'>>, makeId = randomId) => {
  const coa = activeCoa(narrative);
  if (coa) {
    narrative.activeCoaId = coa.id;
    return coa;
  }
  return addCoa(narrative, makeId);
};

/** Copy the active COA (decisions and metadata) under a new label and make the copy active. */
export const duplicateCoa = (narrative: Partial<Pick<Narrative, 'coas' | 'activeCoaId'>>, makeId = randomId) => {
  const source = ensureActiveCoa(narrative, makeId);
  const coas = narrative.coas!;
  const copy: CourseOfAction = {
    ...JSON.parse(JSON.stringify(source)),
    id: makeId(),
    label: nextCoaLabel(coas),
  };
  coas.push(copy);
  narrative.activeCoaId = copy.id;
  return copy;
};

/** Remove a COA; the first remaining COA becomes active when the active one was removed. */
export const removeCoa = (narrative: Partial<Pick<Narrative, 'coas' | 'activeCoaId'>>, coaId: ID) => {
  narrative.coas = (narrative.coas || []).filter((c) => c.id !== coaId);
  if (!narrative.coas.some((c) => c.id === narrative.activeCoaId)) {
    narrative.activeCoaId = narrative.coas[0]?.id;
  }
};

/**
 * Move the decision selections in `narrative.components` into a COA: COA "A" when the
 * narrative has none, the active COA when it has no selection for these factors yet,
 * otherwise a new COA, so no selection is lost or overwritten.
 * Returns true when the narrative changed.
 */
export const moveDecisionsToCoas = (
  box: Pick<Scenario, 'categories' | 'components'>,
  narrative: Pick<Narrative, 'components'> & Partial<Pick<Narrative, 'coas' | 'activeCoaId'>>,
  makeId = randomId,
) => {
  const { decisionIds } = splitDecisionComponents(box);
  const components = narrative.components || {};
  const moved: Narrative['components'] = {};
  let changed = false;
  for (const id of Object.keys(components)) {
    if (!decisionIds.has(id)) continue;
    const values = components[id];
    if (Array.isArray(values) && values.length > 0) moved[id] = [...values];
    delete components[id];
    changed = true;
  }
  if (Object.keys(moved).length === 0) return changed;
  const target = activeCoa(narrative);
  if (!target) {
    addCoa(narrative, makeId).components = moved;
  } else if (Object.keys(moved).every((id) => !(target.components?.[id]?.length > 0))) {
    target.components = { ...(target.components || {}), ...moved };
  } else {
    const active = narrative.activeCoaId;
    addCoa(narrative, makeId).components = moved;
    narrative.activeCoaId = active ?? target.id;
  }
  return true;
};

/**
 * Migrate all scenarios of a model to the current data version: decisions selected in
 * narratives move into courses of action. Returns true when something changed.
 */
export const migrateModel = (model: Partial<Pick<DataModel, 'scenario' | 'scenarios'>>, makeId = randomId) => {
  let changed = false;
  for (const scenario of [model.scenario, ...(model.scenarios || [])]) {
    if (!scenario || (scenario.dataVersion || 1) >= SCENARIO_DATA_VERSION) continue;
    for (const narrative of scenario.narratives || []) {
      if (narrative?.components) moveDecisionsToCoas(scenario, narrative, makeId);
    }
    scenario.dataVersion = SCENARIO_DATA_VERSION;
    changed = true;
  }
  return changed;
};

export type CoaConflict = {
  componentId: ID;
  componentLabel: string;
  valueId: ID;
  label: string;
  causes: ExclusionCause[];
};

/** Selected decision values of a COA that are impossible given the situation of the narrative. */
export const coaConflicts = (
  box: Box,
  narrative: Pick<Narrative, 'components'>,
  coa?: Pick<CourseOfAction, 'components'>,
): CoaConflict[] => {
  if (!coa) return [];
  const exclusions = decisionExclusions(box, narrative.components);
  return splitDecisionComponents(box).decisions.flatMap((c) =>
    (coa.components?.[c.id] || [])
      .filter((valueId) => exclusions[valueId])
      .map((valueId) => ({
        componentId: c.id,
        componentLabel: c.label,
        valueId,
        label: c.values?.find((v) => v.id === valueId)?.label || valueId,
        causes: exclusions[valueId],
      })),
  );
};

export type CoaRow = {
  id?: ID;
  label: string;
  desc?: string;
  notes?: string;
  active: boolean;
  decisions: Array<{ label: string; values: string[] }>;
  conflicts: Array<{ label: string; situation: string }>;
  /** Situation risk (before) and residual risk (after) ids, only when the COA has a residual risk */
  risk?: { before?: ID; after: ID };
};

/**
 * Every course of action of a narrative with its decisions and the values that conflict
 * with the situation (show page, Word export). COAs without decisions and notes are
 * skipped; empty when decision support is off.
 */
export const narrativeCoaRows = (box: Box, narrative?: CoaNarrative): CoaRow[] => {
  if (!box.includeDecisionSupport || !narrative?.components) return [];
  const coas = narrative.coas || [];
  if (coas.length === 0) {
    const decisions = narrativeDecisionRows(box, narrative);
    return decisions.length > 0 ? [{ label: '', active: true, decisions, conflicts: [] }] : [];
  }
  const active = activeCoa(narrative);
  return coas
    .map((coa) => ({
      id: coa.id,
      label: coa.label,
      desc: coa.desc,
      notes: coa.notes,
      active: coa === active,
      decisions: narrativeDecisionRows(box, narrative, coa.id),
      conflicts: coaConflicts(box, narrative, coa).map((c) => ({
        label: c.label,
        situation: c.causes.map((s) => s.label).join(', '),
      })),
      ...(coa.risk ? { risk: { before: narrative.risk, after: coa.risk } } : {}),
    }))
    .filter((row) => row.decisions.length > 0 || row.notes || row.desc);
};

/**
 * Decision categories with the decision components they own (a component listed in
 * several categories belongs to the first one, as in `splitDecisionComponents`).
 */
const decisionGroups = (box: Box) => {
  const { decisionCategories, decisions } = splitDecisionComponents(box);
  const owner = new Map<ID, ID>();
  for (const category of box.categories || []) {
    for (const id of category.componentIds || []) if (!owner.has(id)) owner.set(id, category.id);
  }
  return decisionCategories
    .map((category) => ({
      category,
      components: decisions.filter((c) => owner.get(c.id) === category.id),
    }))
    .filter((g) => g.components.length > 0);
};

const causeLabels = (causes?: ExclusionCause[]) =>
  causes && causes.length > 0 ? causes.map((c) => c.label).join(', ') : undefined;

/** Narrative to compare: the selected one, else the current one, else the first (only included narratives are passed). */
export const comparisonNarrativeId = (narratives: Array<Pick<Narrative, 'id'>>, currentId?: ID, selectedId?: ID) =>
  [selectedId, currentId].find((id) => id && narratives.some((n) => n.id === id)) || narratives[0]?.id;

export type CoaComparisonValue = { id: ID; label: string; conflict: boolean; causes?: string };
export type CoaComparisonCell = { values: CoaComparisonValue[]; conflict: boolean };
export type CoaComparisonRow = { id: ID; label: string; cells: CoaComparisonCell[]; same: boolean };
export type CoaComparison = {
  coas: Array<{ id: ID; label: string; desc?: string; active: boolean; conflicts: number }>;
  groups: Array<{ id: ID; label: string; rows: CoaComparisonRow[] }>;
};

/**
 * Compare the courses of action of one situation: COAs as columns, decision components
 * (grouped by decision category) as rows. Values that conflict with the situation are
 * marked; `differencesOnly` hides rows where all COAs select the same values.
 */
export const coaComparisonRows = (
  box: Box,
  narrative?: CoaNarrative,
  { differencesOnly = false }: { differencesOnly?: boolean } = {},
): CoaComparison => {
  const coas = narrative?.coas || [];
  if (!narrative || coas.length === 0) return { coas: [], groups: [] };
  const active = activeCoa(narrative);
  const exclusions = decisionExclusions(box, narrative.components);
  const key = (ids: ID[] = []) => [...ids].sort().join('\u0000');
  const groups = decisionGroups(box)
    .map(({ category, components }) => ({
      id: category.id,
      label: category.label,
      rows: components
        .map((component) => {
          const cells = coas.map((coa) => {
            const values = (coa.components?.[component.id] || []).map((id) => {
              const causes = causeLabels(exclusions[id]);
              const value: CoaComparisonValue = {
                id,
                label: component.values?.find((v) => v.id === id)?.label || id,
                conflict: !!causes,
              };
              if (causes) value.causes = causes;
              return value;
            });
            return { values, conflict: values.some((v) => v.conflict) };
          });
          const first = key(coas[0].components?.[component.id]);
          const same = coas.every((coa) => key(coa.components?.[component.id]) === first);
          return { id: component.id, label: component.label, cells, same };
        })
        .filter((row) => !differencesOnly || !row.same),
    }))
    .filter((group) => group.rows.length > 0);
  return {
    coas: coas.map((coa) => ({
      id: coa.id,
      label: coa.label,
      desc: coa.desc,
      active: coa === active,
      conflicts: coaConflicts(box, narrative, coa).length,
    })),
    groups,
  };
};

export type RobustnessStatus = 'chosen' | 'excluded' | 'unused';
export type RobustnessCell = { status: RobustnessStatus; conflict?: boolean; causes?: string };
export type RobustnessRow = {
  id: ID;
  label: string;
  cells: RobustnessCell[];
  chosenCount: number;
  /** Chosen in every scenario */
  robust: boolean;
  /** Chosen in exactly one of several scenarios */
  scenarioSpecific: boolean;
};
export type RobustnessGrid = {
  narratives: Array<{ id: ID; label: string; coaLabel?: string }>;
  groups: Array<{
    id: ID;
    label: string;
    components: Array<{ id: ID; label: string; rows: RobustnessRow[] }>;
  }>;
  robustCount: number;
};

/**
 * Which measures hold up across scenarios: per decision value and narrative, whether the
 * active COA chooses it, the situation excludes it, or it is unused. A chosen value that
 * is also excluded stays chosen and is flagged as a conflict.
 */
export const robustnessGrid = (box: Box, narratives: Array<CoaNarrative & Pick<Narrative, 'id' | 'label'>>): RobustnessGrid => {
  const columns = narratives.map((n) => ({
    selection: effectiveSelection(n),
    exclusions: decisionExclusions(box, n.components),
  }));
  const total = narratives.length;
  let robustCount = 0;
  const groups = decisionGroups(box).map(({ category, components }) => ({
    id: category.id,
    label: category.label,
    components: components.map((component) => ({
      id: component.id,
      label: component.label,
      rows: (component.values || []).map((value) => {
        const cells = columns.map(({ selection, exclusions }): RobustnessCell => {
          const causes = causeLabels(exclusions[value.id]);
          if ((selection[component.id] || []).includes(value.id)) {
            return causes ? { status: 'chosen', conflict: true, causes } : { status: 'chosen' };
          }
          return causes ? { status: 'excluded', causes } : { status: 'unused' };
        });
        const chosenCount = cells.filter((c) => c.status === 'chosen').length;
        const robust = total > 0 && chosenCount === total;
        if (robust) robustCount++;
        return {
          id: value.id,
          label: value.label,
          cells,
          chosenCount,
          robust,
          scenarioSpecific: total > 1 && chosenCount === 1,
        };
      }),
    })),
  }));
  return {
    narratives: narratives.map((n) => ({ id: n.id, label: n.label, coaLabel: activeCoa(n)?.label })),
    groups,
    robustCount,
  };
};

/** Default weight of a narrative in the suggested approach: its risk level, 1 (very low) to 5 (very high). */
export const riskWeight = (narrative: Partial<Pick<Narrative, 'risk'>>) => {
  const level = +String(narrative.risk || '0').replace('risk_', '');
  return (Number.isFinite(level) ? level : 0) + 1;
};

export type SuggestedExplanation = {
  valueId: ID;
  label: string;
  /** Number of scenarios whose active COA chose the value */
  chosenIn: number;
  /** Number of compared scenarios */
  total: number;
  /** Sum of the weights of the scenarios that chose the value */
  weight: number;
};
export type SuggestedSkip = {
  valueId: ID;
  label: string;
  /** `excluded`: impossible in every compared situation; `conflict`: impossible together with a stronger pick */
  reason: 'excluded' | 'conflict';
  causes: string[];
};
export type SuggestedComponent = {
  componentId: ID;
  label: string;
  valueIds: ID[];
  explanations: SuggestedExplanation[];
  /** Values that scored at least as high as the pick (or any value when nothing was picked) but were skipped */
  skipped: SuggestedSkip[];
  /** Why nothing was picked: no scenario chose a value, or every candidate was excluded / conflicting */
  reason?: 'none' | 'excluded' | 'conflict';
};
export type SuggestedApproach = {
  total: number;
  components: SuggestedComponent[];
  selection: Record<ID, ID[]>;
};
export type SuggestApproachOptions = {
  /** Weight per narrative (same order) or a function; default `riskWeight` */
  weights?: number[] | ((narrative: CoaNarrative & Partial<Pick<Narrative, 'risk'>>, index: number) => number);
};

/**
 * Suggested approach over the included narratives: per decision component, the values
 * with the highest weighted count over the narratives' active COAs (weight: risk level
 * 1–5 by default), all tied values included. The suggestion stays consistent:
 * - values that are impossible in every compared situation are skipped;
 * - values that are impossible together with a picked value are skipped; candidates are
 *   processed by weight (desc), then component order, then value order in the box, so the
 *   stronger value wins and the component falls back to its next best consistent value.
 * Unlikely pairs neither block nor change the order: they are a judgement call for the user.
 * Value ids that are not in the box are ignored.
 */
export const suggestApproach = (
  box: Box,
  narratives: Array<CoaNarrative & Partial<Pick<Narrative, 'risk'>>>,
  { weights }: SuggestApproachOptions = {},
): SuggestedApproach => {
  const total = narratives.length;
  const weightOf = (n: (typeof narratives)[number], i: number) =>
    Array.isArray(weights) ? weights[i] ?? riskWeight(n) : weights ? weights(n, i) : riskWeight(n);
  const columns = narratives.map((n, i) => ({
    selection: effectiveSelection(n),
    exclusions: decisionExclusions(box, n.components),
    weight: weightOf(n, i),
  }));
  const inconsistencies = box.inconsistencies || {};
  const isImpossible = (a: ID, b: ID) =>
    inconsistencies[a]?.[b] === true || inconsistencies[b]?.[a] === true;

  const { decisions } = splitDecisionComponents(box);
  const results: SuggestedComponent[] = decisions.map((c) => ({
    componentId: c.id,
    label: c.label,
    valueIds: [],
    explanations: [],
    skipped: [],
  }));
  type Candidate = SuggestedExplanation & { comp: number; order: number };
  const candidates: Candidate[] = decisions.flatMap((component, comp) =>
    (component.values || []).flatMap((value, order) => {
      let chosenIn = 0;
      let weight = 0;
      for (const col of columns) {
        if ((col.selection[component.id] || []).includes(value.id)) {
          chosenIn++;
          weight += col.weight;
        }
      }
      return chosenIn > 0 ? [{ valueId: value.id, label: value.label, chosenIn, total, weight, comp, order }] : [];
    }),
  );
  candidates.sort((a, b) => b.weight - a.weight || a.comp - b.comp || a.order - b.order);

  const pickWeight = new Map<number, number>();
  const picked: Candidate[] = [];
  for (const candidate of candidates) {
    const { comp, valueId, label, weight } = candidate;
    const tier = pickWeight.get(comp);
    if (tier !== undefined && weight < tier) continue;
    const result = results[comp];
    if (total > 0 && columns.every((col) => col.exclusions[valueId])) {
      const causes = [...new Set(columns.flatMap((col) => col.exclusions[valueId].map((e) => e.label)))];
      result.skipped.push({ valueId, label, reason: 'excluded', causes });
      continue;
    }
    const conflicts = picked.filter((p) => isImpossible(p.valueId, valueId));
    if (conflicts.length > 0) {
      result.skipped.push({ valueId, label, reason: 'conflict', causes: conflicts.map((p) => p.label) });
      continue;
    }
    pickWeight.set(comp, weight);
    picked.push(candidate);
    result.valueIds.push(valueId);
    result.explanations.push({ valueId, label, chosenIn: candidate.chosenIn, total, weight });
  }

  for (const result of results) {
    if (result.valueIds.length > 0) continue;
    result.reason =
      result.skipped.length === 0
        ? 'none'
        : result.skipped.every((s) => s.reason === 'excluded')
        ? 'excluded'
        : 'conflict';
  }
  return {
    total,
    components: results,
    selection: Object.fromEntries(results.map((r) => [r.componentId, r.valueIds])),
  };
};

/** Risk level per probability (row) and impact (column), both 0 (very low) to 4 (very high). */
export const RISK_MATRIX: readonly (readonly number[])[] = [
  [0, 0, 1, 2, 3],
  [0, 1, 2, 3, 4],
  [1, 2, 3, 4, 4],
  [2, 3, 4, 4, 4],
  [3, 4, 4, 4, 4],
];

/** Level 0-4 of a `probability_N`, `impact_N` or `risk_N` id; undefined when missing or invalid. */
export const levelIndex = (id?: ID) => {
  if (typeof id !== 'string') return undefined;
  const match = /^[a-zA-Z_]*(\d+)$/.exec(id);
  const level = match ? +match[1] : NaN;
  return level >= 0 && level <= 4 ? level : undefined;
};

/** Risk id (`risk_N`) for a probability and impact id, or undefined when one is missing. */
export const riskLevel = (probability?: ID, impact?: ID): ID | undefined => {
  const p = levelIndex(probability);
  const i = levelIndex(impact);
  return p === undefined || i === undefined ? undefined : `risk_${RISK_MATRIX[p][i]}`;
};

/** Set `risk` from `probability` and `impact` (narrative or course of action); unchanged when one is missing. */
export const updateRisk = (item: { probability?: ID; impact?: ID; risk?: ID }) => {
  const risk = riskLevel(item.probability, item.impact);
  if (risk) item.risk = risk;
  return item;
};

export type RiskChange = 'lower' | 'same' | 'higher';

export type CoaRiskRow = {
  id: ID;
  label: string;
  active: boolean;
  /** Situation risk level 0-4 */
  before?: number;
  /** Residual risk level 0-4 after the course of action */
  after?: number;
  /** Only when both levels are known */
  change?: RiskChange;
};

/** Risk before (situation) and after (residual) for each course of action of a narrative. */
export const coaRiskRows = (narrative: CoaNarrative): CoaRiskRow[] => {
  const coas = narrative.coas || [];
  const active = activeCoa(narrative);
  const before = levelIndex(narrative.risk);
  return coas.map((coa) => {
    const after = levelIndex(coa.risk);
    return {
      id: coa.id,
      label: coa.label,
      active: coa === active,
      before,
      after,
      change:
        before === undefined || after === undefined
          ? undefined
          : after < before
          ? 'lower'
          : after > before
          ? 'higher'
          : 'same',
    };
  });
};

export type RiskMarker = {
  kind: 'situation' | 'coa';
  /** Short text on the matrix: scenario number (1-based) or COA label */
  marker: string;
  label: string;
  narrativeId: ID;
  coaId?: ID;
  probability: number;
  impact: number;
  risk: number;
};

export type RiskMatrixCell = { probability: number; impact: number; risk: number; markers: RiskMarker[] };

export type RiskMatrixData = {
  /** cells[probability][impact], both 0-4 */
  cells: RiskMatrixCell[][];
  markers: RiskMarker[];
  /** Scenarios and COAs without probability or impact */
  unplaced: Array<Pick<RiskMarker, 'kind' | 'marker' | 'label' | 'narrativeId' | 'coaId'>>;
};

type RiskNarrative = CoaNarrative & Pick<Narrative, 'id' | 'label'> & Partial<Pick<Narrative, 'probability' | 'impact'>>;

/**
 * 5x5 risk matrix with the scenarios (situation risk, numbered in the given order) and,
 * for the selected scenario, its courses of action (residual risk, by COA label).
 */
export const riskMatrix = (narratives: RiskNarrative[], selectedId?: ID): RiskMatrixData => {
  const cells: RiskMatrixCell[][] = RISK_MATRIX.map((row, probability) =>
    row.map((risk, impact) => ({ probability, impact, risk, markers: [] })),
  );
  const markers: RiskMarker[] = [];
  const unplaced: RiskMatrixData['unplaced'] = [];
  const place = (
    item: { probability?: ID; impact?: ID },
    base: Pick<RiskMarker, 'kind' | 'marker' | 'label' | 'narrativeId' | 'coaId'>,
  ) => {
    const probability = levelIndex(item.probability);
    const impact = levelIndex(item.impact);
    if (probability === undefined || impact === undefined) {
      unplaced.push(base);
      return;
    }
    const marker: RiskMarker = { ...base, probability, impact, risk: RISK_MATRIX[probability][impact] };
    markers.push(marker);
    cells[probability][impact].markers.push(marker);
  };
  narratives.forEach((n, index) =>
    place(n, { kind: 'situation', marker: String(index + 1), label: n.label, narrativeId: n.id }),
  );
  const selected = narratives.find((n) => n.id === selectedId);
  for (const coa of selected?.coas || []) {
    place(coa, { kind: 'coa', marker: coa.label, label: coa.label, narrativeId: selected!.id, coaId: coa.id });
  }
  return { cells, markers, unplaced };
};

/** Criteria to score courses of action (translation keys `CRITERIA.<id>`). */
export const COA_CRITERIA = ['effect', 'speed', 'capacity', 'safety', 'legality', 'acceptance'] as const;
export type CoaCriterion = (typeof COA_CRITERIA)[number];

/** Highest score per criterion; scores run from 1 (poor) to 5 (good). */
export const MAX_CRITERION_SCORE = 5;

export type CoaScoreRow = {
  id: ID;
  label: string;
  /** Weighted sum of the scores; undefined when the COA has no scored criterion with weight > 0 */
  total?: number;
  /** Highest possible total with the current weights */
  max: number;
  /** Number of criteria with weight > 0 that are not scored */
  missing: number;
  /** 1 = best; ties share a rank; undefined without a total */
  rank?: number;
};

export type CoaScores = {
  /** Effective weight per criterion (missing = 1) */
  weights: Record<CoaCriterion, number>;
  rows: CoaScoreRow[];
  /** True when weights are set or any COA has a score */
  used: boolean;
};

const validNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

/** Weighted criteria score per course of action: sum of weight x score, ranked high to low. */
export const coaScores = (
  coas: Array<Pick<CourseOfAction, 'id' | 'label' | 'scores'>>,
  criteriaWeights?: { [criterion: string]: number },
): CoaScores => {
  const weights = Object.fromEntries(
    COA_CRITERIA.map((c) => {
      const w = criteriaWeights?.[c];
      return [c, validNumber(w) && w > 0 ? w : validNumber(w) ? 0 : 1];
    }),
  ) as Record<CoaCriterion, number>;
  const max = COA_CRITERIA.reduce((acc, c) => acc + weights[c] * MAX_CRITERION_SCORE, 0);
  const rows: CoaScoreRow[] = coas.map((coa) => {
    let total: number | undefined;
    let missing = 0;
    for (const c of COA_CRITERIA) {
      if (weights[c] === 0) continue;
      const score = coa.scores?.[c];
      if (!validNumber(score)) {
        missing++;
        continue;
      }
      total = (total || 0) + weights[c] * score;
    }
    return { id: coa.id, label: coa.label, total, max, missing };
  });
  for (const row of rows) {
    if (row.total === undefined) continue;
    row.rank = 1 + rows.filter((r) => r.total !== undefined && r.total > row.total!).length;
  }
  const used =
    (!!criteriaWeights && Object.keys(criteriaWeights).length > 0) ||
    coas.some((coa) => coa.scores && Object.values(coa.scores).some(validNumber));
  return { weights, rows, used };
};
