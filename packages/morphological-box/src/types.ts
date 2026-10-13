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
  /** Manual mode: the value is chosen by a person (generators still fill it unless locked) */
  manual?: boolean;
  values?: V[];
};

/** Group of strongly related key factors. */
export type Category = Item & {
  componentIds?: ID[];
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
