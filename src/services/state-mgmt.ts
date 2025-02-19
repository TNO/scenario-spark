import m, { FactoryComponent } from 'mithril';
import { meiosisSetup } from 'meiosis-setup';
import { i18n, routingSvc, t } from '.';
import {
  ContextualItem,
  Dashboards,
  DataModel,
  ID,
  Narrative,
  Scenario,
  defaultModel,
  thresholdColors,
} from '../models';
import { ldb } from '../utils/local-ldb';
import {
  MeiosisCell,
  Service,
  Update,
  MeiosisComponent as MComp,
} from 'meiosis-setup/types';
import { LANGUAGE, SAVED, scrollToTop, validateNarrative } from '../utils';
import { uniqueId } from 'mithril-materialized';

const MODEL_KEY = 'SG_MODEL';

export type State = {
  page: Dashboards;
  model: DataModel;
  title: string;
  language: string;
  activeTooltip?: string;
  /** Current narrative that we are working on */
  curNarrative?: Narrative;
  /** Components that have been excluded from the narrative */
  excludedComps?: Record<ID, boolean>;
  /** Components that have been given a fixed value in the narrative */
  lockedComps?: Record<ID, boolean>;
};

export type MeiosisComponent<T = {}> = FactoryComponent<MeiosisCell<State> & T>;

const setTitle = (title: string) => {
  document.title = `ScenarioSpark: ${title}`;
};

/* Actions */

export const setPage = (cell: MeiosisCell<State>, page: Dashboards): void => {
  scrollToTop();
  cell.update({ page });
};

export const changePage = (
  cell: MeiosisCell<State>,
  page: Dashboards,
  params?: Record<string, string | number | undefined>,
  query?: Record<string, string | number | undefined>
) => {
  routingSvc && routingSvc.switchTo(page, params, query);
  cell.update({ page });
};

const validateScenario = (scenario?: Scenario) => {
  if (!scenario) return false;
  if (!scenario.inconsistencies) scenario.inconsistencies = {};
  if (!scenario.categories) scenario.categories = [];
  if (!scenario.components) scenario.components = [];
  if (!scenario.narratives) scenario.narratives = [];
  scenario.narratives = scenario.narratives.map((n) =>
    validateNarrative(n, scenario.components)
  );
  if (typeof scenario.hideInconsistentValues === 'undefined') {
    scenario.hideInconsistentValues = true;
  }
  if (!scenario.thresholdColors) scenario.thresholdColors = thresholdColors;
  scenario.narratives.forEach((c) => {
    if (!c.components) c.components = {};
    if (!c.id) c.id = uniqueId();
    if (!c.label) c.label = 'UNKNOWN';
  });
  scenario.categories.forEach((c) => {
    if (!c.componentIds) c.componentIds = [];
    if (!c.id) c.id = uniqueId();
    if (!c.label) c.label = 'UNKNOWN';
  });
  scenario.components.forEach((c) => {
    if (!c.values) c.values = [];
    if (!c.id) c.id = uniqueId();
    if (!c.label) c.label = 'UNKNOWN';
  });
  return true;
};

export const saveModel = async (
  cell: MeiosisCell<State>,
  model: DataModel,
  reset = false
) => {
  localStorage.setItem(SAVED, 'false');
  model.lastUpdate = Date.now();
  if (!model.scenarios) {
    model.scenarios = [];
  }
  // console.log(JSON.stringify(model, null, 2));
  if (reset) {
    if (!validateScenario(model.scenario)) {
      alert(t('JSON_NOT_VALID'));
      return;
    }
    await ldb.set(MODEL_KEY, JSON.stringify(model));
    cell.update({
      model: () => model,
      activeTooltip: '',
      title: model.scenario.label,
      curNarrative: () => undefined,
      excludedComps: () => ({}),
      lockedComps: () => ({}),
    });
  } else {
    await ldb.set(MODEL_KEY, JSON.stringify(model));
    cell.update({ model: () => model });
  }
  localStorage.setItem(SAVED, 'false');
};

export const selectScenarioFromCollection = async (
  cell: MeiosisCell<State>,
  selectedScenarioId: ID
) => {
  const { model } = cell.getState();
  const { scenario: oldScenario, scenarios = [] } = model;
  const newScenario = scenarios.find((s) => s.id === selectedScenarioId);
  if (oldScenario && newScenario) {
    model.scenarios = [
      oldScenario,
      ...scenarios.filter((s) => s.id !== selectedScenarioId),
    ];
    model.scenario = newScenario;
    cell.update({
      model: () => model,
      activeTooltip: '',
      title: newScenario.label,
      curNarrative: () => undefined,
      excludedComps: () => ({}),
      lockedComps: () => ({}),
    });
    await ldb.set(MODEL_KEY, JSON.stringify(model));
  }
};

export const saveNarrative = async (
  cell: MeiosisCell<State>,
  curNarrative: Narrative
) => {
  const { model } = cell.getState();
  if (!curNarrative.id) curNarrative.id = uniqueId();
  if (!model.scenario.narratives) {
    curNarrative.saved = true;
    model.scenario.narratives = [curNarrative];
  } else {
    if (curNarrative.saved) {
      model.scenario.narratives = model.scenario.narratives.map((n) =>
        n.id !== curNarrative.id ? n : curNarrative
      );
    } else {
      curNarrative.saved = true;
      model.scenario.narratives.push(curNarrative);
    }
  }
  cell.update({ curNarrative: () => curNarrative });
  saveModel(cell, model);
};

export const updateNarrative = async (
  cell: MeiosisCell<State>,
  curNarrative: Narrative
) => {
  if (curNarrative.saved) {
    await saveNarrative(cell, curNarrative);
  }
  cell.update({ curNarrative });
};

export const mutateScenarioComponent = (
  cell: MeiosisCell<State>,
  scenarioComponentId: ID,
  item: ContextualItem,
  mutation: 'update' | 'create' | 'delete'
) => {
  const { model } = cell.state;
  const {
    scenario: { components },
  } = model;
  const comp = components.filter((c) => c.id === scenarioComponentId).shift();
  if (!comp) {
    console.error('Scenario component not found!');
    return;
  }
  const { values = [] } = comp;
  comp.values =
    mutation === 'update'
      ? values.map((c) => (c.id === item.id ? item : c))
      : mutation === 'delete'
      ? values.filter((c) => c.id !== item.id)
      : [...values, item];
  if (mutation === 'delete') {
    model.scenario.narratives = model.scenario.narratives.map((n) =>
      validateNarrative(n, model.scenario.components)
    );
  }
  saveModel(cell, model);
};

/** Move the position of a scenario component before or after another scenario component */
export const moveScenarioComponent = (
  cell: MeiosisCell<State>,
  componentId: ID,
  moveId: ID,
  dropId: ID,
  moveBefore: boolean
) => {
  const { model } = cell.state;
  const {
    scenario: { components },
  } = model;
  const comp = components.filter((c) => c.id === componentId).shift();
  if (!comp) {
    console.error('Scenario component not found!');
    return;
  }
  const { values = [] } = comp;
  const itemToMove = values.find((item) => item.id === moveId);
  if (!itemToMove) return;
  const itemDropped = values.find((item) => item.id === dropId);
  if (!itemDropped) return;

  comp.values = values
    .filter((i) => i.id !== moveId)
    .reduce((acc, cur) => {
      if (cur.id === dropId) {
        if (moveBefore) {
          acc.push(itemToMove);
          acc.push(cur);
        } else {
          acc.push(cur);
          acc.push(itemToMove);
        }
      } else {
        acc.push(cur);
      }
      return acc;
    }, [] as ContextualItem[]);
  saveModel(cell, model);
};

export const setLanguage = async (locale = i18n.currentLocale) => {
  localStorage.setItem(LANGUAGE, locale);
  await i18n.loadAndSetLocale(locale);
};
/* END OF Actions */

const initialize = async (update: Update<State>) => {
  const ds = await ldb.get(MODEL_KEY);
  const model = ds ? JSON.parse(ds) : defaultModel;
  const title = model.scenario?.label || '';
  setTitle(title);

  update({
    model: () => ({ ...model }),
    title,
  });
};

const service: Service<State> = {
  onchange: (state) => state.model?.scenario?.label,
  run: (cell) => {
    const title = cell.state.model?.scenario?.label;
    setTitle(title);
    cell.update({ title });
  },
};

const app: MComp<State> = {
  services: [service],
  initial: {
    title: '',
    page: Dashboards.HOME,
    model: defaultModel,
  },
};
export const cells = meiosisSetup<State>({ app });
initialize(cells().update);

cells.map(() => m.redraw());
