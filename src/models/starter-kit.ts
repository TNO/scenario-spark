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
  values: string[][];
};

type CategorySpec = {
  id: string;
  label: string;
  desc: string;
  factors: FactorSpec[];
};

type BoxSpec = {
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
  evenementenveiligheid: [
    'starter-event-visitor',
    'starter-nearby-resident',
    'starter-event-organiser',
  ],
  hoogwater: ['starter-nearby-resident'],
  dijkdoorbraak: ['starter-nearby-resident'],
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

const createScenario = (
  box: BoxSpec,
  effectsPrompt: string,
  thresholdColors: ThresholdColor[]
): Scenario => {
  // Keep IDs identical across locales so translated kits never duplicate saved boxes.
  const id = `starter-nl-${box.id}`;
  const valueIds = new Map<string, string>();
  const categories: Category[] = box.categories.map((category) => ({
    id: `${id}-${category.id}`,
    label: category.label,
    desc: category.desc,
    componentIds: category.factors.map((factor) => `${id}-${factor.id}`),
  }));
  const components: ScenarioComponent[] = box.categories.flatMap((category) =>
    category.factors.map((factor) => ({
      id: `${id}-${factor.id}`,
      label: factor.label,
      desc: factor.desc,
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
    const fromId = getValueId(from);
    inconsistencies[fromId] ??= {};
    inconsistencies[fromId][getValueId(to)] = true;
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
): { model: DataModel; added: number } => {
  const existingIds = new Set([model.scenario, ...model.scenarios].map(({ id }) => id));
  const missing = [starter.scenario, ...starter.scenarios].filter(
    ({ id }) => !existingIds.has(id)
  );
  const requiredPersonas = new Set(missing.flatMap(({ personas }) => personas || []));
  const existingPersonas = new Set((model.personas || []).map(({ id }) => id));
  const addedPersonas = (starter.personas || []).filter(
    ({ id }) => requiredPersonas.has(id) && !existingPersonas.has(id)
  );
  return {
    model: missing.length
      ? {
          ...model,
          scenarios: [...model.scenarios, ...missing],
          personas: [...(model.personas || []), ...addedPersonas],
        }
      : model,
    added: missing.length,
  };
};
