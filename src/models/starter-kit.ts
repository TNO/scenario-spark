import type { Languages } from '../services/translations';
import type {
  Category,
  DataModel,
  Inconsistencies,
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

type StarterKitData = { effectsPrompt: string; boxes: BoxSpec[] };

// Node imports JSON directly; Vite serves JSON imports as JavaScript modules in the browser.
const jsonImportOptions = typeof window === 'undefined'
  ? { with: { type: 'json' } } as const
  : undefined;

const files: Record<Languages, () => Promise<{ default: StarterKitData }>> = {
  nl: () => import('./starter-kits/nl.json', jsonImportOptions),
  en: () => import('./starter-kits/en.json', jsonImportOptions),
  fr: () => import('./starter-kits/fr.json', jsonImportOptions),
  de: () => import('./starter-kits/de.json', jsonImportOptions),
  es: () => import('./starter-kits/es.json', jsonImportOptions),
  pl: () => import('./starter-kits/pl.json', jsonImportOptions),
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
  return {
    version: 1,
    lastUpdate: Date.now(),
    scenario: scenarios[0],
    scenarios: scenarios.slice(1),
    personas: [],
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
  return {
    model: missing.length ? { ...model, scenarios: [...model.scenarios, ...missing] } : model,
    added: missing.length,
  };
};
