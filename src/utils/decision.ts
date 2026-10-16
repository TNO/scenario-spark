import type {
  Category,
  CourseOfAction,
  DataModel,
  DecisionLogEntry,
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
 * Template lines to render. Lines use `{componentId}` placeholders. A line that only
 * references decision factors is dropped when decision support is off, or when none
 * of its decisions has been chosen: decisions are listed in their own section.
 */
/** Show the decision-support page when it is enabled and there is a saved or an open scenario. */
export const hasDecisionSupportPage = (
  scenario?: Partial<Pick<Scenario, 'includeDecisionSupport' | 'narratives'>>,
  curNarrative?: Narrative,
) =>
  !!scenario?.includeDecisionSupport &&
  (!!curNarrative || (scenario.narratives || []).some((n) => n.saved));

export const visibleTemplateLines = (
  box: Box,
  lines: string[],
  selection: Record<ID, ID[]> = {},
) => {
  const decisionIds = new Set(splitDecisionComponents(box).decisions.map((c) => c.id));
  if (decisionIds.size === 0) return lines;
  const active = decisionSupportActive(box);
  return lines.filter((line) => {
    const ids = [...line.matchAll(/\{([^{}]+)\}/g)].map(([, id]) => id);
    if (ids.length === 0 || !ids.every((id) => decisionIds.has(id))) return true;
    return active && ids.some((id) => (selection[id] || []).length > 0);
  });
};

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
  const components = effectiveSelection(box, narrative, coaId);
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
  const selection = effectiveSelection(box, narrative);
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
  const decisionLines = factorLines(split.decisions, effectiveSelection(box, narrative, coa?.id));
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

/**
 * Situation plus the decisions of the active (or given) COA. Only values of the box's
 * current decision factors are taken from the COA, so stale COA values (e.g. after a
 * category is no longer a decision category) never override the situation.
 */
export const effectiveSelection = (
  box: Pick<Scenario, 'categories' | 'components'>,
  narrative: CoaNarrative,
  coaId?: ID,
): Narrative['components'] => {
  const coa = activeCoa(narrative, coaId);
  const { decisionIds } = splitDecisionComponents(box);
  const selection = { ...(narrative.components || {}) };
  for (const [id, values] of Object.entries(coa?.components || {})) {
    if (decisionIds.has(id)) selection[id] = values;
  }
  return selection;
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
 * Move COA selections of factors that are no longer decisions back to the situation: the
 * values of the active COA are used when the situation has no value for the factor (an
 * existing situation value is never overwritten); the factor is removed from every COA.
 * Returns true when the narrative changed.
 */
export const moveNonDecisionsToSituation = (
  box: Pick<Scenario, 'categories' | 'components'>,
  narrative: Pick<Narrative, 'components'> & Partial<Pick<Narrative, 'coas' | 'activeCoaId'>>,
) => {
  const { decisionIds } = splitDecisionComponents(box);
  const active = activeCoa(narrative);
  const components = (narrative.components ||= {});
  let changed = false;
  for (const id of Object.keys(active?.components || {})) {
    const values = active!.components[id];
    if (decisionIds.has(id) || !Array.isArray(values) || values.length === 0) continue;
    if (!(components[id]?.length > 0)) components[id] = [...values];
  }
  for (const coa of narrative.coas || []) {
    for (const id of Object.keys(coa.components || {})) {
      if (decisionIds.has(id)) continue;
      delete coa.components[id];
      changed = true;
    }
  }
  return changed;
};

/**
 * Bring a narrative in line with the box's decision categories: decision values in the
 * situation move to a COA, COA values of non-decision factors move back to the situation.
 * Idempotent; returns true when the narrative changed.
 */
export const syncNarrativeDecisions = (
  box: Pick<Scenario, 'categories' | 'components'>,
  narrative: Pick<Narrative, 'components'> & Partial<Pick<Narrative, 'coas' | 'activeCoaId'>>,
  makeId = randomId,
) => {
  const back = moveNonDecisionsToSituation(box, narrative);
  const forward = moveDecisionsToCoas(box, narrative, makeId);
  return back || forward;
};

/** Append an LLM reflection to the user's text, separated by a blank line. */
export const appendReflection = (existing: string | undefined, addition: string) => {
  const current = (existing || '').trimEnd();
  return current.trim() ? `${current}\n\n${addition}` : addition;
};

/**
 * The COA to store a reflection in, looked up in the latest narrative after an async
 * call: undefined when the narrative was switched or the COA was removed meanwhile.
 */
export const reflectionTarget = (
  latest: Partial<Pick<Narrative, 'id' | 'coas'>> | undefined,
  original: Partial<Pick<Narrative, 'id'>>,
  coaId: ID,
) => {
  if (!latest) return undefined;
  const same = latest === original || (!!original.id && latest.id === original.id);
  return same ? latest.coas?.find((c) => c.id === coaId) : undefined;
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
  reflection?: string;
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
      ...(coa.reflection?.trim() ? { reflection: coa.reflection } : {}),
    }))
    .filter((row) => row.decisions.length > 0 || row.notes || row.desc || row.reflection);
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

/** Scenarios selected for analysis, sorted by label. */
/**
 * Display name of a course of action: short labels (A, B1) get the prefix
 * ("Course of action A"), longer names (e.g. "Evacuate") are shown as is.
 */
export const coaTitle = (label: string | undefined, prefix: string) => {
  const name = (label || '').trim();
  return name.length > 0 && name.length <= 4 ? `${prefix} ${name}` : name || prefix;
};

export const selectedNarratives = <T extends Pick<Narrative, 'id' | 'label' | 'included'>>(narratives: T[]) =>
  comparedNarratives(narratives);

/** Narratives to compare: those included in the comparison plus the current (stored) one, sorted by label. */
export const comparedNarratives = <T extends Pick<Narrative, 'id' | 'label' | 'included'>>(narratives: T[], currentId?: ID) =>
  narratives
    .filter((n) => n.included || n.id === currentId)
    .sort((a, b) => (a.label || '').localeCompare(b.label || ''));

/** Scenarios for the robustness and risk views: the current one first, then the others selected for analysis. */
export const analysedNarratives = <T extends Pick<Narrative, 'id' | 'label' | 'included'>>(narratives: T[], current?: T) =>
  current ? [current, ...comparedNarratives(narratives).filter((n) => n.id !== current.id)] : comparedNarratives(narratives);

/** Narrative to compare: the selected one, else the current one, else the first (only compared narratives are passed). */
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
  /** Chosen in every one of several scenarios */
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
    selection: effectiveSelection(box, n),
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
        const robust = total > 1 && chosenCount === total;
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
    selection: effectiveSelection(box, n),
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

/** Translate a key with an optional sub-key, count or parameters (the app's `t`). */
export type Translator = (key: string, arg?: unknown) => string;

/** Plain-text explanation of a suggested value (`SUGGESTED_PICK`). */
export const suggestedPickText = (e: SuggestedExplanation, tr: Translator) =>
  tr('SUGGESTED_PICK', { count: e.chosenIn, total: e.total, weight: e.weight });

/** Plain-text reason why a value was skipped in the suggested approach. */
export const suggestedSkipText = (s: SuggestedSkip, tr: Translator) =>
  tr(s.reason === 'excluded' ? 'SUGGESTED_SKIPPED_EXCLUDED' : 'SUGGESTED_SKIPPED_CONFLICT', {
    value: s.label,
    causes: s.causes.join(', '),
  });

/** Plain-text reason why a factor has no suggested value. */
export const suggestedNoneText = (c: Pick<SuggestedComponent, 'reason'>, tr: Translator) =>
  tr(c.reason === 'excluded' ? 'SUGGESTED_NONE_EXCLUDED' : c.reason === 'conflict' ? 'SUGGESTED_NONE_CONFLICT' : 'SUGGESTED_NONE');

// Decision log

type LogNarrative = Pick<Narrative, 'id' | 'label'> & Partial<Pick<Narrative, 'coas'>>;
type LogBox = { narratives?: LogNarrative[]; decisionLog?: DecisionLogEntry[] };

/** User input for a decision log entry; blank optional text is not stored. */
export type DecisionLogInput = Pick<DecisionLogEntry, 'decision'> &
  Partial<Pick<DecisionLogEntry, 'narrativeId' | 'coaId' | 'rationale' | 'author'>>;

const isBlank = (s?: string) => !s || s.trim().length === 0;

/** Set the references (with their current labels) and the text of an entry from user input. */
const applyLogInput = (box: LogBox, entry: DecisionLogEntry, input: DecisionLogInput, keepRemoved: boolean) => {
  const storedNarrativeId = entry.narrativeId;
  const storedCoaId = entry.coaId;
  const narrative = (box.narratives || []).find((n) => n.id === input.narrativeId);
  const coa = narrative?.coas?.find((c) => c.id === input.coaId);
  // A reference to a removed scenario or COA is kept (with its stored label) while unchanged
  const keepNarrative = keepRemoved && !narrative && !!input.narrativeId && input.narrativeId === storedNarrativeId;
  const keepCoa =
    keepRemoved &&
    !coa &&
    !!input.coaId &&
    input.coaId === storedCoaId &&
    input.narrativeId === storedNarrativeId;
  if (narrative) {
    entry.narrativeId = narrative.id;
    entry.narrativeLabel = narrative.label;
  } else if (!keepNarrative) {
    delete entry.narrativeId;
    delete entry.narrativeLabel;
  }
  if (coa) {
    entry.coaId = coa.id;
    entry.coaLabel = coa.label;
  } else if (!keepCoa) {
    delete entry.coaId;
    delete entry.coaLabel;
  }
  entry.decision = input.decision;
  for (const key of ['rationale', 'author'] as const) {
    if (isBlank(input[key])) delete entry[key];
    else entry[key] = input[key];
  }
  return entry;
};

/**
 * Record a decision in the box's log (created when missing). The labels of the referenced
 * scenario and COA are stored, so the entry still makes sense after they are deleted.
 * Returns undefined (and changes nothing) when the decision text is blank.
 */
export const addDecisionLogEntry = (
  box: LogBox,
  input: DecisionLogInput,
  { now = Date.now(), makeId = randomId }: { now?: number; makeId?: () => ID } = {},
): DecisionLogEntry | undefined => {
  if (isBlank(input.decision)) return undefined;
  const entry = applyLogInput(box, { id: makeId(), timestamp: now, decision: '' }, input, false);
  (box.decisionLog ||= []).push(entry);
  return entry;
};

/**
 * Edit a log entry; the original timestamp is kept and `edited` is set. References to a
 * removed scenario or COA are kept (with their stored labels) as long as they are unchanged.
 */
export const updateDecisionLogEntry = (
  box: LogBox,
  id: ID,
  input: DecisionLogInput,
  { now = Date.now() }: { now?: number } = {},
): DecisionLogEntry | undefined => {
  const entry = box.decisionLog?.find((e) => e.id === id);
  if (!entry || isBlank(input.decision)) return undefined;
  applyLogInput(box, entry, input, true);
  entry.edited = now;
  return entry;
};

/** Remove a log entry; returns true when it existed. */
export const removeDecisionLogEntry = (box: LogBox, id: ID) => {
  const log = box.decisionLog || [];
  const index = log.findIndex((e) => e.id === id);
  if (index < 0) return false;
  log.splice(index, 1);
  return true;
};

/** Copy of the log, newest first (equal timestamps: last recorded first). */
export const sortDecisionLog = (log: DecisionLogEntry[] = []) =>
  log
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => b.entry.timestamp - a.entry.timestamp || b.index - a.index)
    .map(({ entry }) => entry);

export type DecisionLogRow = {
  entry: DecisionLogEntry;
  /** Current label of the scenario, else the stored one */
  narrativeLabel?: string;
  narrativeRemoved: boolean;
  coaLabel?: string;
  coaRemoved: boolean;
};

/** Log entries, newest first, with current labels and removed scenarios/COAs marked. */
export const decisionLogRows = (box: LogBox): DecisionLogRow[] =>
  sortDecisionLog(box.decisionLog).map((entry) => {
    const narrative = entry.narrativeId ? (box.narratives || []).find((n) => n.id === entry.narrativeId) : undefined;
    const coa = entry.coaId ? narrative?.coas?.find((c) => c.id === entry.coaId) : undefined;
    return {
      entry,
      narrativeLabel: narrative?.label ?? entry.narrativeLabel,
      narrativeRemoved: !!entry.narrativeId && !narrative,
      coaLabel: coa?.label ?? entry.coaLabel,
      coaRemoved: !!entry.coaId && !coa,
    };
  });

/** Locale-aware date and time of a log entry (falls back to English for unknown locales). */
export const formatLogTimestamp = (timestamp: number, locale?: string) => {
  const options: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' };
  try {
    return new Intl.DateTimeFormat(locale, options).format(timestamp);
  } catch {
    return new Intl.DateTimeFormat('en', options).format(timestamp);
  }
};

// Export of the comparison

/** Table cell: text, optionally with a risk level 0-4 (cell colour) */
export type ExportCell = string | { text: string; risk?: number };
export type ExportBlock =
  | { kind: 'heading'; level: 1 | 2; text: string }
  | { kind: 'paragraph'; text: string; italic?: boolean }
  | { kind: 'list'; items: string[] }
  | {
      kind: 'table';
      header: string[];
      /** `group` rows span the table (category or factor headers) */
      rows: Array<{ cells: ExportCell[]; group?: boolean }>;
    };
export type ComparisonExport = { title: string; blocks: ExportBlock[] };

export type ComparisonExportOptions = {
  /** Scenario whose COAs are compared and plotted (default: the first) */
  narrativeId?: ID;
  tr: Translator;
  formatDate: (timestamp: number) => string;
  now?: number;
};

type ExportBox = Box &
  Pick<Scenario, 'label'> &
  Partial<Pick<Scenario, 'criteriaWeights' | 'decisionLog'>> & { narratives?: LogNarrative[] };
type ExportNarrative = CoaNarrative &
  Pick<Narrative, 'id' | 'label'> &
  Partial<Pick<Narrative, 'risk' | 'probability' | 'impact'>>;

/**
 * Content of the Word export of the decision-support page as plain blocks (rendering is
 * separate): overview with suggested approach and its explanation, COA comparison of the
 * selected scenario with criteria scores, robustness grid, risk matrix and decision log.
 * Views that need decision categories are left out when the box has none, as on the page.
 */
export const buildComparisonExport = (
  box: ExportBox,
  narratives: ExportNarrative[],
  { narrativeId, tr, formatDate, now = Date.now() }: ComparisonExportOptions,
): ComparisonExport => {
  const blocks: ExportBlock[] = [];
  const heading = (text: string, level: 1 | 2 = 1) => blocks.push({ kind: 'heading', level, text });
  const paragraph = (text: string, italic?: boolean) =>
    blocks.push(italic ? { kind: 'paragraph', text, italic } : { kind: 'paragraph', text });
  const coaName = (label: string) => coaTitle(label, tr('COURSE_OF_ACTION'));
  const levelText = (key: string, id?: ID) => {
    const level = levelIndex(id);
    return level === undefined ? '' : tr(key, level);
  };
  const riskName = (level?: number) => (level === undefined ? tr('RISK_NOT_SET') : tr('RISK5', level));

  paragraph(tr('DECISION_EXPORT_DATE', { date: formatDate(now) }));

  const { decisions } = splitDecisionComponents(box);
  const hasDecisions = decisions.length > 0;
  const selectedId = comparisonNarrativeId(narratives, undefined, narrativeId);
  const selected = narratives.find((n) => n.id === selectedId);

  if (narratives.length === 0) {
    paragraph(tr('NO_INCLUDED_NARRATIVES'));
  } else {
    // Overview
    const suggestion = suggestApproach(box, narratives);
    const valueLabels = (component: ScenarioComponent, ids: ID[] = []) =>
      ids.map((id) => component.values?.find((v) => v.id === id)?.label || id).join(', ');
    heading(tr('DECISION_VIEW_OVERVIEW'));
    blocks.push({
      kind: 'table',
      header: [tr('NAME'), tr('PROBABILITY'), tr('IMPACT'), tr('RISK'), ...decisions.map((c) => c.label)],
      rows: [
        ...narratives.map((n) => {
          const coa = activeCoa(n);
          const selection = effectiveSelection(box, n);
          return {
            cells: [
              coa ? `${n.label} – ${coaName(coa.label)}` : n.label,
              levelText('PROB5', n.probability),
              levelText('IMP5', n.impact),
              levelText('RISK5', n.risk),
              ...decisions.map((c) => valueLabels(c, selection[c.id])),
            ],
          };
        }),
        {
          cells: [
            tr('SUGGESTED_APPROACH', 'TITLE'),
            '',
            '',
            '',
            ...decisions.map((c) => valueLabels(c, suggestion.selection[c.id])),
          ],
        },
      ],
    });

    if (hasDecisions) {
      heading(tr('SUGGESTED_WHY'), 2);
      paragraph(tr('SUGGESTED_HINT'), true);
      blocks.push({
        kind: 'list',
        items: suggestion.components.flatMap((c) => [
          ...(c.valueIds.length > 0
            ? c.explanations.map((e) => `${c.label}: ${e.label} – ${suggestedPickText(e, tr)}`)
            : [`${c.label}: ${suggestedNoneText(c, tr)}`]),
          ...c.skipped.map((s) => `${c.label}: ${suggestedSkipText(s, tr)}`),
        ]),
      });

      // COA comparison of the selected scenario
      heading(tr('DECISION_VIEW_COA'));
      if (selected) paragraph(`${tr('COMPARE_SCENARIO')}: ${selected.label}`);
      const { coas, groups } = coaComparisonRows(box, selected);
      if (!selected || coas.length === 0) {
        paragraph(tr('NO_COAS'));
      } else {
        const riskRows = coaRiskRows(selected);
        const showRisk = !!selected.risk || riskRows.some((r) => r.after !== undefined);
        const arrow = { lower: ' ↓', higher: ' ↑', same: ' →' };
        blocks.push({
          kind: 'table',
          header: [
            tr('DECISIONS'),
            ...coas.map((coa) => coaName(coa.label) + (coa.active ? ` (${tr('COA_ACTIVE')})` : '')),
          ],
          rows: [
            ...(showRisk
              ? [
                  { cells: [tr('RISK')], group: true },
                  {
                    cells: [
                      tr('RISK_BEFORE_AFTER'),
                      ...riskRows.map(
                        (row) =>
                          tr('RISK_TRANSITION', { before: riskName(row.before), after: riskName(row.after) }) +
                          (row.change ? arrow[row.change] : ''),
                      ),
                    ],
                  },
                ]
              : []),
            ...groups.flatMap((group) => [
              { cells: [group.label], group: true },
              ...group.rows.map((row) => ({
                cells: [
                  row.label,
                  ...row.cells.map((cell) =>
                    cell.values.length === 0
                      ? tr('NO_DECISION_SELECTED')
                      : cell.values.map((v) => (v.conflict ? `${v.label} ⚠` : v.label)).join(', '),
                  ),
                ],
              })),
            ]),
          ],
        });
        const conflicts = groups.flatMap((group) =>
          group.rows.flatMap((row) =>
            row.cells.flatMap((cell, i) =>
              cell.values
                .filter((v) => v.conflict)
                .map((v) => `${coaName(coas[i].label)}: ${tr('COA_CONFLICT', { value: v.label, situation: v.causes || '' })}`),
            ),
          ),
        );
        if (conflicts.length > 0) blocks.push({ kind: 'list', items: conflicts });

        const scores = coaScores(selected.coas || [], box.criteriaWeights);
        if (scores.used) {
          const byId = new Map((selected.coas || []).map((coa) => [coa.id, coa]));
          heading(tr('CRITERIA_SCORING'), 2);
          blocks.push({
            kind: 'table',
            header: [tr('CRITERIA_CRITERION'), tr('CRITERIA_WEIGHT'), ...scores.rows.map((row) => coaName(row.label))],
            rows: [
              ...COA_CRITERIA.map((criterion) => ({
                cells: [
                  tr('CRITERIA', criterion),
                  String(scores.weights[criterion]),
                  ...scores.rows.map((row) => {
                    const score = byId.get(row.id)?.scores?.[criterion];
                    return validNumber(score) ? String(score) : '–';
                  }),
                ],
              })),
              {
                cells: [
                  tr('CRITERIA_TOTAL'),
                  '',
                  ...scores.rows.map((row) =>
                    row.total === undefined
                      ? tr('CRITERIA_NOT_SCORED')
                      : tr('CRITERIA_TOTAL_OF', { total: row.total, max: row.max }) +
                        (row.missing > 0 ? ` (${tr('CRITERIA_MISSING', { count: row.missing })})` : ''),
                  ),
                ],
              },
              {
                cells: [
                  tr('CRITERIA_RANK'),
                  '',
                  ...scores.rows.map((row) => (row.rank === undefined ? '–' : String(row.rank))),
                ],
              },
            ],
          });
        }
      }

      // Robustness
      const grid = robustnessGrid(box, narratives);
      const total = grid.narratives.length;
      const symbol = (cell: RobustnessCell) =>
        cell.status === 'chosen' ? (cell.conflict ? '✓ ⚠' : '✓') : cell.status === 'excluded' ? '✗' : '–';
      heading(tr('DECISION_VIEW_ROBUSTNESS'));
      paragraph(tr('ROBUSTNESS_HINT'), true);
      paragraph(
        [
          `✓ ${tr('ROBUSTNESS_CHOSEN')}`,
          `✗ ${tr('ROBUSTNESS_EXCLUDED')}`,
          `– ${tr('ROBUSTNESS_UNUSED')}`,
          `⚠ ${tr('COA_HAS_CONFLICTS')}`,
          `★ ${tr('ROBUSTNESS_ROBUST')}`,
          `① ${tr('ROBUSTNESS_SPECIFIC')}`,
        ].join(' · '),
      );
      blocks.push({
        kind: 'table',
        header: [
          tr('ROBUSTNESS_MEASURE'),
          ...grid.narratives.map((n) => (n.coaLabel ? `${n.label} (${n.coaLabel})` : n.label)),
          tr('ROBUSTNESS_CHOSEN_IN'),
        ],
        rows: grid.groups.flatMap((group) => [
          { cells: [group.label], group: true },
          ...group.components.flatMap((component) => [
            { cells: [component.label], group: true },
            ...component.rows.map((row) => ({
              cells: [
                row.label,
                ...row.cells.map(symbol),
                tr('ROBUSTNESS_COUNT', { count: row.chosenCount, total }) +
                  (row.robust ? ' ★' : row.scenarioSpecific ? ' ①' : ''),
              ],
            })),
          ]),
        ]),
      });
    }

    // Risk matrix
    const matrix = riskMatrix(narratives, selectedId);
    const itemLabel = (mk: { kind: 'situation' | 'coa'; label: string }) =>
      mk.kind === 'coa' ? `${coaName(mk.label)}${selected ? ` (${selected.label})` : ''}` : mk.label;
    const levels = [0, 1, 2, 3, 4];
    heading(tr('DECISION_VIEW_RISK'));
    paragraph(tr('RISK_MATRIX_HINT'), true);
    blocks.push({
      kind: 'table',
      header: [`${tr('PROBABILITY')} / ${tr('IMPACT')}`, ...levels.map((i) => tr('IMP5', i))],
      rows: [...levels].reverse().map((p) => ({
        cells: [
          tr('PROB5', p),
          ...matrix.cells[p].map((cell) => ({ text: cell.markers.map((mk) => mk.marker).join(', '), risk: cell.risk })),
        ],
      })),
    });
    if (matrix.markers.length === 0) {
      paragraph(tr('RISK_MATRIX_EMPTY'));
    } else {
      blocks.push({
        kind: 'table',
        header: [tr('RISK_MATRIX_MARKER'), tr('RISK_MATRIX_ITEM'), tr('PROBABILITY'), tr('IMPACT'), tr('RISK')],
        rows: matrix.markers.map((mk) => ({
          cells: [mk.marker, itemLabel(mk), tr('PROB5', mk.probability), tr('IMP5', mk.impact), tr('RISK5', mk.risk)],
        })),
      });
    }
    if (matrix.unplaced.length > 0) {
      paragraph(tr('RISK_MATRIX_UNPLACED', { items: matrix.unplaced.map(itemLabel).join(', ') }));
    }
  }

  // Decision log
  heading(tr('DECISION_LOG'));
  const logRows = decisionLogRows(box);
  const removed = (label: string | undefined, isRemoved: boolean) =>
    label === undefined ? '' : isRemoved ? `${label} (${tr('DECISION_LOG_REMOVED')})` : label;
  if (logRows.length === 0) {
    paragraph(tr('DECISION_LOG_EMPTY'));
  } else {
    blocks.push({
      kind: 'table',
      header: [
        tr('DECISION_LOG_DATE'),
        tr('DECISION_LOG_SCENARIO'),
        tr('COURSE_OF_ACTION'),
        tr('DECISION_LOG_DECISION'),
        tr('DECISION_LOG_RATIONALE'),
        tr('DECISION_LOG_AUTHOR'),
      ],
      rows: logRows.map((row) => ({
        cells: [
          formatDate(row.entry.timestamp),
          removed(row.narrativeLabel, row.narrativeRemoved),
          removed(row.coaLabel, row.coaRemoved),
          row.entry.decision,
          row.entry.rationale || '',
          row.entry.author || '',
        ],
      })),
    });
  }

  return { title: `${tr('DECISION_EXPORT_TITLE')}: ${box.label}`, blocks };
};
