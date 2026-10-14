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

type CoaNarrative = Pick<Narrative, 'components'> & Partial<Pick<Narrative, 'coas' | 'activeCoaId'>>;

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
