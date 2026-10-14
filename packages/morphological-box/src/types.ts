export type ID = string;

/** Base for every identifiable element in a morphological box. */
export type Item = {
  id: ID;
  label: string;
  /** Description, may use markdown */
  desc?: string;
};

/** A possible value (option, state) of a key factor. */
export type Value = Item;

/** Key factor (dimension, driver, parameter) with its possible values. */
export type Component<V extends Value = Value> = Item & {
  /** Optional sort order */
  order?: number;
  /**
   * Manual mode: the value is chosen by a person, e.g. response measures in a
   * decision-support box. Generators leave it empty unless it is locked or
   * `includeManual` is set; constraints still exclude inconsistent values.
   */
  manual?: boolean;
  values?: V[];
};

/** Group of strongly related key factors. */
export type Category = Item & {
  componentIds?: ID[];
  /**
   * Decision category: its key factors are decisions or measures that a person
   * chooses (e.g. crisis response measures), not part of the situation. Its
   * components are manual by default.
   */
  decisionSupport?: boolean;
};

/**
 * Cross-consistency matrix, keyed by value IDs. A missing entry means the
 * combination is possible, `true` means it is impossible, and `false` means it
 * is unlikely (improbable). Entries are stored symmetrically: a[b] === b[a].
 */
export type Inconsistencies = {
  [valueId: ID]: { [valueId: ID]: boolean };
};

/** Morphological box: categories of key factors, their values, and constraints. */
export type MorphologicalBox<C extends Component = Component> = Item & {
  categories: Category[];
  components: C[];
  inconsistencies: Inconsistencies;
};

/** Selected value IDs per component ID. */
export type Selection = Record<ID, ID[]>;

export type InconsistencyType = 'possible' | 'unlikely' | 'impossible';

/**
 * Course of action (COA): one alternative set of decisions for a situation
 * (a narrative). It holds only selections of decision components, plus
 * metadata. Same shape as in Scenario Spark.
 */
export type CourseOfAction = {
  id: ID;
  label: string;
  desc?: string;
  /** Decision component ID => selected value IDs */
  components: { [componentId: ID]: ID[] };
  notes?: string;
  /** Reflection on the decisions (e.g. written with the LLM decision prompt) */
  reflection?: string;
  /** Residual risk after the course of action */
  risk?: ID;
  probability?: ID;
  impact?: ID;
  /**
   * Optional criteria scores (1 poor - 5 good), keyed by criterion. Scenario Spark
   * uses `effect`, `speed`, `capacity`, `safety` (responder safety), `legality` and
   * `acceptance` (public acceptance).
   */
  scores?: { [criterion: string]: number };
};
