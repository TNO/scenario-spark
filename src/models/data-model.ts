import { Translate, Options } from 'translate.js';
import { messages } from '../services';
import { uniqueId } from 'mithril-materialized';

export type DataModel = {
  version?: number;
  lastUpdate?: number;
  /** Current scenario */
  scenario: Scenario;
  /** List of other possible scenarios, excluding the current scenario */
  scenarios: Scenario[];
};

export type OldDataModel = {
  scenarios: {
    current: {
      id: string;
      type: string;
      category: string;
      name: string;
      desc: string;
      categories: {
        [key: string]: string[];
      };
      inconsistencies: Inconsistency[];
      narratives: Array<{
        id: string;
        name: string;
        components: { [key: ID]: ID };
        narrative: string;
        included: boolean;
      }>;
    };
  };
} & {
  [key: string]: {
    list: Array<{
      id: string;
      name: string;
      type: string;
      desc?: string;
      context?: {
        type: 'LOCATION' | 'LOCATIONTYPE';
        data: {
          COORDINATES?: string;
          NAME?: string;
          [key: string]: string | undefined;
        };
      };
    }>;
  };
};

export type InconsistencyType = 'partly' | 'totally';

/** Old inconsistency type */
export type Inconsistency = {
  ids: [from: string, to: string];
  type: InconsistencyType;
};

/**
 * New inconsistency type, where a missing value indicates a combination that
 * is possible, a value of true indicates the combination is not possible, and
 * false indicates it is improbable.
 */
export type Inconsistencies = {
  [rowOrColId: string]: { [rowOrColId: string]: boolean };
};

export type Item = {
  id: ID;
  label: string;
  /** Description of the item, may use markdown */
  desc?: string;
};

export const contextTypeOptions = (
  t: Translate<typeof messages, Options>
): Array<{ id: ContextType; label: string }> => [
  { id: 'none', label: t('NONE') },
  { id: 'location', label: t('LOCATION') },
  { id: 'locationType', label: t('LOCATION_TYPE') },
];

export type ContextType = 'none' | 'location' | 'locationType';
export type LocationType = 'name' | 'coords';
export type LocationTypeType = 'list' | 'keyValue';

export type ContextualItem = Item & {
  context?: ContextType;
  /** Location name, e.g. the name of a city or landmark */
  location?: string;
  /** Type of location when the context is location, e.g. name or coordinates */
  locationType?: LocationType;
  /** Type of location when the context is locationType, e.g. pick from a default list or OSM key value */
  locationTypeType?: LocationTypeType;
  /** Location's latitude, WGS84 */
  lat?: number;
  /** Location's longitude, WGS84 */
  lon?: number;
  /** OSM type */
  osmTypeId?: string;
  /** OSM attribute key */
  key?: string;
  /** OSM attribute value */
  value?: string;
};

export type Narrative = Item & {
  /** componentID => a component's valueId */
  components: { [key: ID]: ID[] };
  /** Is the narrative included in the final set of narratives or a temporary scenario, just in case */
  included: boolean;
  /** Is the narrative saved in the set of narratives (so we should be able to delete or replace it) */
  saved: boolean;
  /** Risk that the narrative occurs = chance x impact */
  risk?: ID;
  /** Probability that the narrative occurs */
  probability?: ID;
  /** Impact of the narrative */
  impact?: ID;
};

/** HEX color code */
export type Color = string;

/** Threshold value and the corresponding color */
export type ThresholdColor = { threshold: number; color: Color };

export type Scenario = Item & {
  /** Template string to convert the scenario items to a fluid text. */
  template?: string;
  /** If true, do not show inconsistent combinations between components */
  hideInconsistentValues: boolean;
  /** If true, activate the decision support module */
  includeDecisionSupport: boolean;
  /** Combinations of scenario components that should not be used together */
  inconsistencies: Inconsistencies;
  /** Categories of components */
  categories: Category[];
  /** Scenario components, also known as key factors and key values */
  components: ScenarioComponent[];
  /** Stories consisting of scenario components and a narrative */
  narratives: Narrative[];
  /** Color thresholds to indicate how often a scenario component is used */
  thresholdColors: ThresholdColor[];
  // components: ScenarioComponent[];
};

/** Category of components, e.g. to separate context from narrative */
export type Category = Item & {
  /** If true, the category is used for decision support */
  decisionSupport?: boolean;
  componentIds?: ID[];
};

/** Key factors and their values that make up a narrative */
export type ScenarioComponent = Item & {
  /** Optional sort order */
  order?: number;
  /** Manual mode - if so, do not automatically generate a value for it */
  manual?: boolean;
  /** Key factor values */
  values?: ContextualItem[];
  /** Are there any contexts that are relevant, such as a location or mitigation measures */
  contexts?: ContextType[];
};

/** Default threshold colors */
export const thresholdColors = [
  { threshold: 0, color: '#ddeced' },
  { threshold: 1, color: '#FF7800' },
  { threshold: 2, color: '#ffff00' },
  { threshold: 3, color: '#ff0000' },
];

/**
 * One example model
 * TODO Create several models, e.g. one for security narratives,
 * one for safety regions/L3, one for TBB, etc.
 */
export const defaultModel = {
  version: 1,
  lastUpdate: new Date().valueOf(),
  scenarios: [],
  scenario: {
    id: 'demo1',
    label: 'Demo',
    desc: 'Demo scenario',
    includeDecisionSupport: false,
    hideInconsistentValues: true,
    inconsistencies: {} as Inconsistencies,
    categories: [
      {
        id: 'threat',
        label: 'Threat',
        componentIds: [
          'ThreatDirection',
          'Impact',
          'Motivation',
          'ModusOperandiDuringExecution',
          'Equipment',
          'Responsibility',
        ],
      },
      {
        id: 'context',
        label: 'Context',
        componentIds: [
          'WeatherType',
          'WeatherBehaviour',
          'TypeOfObject',
          'AvailableBudget',
          'OpenCompartments',
          'Location',
        ],
      },
    ],
    components: [
      {
        id: 'ThreatDirection',
        label: 'Threat direction',
        values: [
          { id: 'df62efe6', label: 'Hannibal' },
          { id: '70630364', label: 'The Romans' },
          { id: '82d5d4f5', label: 'Herbert Hoover' },
        ],
      },
      {
        id: 'Impact',
        label: 'Impact',
        values: [
          { id: '5c532a23', label: 'Low' },
          { id: '16ad9a77', label: 'Medium' },
          { id: 'b894abb6', label: 'High' },
        ],
      },
      {
        id: 'Motivation',
        label: 'Motivation',
        values: [
          { id: 'f4ab7a7a', label: 'Money' },
          { id: 'ff550f8f', label: 'Justice' },
          { id: '22b4867e', label: 'Revenge' },
        ],
      },
      {
        id: 'ModusOperandiDuringExecution',
        label: 'Modus operandi during execution',
        values: [
          {
            id: '7ed25fa5',
            label: 'Sniper attack',
            type: 'ModusOperandiDuringExecution',
          },
          {
            id: '1f9b68c9',
            label: 'Kidnapping',
            type: 'ModusOperandiDuringExecution',
          },
          {
            id: '5cc5e352',
            label: 'Singing',
            type: 'ModusOperandiDuringExecution',
          },
        ],
      },
      {
        id: 'Equipment',
        label: 'Equipment',
        values: [
          { id: 'b4218a1f', label: 'None' },
          { id: '8f6185f7', label: 'Drone' },
          { id: 'cb02878d', label: 'Bomb' },
          { id: '9d645efb', label: 'Helicopter' },
          { id: '3a4398c7', label: 'Hammer' },
        ],
      },
      {
        id: 'Responsibility',
        label: 'Responsibility',
        values: [
          { id: 'f44d22be', label: 'Private' },
          { id: '20f9a6ed', label: 'Public' },
        ],
      },
      {
        id: 'WeatherType',
        label: 'Weather type',
        values: [
          { id: 'b9fe2b73', label: 'Rainy' },
          { id: '478581c1', label: 'Sunny' },
          { id: 'b855ac10', label: 'Windy' },
          { id: '24c73f36', label: 'Cloudy' },
        ],
      },
      {
        id: 'WeatherBehaviour',
        label: 'Weather behaviour',
        values: [
          { id: '0ff8041e', label: 'Stable' },
          { id: '894a9bcb', label: 'Changing' },
        ],
      },
      {
        id: 'TypeOfObject',
        label: 'Type of object',
        values: [
          { id: '29a303b3', label: 'Church' },
          { id: '2e7df143', label: 'Park' },
          { id: 'e11282fb', label: 'Palace' },
          { id: '9a1b3256', label: 'Airport' },
        ],
      },
      {
        id: 'AvailableBudget',
        label: 'Available budget',
        values: [
          { id: '90e1ba48', label: 'Knowledge' },
          { id: 'f961174c', label: 'Water' },
        ],
      },
      {
        id: 'OpenCompartments',
        label: 'Open compartments',
        values: [
          { id: '01c3940a', label: 'Open' },
          { id: '56b7fa45', label: 'Closed' },
        ],
      },
      {
        id: 'Location',
        label: 'Location',
        values: [
          { id: 'ea57f820', label: 'Vietnam' },
          { id: 'b8bd8bc3', label: 'Washington' },
          { id: '8fb1e1ab', label: 'Buitenpost' },
        ],
      },
    ],
    narratives: [],
    thresholdColors,
  },
} as DataModel;

export const newScenario = () => ({
  id: uniqueId(),
  label: 'NEW SCENARIO',
  desc: '',
  includeDecisionSupport: false,
  hideInconsistentValues: false,
  inconsistencies: {} as Inconsistencies,
  categories: [],
  components: [],
  narratives: [],
  thresholdColors,
});

export const emptyModel = () =>
  ({
    version: 1,
    lastUpdate: new Date().valueOf(),
    scenarios: [],
    scenario: newScenario(),
  } as DataModel);

/**
 * Set of default models that can be used to create a new scenario
 *
 * When adding a new model, also provide a translation for them:
 *    MODEL_NAME, MODEL_DESC
 * where the index of the model should match.
 */
export const defaultModels: DataModel[] = [emptyModel(), defaultModel];

export type ID = string;

export type User = {
  id: ID;
  name: string;
  phone?: string;
  email?: string;
  url?: string;
  isAuthor?: boolean;
};

export type PageInfo = {
  offsetX: number;
  offsetY: number;
  fontHeight: number;
  line: string;
};

export type EnrichedPageInfo = PageInfo & {
  style: string;
  indented: boolean;
  join: boolean;
  startParagraph: boolean;
  /** Timestamp of the subsequent content blocks */
  timestamp?: number;
};

export type Page = {
  pageNumber: number;
  pageInfo: PageInfo[];
};

export type Log = {
  timestamp?: number;
  author?: string;
  grip?: number;
  blocks: EnrichedPageInfo[];
};

export type TimelineEventType = {
  /** Number representing a JS date */
  timestamp: number;
  /** Index in the logbook that use this timestamp */
  logIndex: number;
  // kind: 'melding' | 'bob' | 'gms' | 'edit';
  // summary?: string;
  author?: string;
};
