import { normalizeInconsistencies, setInconsistency } from 'morphological-box';
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

type StarterKitData = {
  effectsPrompt: string;
  personaPrompt: string;
  personas: Persona[];
  boxes: BoxSpec[];
};

const personaSelections: Record<string, string[]> = {
  evenementenveiligheid: ['starter-event-visitor', 'starter-event-organiser', 'starter-nearby-resident', 'starter-reduced-mobility'],
  cybercontinuiteit: ['starter-it-specialist', 'starter-infra-operator', 'starter-small-business', 'starter-nurse', 'starter-commuter'],
  hoogwater: ['starter-nearby-resident', 'starter-reduced-mobility', 'starter-farmer', 'starter-young-parent', 'starter-single-parent'],
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
  storm: ['starter-nearby-resident', 'starter-field-worker', 'starter-truck-driver', 'starter-elderly-alone', 'starter-commuter'],
  'extreme-temperature': ['starter-elderly-alone', 'starter-nurse', 'starter-field-worker', 'starter-young-parent', 'starter-single-parent'],
  drought: ['starter-farmer', 'starter-small-business', 'starter-nearby-resident', 'starter-local-official'],
  'epidemic-pandemic': ['starter-nurse', 'starter-elderly-alone', 'starter-teacher', 'starter-small-business', 'starter-student'],
  'animal-disease': ['starter-farmer', 'starter-truck-driver', 'starter-local-official', 'starter-small-business'],
  'insect-infestation': ['starter-farmer', 'starter-nearby-resident', 'starter-small-business'],
  'industrial-cbrn-accident': ['starter-nearby-resident', 'starter-nurse', 'starter-teacher', 'starter-field-worker', 'starter-shift-worker'],
  'nuclear-radiological': ['starter-nearby-resident', 'starter-young-parent', 'starter-farmer', 'starter-nurse', 'starter-shift-worker'],
  'air-accident': ['starter-traveller', 'starter-nearby-resident', 'starter-infra-operator', 'starter-nurse', 'starter-taxi-driver'],
  'rail-accident': ['starter-traveller', 'starter-nearby-resident', 'starter-reduced-mobility', 'starter-infra-operator', 'starter-taxi-driver'],
  'road-accident': ['starter-truck-driver', 'starter-young-parent', 'starter-nearby-resident', 'starter-nurse', 'starter-taxi-driver'],
  'maritime-accident': ['starter-traveller', 'starter-infra-operator', 'starter-nearby-resident', 'starter-taxi-driver'],
  'pipeline-gas-explosion': ['starter-nearby-resident', 'starter-field-worker', 'starter-small-business', 'starter-reduced-mobility', 'starter-shift-worker'],
  'structure-collapse': ['starter-nearby-resident', 'starter-field-worker', 'starter-reduced-mobility', 'starter-young-parent'],
  'power-outage': ['starter-elderly-alone', 'starter-reduced-mobility', 'starter-nurse', 'starter-small-business', 'starter-infra-operator'],
  'telecom-failure': ['starter-elderly-alone', 'starter-it-specialist', 'starter-small-business', 'starter-nurse', 'starter-commuter'],
  'water-contamination': ['starter-young-parent', 'starter-hospitality', 'starter-nurse', 'starter-elderly-alone', 'starter-single-parent'],
  'hazmat-spill': ['starter-truck-driver', 'starter-nearby-resident', 'starter-farmer', 'starter-field-worker', 'starter-shift-worker'],
  'terrorist-explosive': ['starter-event-visitor', 'starter-traveller', 'starter-nearby-resident', 'starter-nurse', 'starter-taxi-driver'],
  'terrorist-cbrn': ['starter-traveller', 'starter-nurse', 'starter-nearby-resident', 'starter-young-parent'],
  'active-shooter': ['starter-teacher', 'starter-young-parent', 'starter-event-visitor', 'starter-small-business', 'starter-student'],
  'sabotage-infrastructure': ['starter-infra-operator', 'starter-it-specialist', 'starter-small-business', 'starter-elderly-alone', 'starter-shift-worker'],
  'hostage-kidnapping': ['starter-teacher', 'starter-small-business', 'starter-community-leader', 'starter-nearby-resident'],
  'civil-unrest': ['starter-nearby-resident', 'starter-small-business', 'starter-protester', 'starter-local-official', 'starter-student'],
  'maritime-piracy': ['starter-infra-operator', 'starter-small-business', 'starter-traveller'],
  'drone-attack': ['starter-infra-operator', 'starter-event-visitor', 'starter-nearby-resident', 'starter-it-specialist'],
  'hybrid-threat': ['starter-local-official', 'starter-it-specialist', 'starter-infra-operator', 'starter-elderly-alone', 'starter-commuter'],
  disinformation: ['starter-elderly-alone', 'starter-community-leader', 'starter-local-official', 'starter-protester', 'starter-student'],
  'supply-chain-disruption': ['starter-small-business', 'starter-truck-driver', 'starter-hospitality', 'starter-infra-operator', 'starter-single-parent'],
  arson: ['starter-nearby-resident', 'starter-small-business', 'starter-community-leader', 'starter-reduced-mobility', 'starter-single-parent'],
};

/** Portrait ids used briefly before the new artwork replaced the original images in place. */
const renamedPersonaImages: Record<string, string> = {
  starter_event_visitor: 'families1', starter_nearby_resident: 'families2',
  starter_event_organiser: 'female_worker_with_laptop1', starter_reduced_mobility: 'elderly_woman_wheelchair1',
  starter_elderly_alone: 'elderly_man1', starter_young_parent: 'young_mother1', starter_farmer: 'farmer1',
  starter_truck_driver: 'middle_aged_male_truck_driver1', starter_traveller: 'male_indian_student1',
  starter_nurse: 'nurse1', starter_teacher: 'female_teacher1', starter_small_business: 'male_zzp1',
  starter_infra_operator: 'business_woman1', starter_it_specialist: 'tech_guy1',
  starter_field_worker: 'construction_worker1', starter_hospitality: 'cook1', starter_protester: 'climate_girl1',
  starter_community_leader: 'female_speaker1', starter_local_official: 'middleaged_man_suit1',
  starter_taxi_driver: 'taxi_driver1', starter_student: 'female_student1',
  starter_single_parent: 'single_parent1', starter_commuter: 'commuter1', starter_shift_worker: 'shift_worker1',
};

/** Points personas at renamed portrait ids; returns true when the model changed. */
export const migratePersonaImages = (model: Pick<DataModel, 'personas'>) => {
  let changed = false;
  for (const persona of model.personas || []) {
    const url = persona.url && renamedPersonaImages[persona.url];
    if (url) {
      persona.url = url;
      changed = true;
    }
  }
  return changed;
};

const stableStringify = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .filter((key) => (value as Record<string, unknown>)[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
};

/** 53-bit string hash (cyrb53). */
const hash = (text: string) => {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
};

/** Fingerprint of the user-editable box definition; ignores fields the app fills in automatically. */
export const boxFingerprint = (box: Scenario) =>
  hash(stableStringify({
    label: box.label,
    desc: box.desc,
    template: box.template,
    personas: box.personas || [],
    categories: (box.categories || []).map(({ id, label, desc, componentIds, decisionSupport }) =>
      ({ id, label, desc, componentIds, decisionSupport: !!decisionSupport })),
    components: (box.components || []).map(({ id, label, desc, manual, values }) =>
      ({ id, label, desc, manual: !!manual, values: (values || []).map(({ id, label }) => ({ id, label })) })),
    inconsistencies: normalizeInconsistencies(box.inconsistencies || {}),
    prompts: (box.llm?.prompts || [])
      .filter(({ type }) => type === 'narrative' || type === 'persona')
      .map(({ type, prompt }) => ({ type, prompt })),
  }));

export const personaFingerprint = ({ label, desc, url }: Persona) =>
  hash(stableStringify({ label, desc, url }));

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
  personaPrompt: string,
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
      }, {
        type: 'persona',
        categories: categories.map(({ id }) => id),
        prompt: personaPrompt,
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
  const scenarios = data.boxes.map((box) => {
    const scenario = createScenario(box, data.effectsPrompt, data.personaPrompt, thresholdColors);
    return { ...scenario, starterHash: boxFingerprint(scenario) };
  });
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
    personas: data.personas.map((persona) => ({ ...persona, starterHash: personaFingerprint(persona) })),
  };
};

export type StarterKitConflict = { id: string; label: string; kind: 'box' | 'persona' };

/** A box is untouched when its definition still matches the kit it came from and holds no user work. */
const isUntouchedBox = (box: Scenario) =>
  (!box.starterHash || box.starterHash === boxFingerprint(box)) &&
  (box.narratives || []).every(({ id }) => id === `${box.id}-voorbeeld`) &&
  !box.decisionLog?.length &&
  !Object.keys(box.criteriaWeights || {}).length;

const isUntouchedPersona = (persona: Persona, current: Persona) =>
  persona.starterHash
    ? persona.starterHash === personaFingerprint(persona)
    : persona.label === current.label && persona.desc === current.desc;

/**
 * Adds missing starter boxes and personas and updates existing ones to the current kit.
 * Untouched items are replaced silently (keeping their id and position); edited items are
 * only replaced when their id is in `overwrite`, otherwise they are reported as conflicts.
 */
export const addStarterKitToModel = (
  model: DataModel,
  starter: DataModel,
  overwrite: ReadonlySet<string> = new Set()
): { model: DataModel; added: number; updated: number; conflicts: StarterKitConflict[] } => {
  const starterBoxes = [starter.scenario, ...starter.scenarios];
  const starterById = new Map(starterBoxes.map((box) => [box.id, box]));
  const existingIds = new Set([model.scenario, ...model.scenarios].map(({ id }) => id));
  const missing = starterBoxes.filter(({ id }) => !existingIds.has(id));
  const conflicts: StarterKitConflict[] = [];
  let updated = 0;
  let changed = false;
  const updateBox = (box: Scenario): Scenario => {
    const current = starterById.get(box.id);
    if (!current) return box;
    if (boxFingerprint(box) === current.starterHash) {
      if (box.starterHash === current.starterHash) return box;
      changed = true;
      return { ...box, starterHash: current.starterHash };
    }
    if (isUntouchedBox(box) || overwrite.has(box.id)) {
      updated++;
      // Keep view preferences; everything else comes from the kit.
      const { mapConfig, mapUnits, osmAmenities, includeMapSupport, decisionSupportPrompted } = box;
      return { ...current, mapConfig, mapUnits, osmAmenities, includeMapSupport, decisionSupportPrompted };
    }
    conflicts.push({ id: box.id, label: box.label, kind: 'box' });
    // Edited boxes without a persona selection still get the starter selection.
    if (box.personas?.length || !current.personas?.length) return box;
    updated++;
    return { ...box, personas: [...current.personas] };
  };
  const scenario = updateBox(model.scenario);
  const scenarios = model.scenarios.map(updateBox);

  const starterPersonas = new Map((starter.personas || []).map((p) => [p.id, p]));
  const personas = (model.personas || []).map((persona) => {
    const original = persona.url && renamedPersonaImages[persona.url];
    const own = original ? { ...persona, url: original } : persona;
    if (original) changed = true;
    const current = starterPersonas.get(persona.id);
    if (!current) return own;
    if (personaFingerprint(own) === current.starterHash) {
      if (own.starterHash === current.starterHash) return own;
      changed = true;
      return { ...own, starterHash: current.starterHash };
    }
    if (isUntouchedPersona(own, current) || overwrite.has(persona.id)) {
      updated++;
      return { ...current };
    }
    conflicts.push({ id: persona.id, label: persona.label, kind: 'persona' });
    return own;
  });
  const existingPersonas = new Set(personas.map(({ id }) => id));
  const addedPersonas = (starter.personas || []).filter(({ id }) => !existingPersonas.has(id));
  updated += missing.length ? 0 : addedPersonas.length;
  return {
    model:
      missing.length || updated || addedPersonas.length || changed
        ? {
            ...model,
            scenario,
            scenarios: [...scenarios, ...missing],
            personas: [...personas, ...addedPersonas],
          }
        : model,
    added: missing.length,
    updated,
    conflicts,
  };
};
