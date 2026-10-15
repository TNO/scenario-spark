import { setInconsistency } from 'morphological-box';
import type { Languages } from '../services/translations';
import type {
  Category,
  DataModel,
  Inconsistencies,
  Persona,
  Scenario,
  ScenarioComponent,
  ThresholdColor,
} from './data-model';

type FactorSpec = {
  id: string;
  label: string;
  desc: string;
  /** Chosen by a person (e.g. a measure), not generated; overrides the category */
  manual?: boolean;
  values: string[][];
};

type CategorySpec = {
  id: string;
  label: string;
  desc: string;
  /** All factors are chosen by a person, e.g. measures for decision support */
  manual?: boolean;
  /** Decision (measure) category: its factors are manual and used for decision support */
  decision?: boolean;
  factors: FactorSpec[];
};

export type BoxSpec = {
  id: string;
  label: string;
  desc: string;
  categories: CategorySpec[];
  exclusions: string[][];
  template: string;
  prompt: string;
  example: { label: string; desc: string; choices: string[] };
};

type StarterKitData = { effectsPrompt: string; personas: Persona[]; boxes: BoxSpec[] };

const personaSelections: Record<string, string[]> = {
  evenementenveiligheid: ['starter-event-visitor', 'starter-event-organiser', 'starter-nearby-resident', 'starter-reduced-mobility'],
  cybercontinuiteit: ['starter-it-specialist', 'starter-infra-operator', 'starter-small-business', 'starter-nurse'],
  hoogwater: ['starter-nearby-resident', 'starter-reduced-mobility', 'starter-farmer', 'starter-young-parent'],
  dijkdoorbraak: ['starter-nearby-resident', 'starter-reduced-mobility', 'starter-farmer', 'starter-local-official'],
  natuurbrand: ['starter-nearby-resident', 'starter-farmer', 'starter-traveller', 'starter-elderly-alone'],
  demonstraties: ['starter-protester', 'starter-nearby-resident', 'starter-small-business', 'starter-local-official', 'starter-student'],
  'publieke-gebouwen': ['starter-reduced-mobility', 'starter-young-parent', 'starter-teacher', 'starter-local-official'],
  'religieuze-centra': ['starter-community-leader', 'starter-young-parent', 'starter-elderly-alone', 'starter-nearby-resident'],
  havencontinuiteit: ['starter-infra-operator', 'starter-truck-driver', 'starter-small-business', 'starter-field-worker'],
  luchthavencontinuiteit: ['starter-traveller', 'starter-infra-operator', 'starter-small-business', 'starter-reduced-mobility'],
  earthquake: ['starter-nearby-resident', 'starter-reduced-mobility', 'starter-field-worker', 'starter-young-parent'],
  tsunami: ['starter-traveller', 'starter-nearby-resident', 'starter-reduced-mobility', 'starter-hospitality'],
  'volcanic-eruption': ['starter-farmer', 'starter-nearby-resident', 'starter-traveller', 'starter-nurse'],
  'landslide-avalanche': ['starter-traveller', 'starter-nearby-resident', 'starter-truck-driver', 'starter-field-worker'],
  'flash-flood': ['starter-nearby-resident', 'starter-young-parent', 'starter-truck-driver', 'starter-reduced-mobility', 'starter-taxi-driver'],
  storm: ['starter-nearby-resident', 'starter-field-worker', 'starter-truck-driver', 'starter-elderly-alone'],
  'extreme-temperature': ['starter-elderly-alone', 'starter-nurse', 'starter-field-worker', 'starter-young-parent'],
  drought: ['starter-farmer', 'starter-small-business', 'starter-nearby-resident', 'starter-local-official'],
  'epidemic-pandemic': ['starter-nurse', 'starter-elderly-alone', 'starter-teacher', 'starter-small-business', 'starter-student'],
  'animal-disease': ['starter-farmer', 'starter-truck-driver', 'starter-local-official', 'starter-small-business'],
  'insect-infestation': ['starter-farmer', 'starter-nearby-resident', 'starter-small-business'],
  'industrial-cbrn-accident': ['starter-nearby-resident', 'starter-nurse', 'starter-teacher', 'starter-field-worker'],
  'nuclear-radiological': ['starter-nearby-resident', 'starter-young-parent', 'starter-farmer', 'starter-nurse'],
  'air-accident': ['starter-traveller', 'starter-nearby-resident', 'starter-infra-operator', 'starter-nurse', 'starter-taxi-driver'],
  'rail-accident': ['starter-traveller', 'starter-nearby-resident', 'starter-reduced-mobility', 'starter-infra-operator', 'starter-taxi-driver'],
  'road-accident': ['starter-truck-driver', 'starter-young-parent', 'starter-nearby-resident', 'starter-nurse', 'starter-taxi-driver'],
  'maritime-accident': ['starter-traveller', 'starter-infra-operator', 'starter-nearby-resident', 'starter-taxi-driver'],
  'pipeline-gas-explosion': ['starter-nearby-resident', 'starter-field-worker', 'starter-small-business', 'starter-reduced-mobility'],
  'structure-collapse': ['starter-nearby-resident', 'starter-field-worker', 'starter-reduced-mobility', 'starter-young-parent'],
  'power-outage': ['starter-elderly-alone', 'starter-reduced-mobility', 'starter-nurse', 'starter-small-business', 'starter-infra-operator'],
  'telecom-failure': ['starter-elderly-alone', 'starter-it-specialist', 'starter-small-business', 'starter-nurse'],
  'water-contamination': ['starter-young-parent', 'starter-hospitality', 'starter-nurse', 'starter-elderly-alone'],
  'hazmat-spill': ['starter-truck-driver', 'starter-nearby-resident', 'starter-farmer', 'starter-field-worker'],
  'terrorist-explosive': ['starter-event-visitor', 'starter-traveller', 'starter-nearby-resident', 'starter-nurse', 'starter-taxi-driver'],
  'terrorist-cbrn': ['starter-traveller', 'starter-nurse', 'starter-nearby-resident', 'starter-young-parent'],
  'active-shooter': ['starter-teacher', 'starter-young-parent', 'starter-event-visitor', 'starter-small-business', 'starter-student'],
  'sabotage-infrastructure': ['starter-infra-operator', 'starter-it-specialist', 'starter-small-business', 'starter-elderly-alone'],
  'hostage-kidnapping': ['starter-teacher', 'starter-small-business', 'starter-community-leader', 'starter-nearby-resident'],
  'civil-unrest': ['starter-nearby-resident', 'starter-small-business', 'starter-protester', 'starter-local-official', 'starter-student'],
  'maritime-piracy': ['starter-infra-operator', 'starter-small-business', 'starter-traveller'],
  'drone-attack': ['starter-infra-operator', 'starter-event-visitor', 'starter-nearby-resident', 'starter-it-specialist'],
  'hybrid-threat': ['starter-local-official', 'starter-it-specialist', 'starter-infra-operator', 'starter-elderly-alone'],
  disinformation: ['starter-elderly-alone', 'starter-community-leader', 'starter-local-official', 'starter-protester', 'starter-student'],
  'supply-chain-disruption': ['starter-small-business', 'starter-truck-driver', 'starter-hospitality', 'starter-infra-operator'],
  arson: ['starter-nearby-resident', 'starter-small-business', 'starter-community-leader', 'starter-reduced-mobility'],
};

const files: Record<Languages, () => Promise<{ default: StarterKitData }>> = {
  // Vite serves JSON imports as JavaScript in dev; Node requires import attributes.
  nl: () => import.meta.env?.DEV
    ? import('./starter-kits/nl.json')
    : import('./starter-kits/nl.json', { with: { type: 'json' } }),
  en: () => import.meta.env?.DEV
    ? import('./starter-kits/en.json')
    : import('./starter-kits/en.json', { with: { type: 'json' } }),
  fr: () => import.meta.env?.DEV
    ? import('./starter-kits/fr.json')
    : import('./starter-kits/fr.json', { with: { type: 'json' } }),
  de: () => import.meta.env?.DEV
    ? import('./starter-kits/de.json')
    : import('./starter-kits/de.json', { with: { type: 'json' } }),
  es: () => import.meta.env?.DEV
    ? import('./starter-kits/es.json')
    : import('./starter-kits/es.json', { with: { type: 'json' } }),
  pl: () => import.meta.env?.DEV
    ? import('./starter-kits/pl.json')
    : import('./starter-kits/pl.json', { with: { type: 'json' } }),
};

export const createScenario = (
  box: BoxSpec,
  effectsPrompt: string,
  thresholdColors: ThresholdColor[]
): Scenario => {
  // Keep IDs identical across locales so translated kits never duplicate saved boxes.
  const id = `starter-nl-${box.id}`;
  const valueIds = new Map<string, string>();
  const categories: Category[] = box.categories.map((category) => ({
    // Separate namespace: a category may share its spec id with a factor
    id: `${id}-cat-${category.id}`,
    label: category.label,
    desc: category.desc,
    ...(category.decision ? { decisionSupport: true } : {}),
    componentIds: category.factors.map((factor) => `${id}-${factor.id}`),
  }));
  const components: ScenarioComponent[] = box.categories.flatMap((category) =>
    category.factors.map((factor) => ({
      id: `${id}-${factor.id}`,
      label: factor.label,
      desc: factor.desc,
      ...((category.decision || (factor.manual ?? category.manual)) ? { manual: true } : {}),
      values: factor.values.map(([value, label]) => {
        const valueId = `${id}-${factor.id}-${value}`;
        valueIds.set(`${factor.id}.${value}`, valueId);
        return { id: valueId, label };
      }),
    }))
  );
  const getValueId = (ref: string) => {
    const valueId = valueIds.get(ref);
    if (!valueId) throw new Error(`Unknown starter kit choice: ${id}/${ref}`);
    return valueId;
  };
  const inconsistencies: Inconsistencies = {};
  for (const [from, to] of box.exclusions) {
    setInconsistency(inconsistencies, getValueId(from), getValueId(to), 'impossible');
  }
  const selected = Object.fromEntries(
    box.example.choices.map((ref) => {
      const factor = ref.split('.')[0];
      return [`${id}-${factor}`, [getValueId(ref)]];
    })
  );
  return {
    id,
    label: box.label,
    desc: box.desc,
    template: box.template,
    hideInconsistentValues: true,
    includeDecisionSupport: false,
    personas: personaSelections[box.id] || [],
    inconsistencies,
    categories,
    components,
    narratives: [{
      id: `${id}-voorbeeld`,
      label: box.example.label,
      desc: box.example.desc,
      components: selected,
      included: true,
      saved: true,
      personaEffects: {},
    }],
    thresholdColors: thresholdColors.map((item) => ({ ...item })),
    llm: {
      id: 'clipboard',
      url: '',
      model: 'gemma3',
      temperature: 0.7,
      prompts: [{
        type: 'narrative',
        categories: categories.map(({ id }) => id),
        prompt: `${box.prompt} ${effectsPrompt}`,
      }],
    },
  };
};

export const loadStarterKit = async (
  language: Languages,
  thresholdColors: ThresholdColor[]
): Promise<DataModel> => {
  const file = files[language];
  if (!file) throw new Error(`Unsupported starter kit language: ${language}`);
  const { default: data } = await file();
  const scenarios = data.boxes.map((box) =>
    createScenario(box, data.effectsPrompt, thresholdColors)
  );
  const personaIds = new Set(data.personas.map(({ id }) => id));
  for (const scenario of scenarios) {
    for (const id of scenario.personas || []) {
      if (!personaIds.has(id)) throw new Error(`Unknown starter kit persona: ${id}`);
    }
  }
  return {
    version: 1,
    lastUpdate: Date.now(),
    scenario: scenarios[0],
    scenarios: scenarios.slice(1),
    personas: data.personas,
  };
};

export const addStarterKitToModel = (
  model: DataModel,
  starter: DataModel
): { model: DataModel; added: number; updated: number } => {
  const starterBoxes = [starter.scenario, ...starter.scenarios];
  const starterById = new Map(starterBoxes.map((box) => [box.id, box]));
  const existingIds = new Set([model.scenario, ...model.scenarios].map(({ id }) => id));
  const missing = starterBoxes.filter(({ id }) => !existingIds.has(id));
  // Existing starter boxes without a persona selection get the starter selection;
  // a selection made by the user is never replaced.
  let updated = 0;
  const withPersonas = (box: Scenario) => {
    const defaults = starterById.get(box.id)?.personas;
    if (box.personas?.length || !defaults?.length) return box;
    updated++;
    return { ...box, personas: [...defaults] };
  };
  const scenario = withPersonas(model.scenario);
  const scenarios = model.scenarios.map(withPersonas);
  const requiredPersonas = new Set(
    [...missing, scenario, ...scenarios].flatMap(({ personas }) => personas || [])
  );
  const existingPersonas = new Set((model.personas || []).map(({ id }) => id));
  const addedPersonas = (starter.personas || []).filter(
    ({ id }) => requiredPersonas.has(id) && !existingPersonas.has(id)
  );
  return {
    model:
      missing.length || updated
        ? {
            ...model,
            scenario,
            scenarios: [...scenarios, ...missing],
            personas: [...(model.personas || []), ...addedPersonas],
          }
        : model,
    added: missing.length,
    updated,
  };
};
