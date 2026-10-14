import type {
  Category,
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

/** Selected decisions of a narrative (factor label and value labels), empty when decision support is not active. */
export const narrativeDecisionRows = (box: Box, narrative?: Pick<Narrative, 'components'>) => {
  if (!box.includeDecisionSupport || !narrative?.components) return [];
  const { components } = narrative;
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
  narrative: Pick<Narrative, 'components'>;
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
  const selection = narrative.components || {};
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
