import { I18n } from 'mithril-ui-form';
import translate, { Options, Translate } from 'translate.js';
import { plural_EN } from 'translate.js/pluralize';

export type Languages = 'nl' | 'en';

export const messages = {
  HOME: { TITLE: 'home', ROUTE: '/home' },
  ABOUT: { TITLE: 'about', ROUTE: '/about' },
  DEFINE_BOX: { TITLE: 'Define', ROUTE: '/define' },
  SETTINGS: { TITLE: 'Settings', ROUTE: '/settings' },
  CREATE_SCENARIO: { TITLE: 'Create', ROUTE: '/create' },
  SHOW_SCENARIO: { TITLE: 'Show', ROUTE: '/home' },
  DOWNLOAD: 'Download',
  UPLOAD: 'Upload',
  CANCEL: 'Cancel',
  DELETE: 'Delete',
  YES: 'Yes',
  NO: 'No',
  OK: 'Ok',
  NAME: 'Name',
  DESCRIPTION: 'Description',
  CATEGORIES: 'Categories',
  DIMENSION: 'Key factor',
  DIMENSIONS: 'Key factors',
  KEY_VALUE: 'Key value',
  CONTEXT: 'Context',
  NONE: 'None',
  LOCATION: 'Location',
  LOCATION_TYPE: 'Location type',
  COORDINATES: 'Coordinates',
  LOCATION_NAME: 'Location name',
  LATITUDE: 'Latitude',
  LONGITUDE: 'Longitude',
  MANUAL: 'Manual mode',
  Type: 'Type',
  PICK_FROM_LIST: 'Pick from list',
  ENTER_KEY_VALUE: 'Enter key value',
  EDIT_COMPONENT: 'Edit component',
  ADD_COMPONENT: 'Add component',
  GENERATE_NARRATIVE: 'Generate',
  CLEAR_NARRATIVE: 'Clear',
  NAME_NARRATIVE: 'Title of current narrative',
  SAVE_NARRATIVE: 'Save',
  NARRATIVE: 'narrative',
  INCLUDE_NARRATIVE: 'Include narrative',
  SELECT_NARRATIVE: 'Select narrative',
  KEY: 'Key',
  VALUE: 'Value',
  MODEL: 'Model',
  SELECTION: 'Selected value',
  EDITOR_PLACEHOLDER: 'Edit narrative',
  THRESHOLDS: 'Thresholds colors reflecting component usage',
  THRESHOLD: 'Threshold value',
  COLOR: 'Color',
  ORDER: 'Order',
  COMBINATIONS: {
    POSSIBLE: 'Combinations are possible',
    IMPOSSIBLE: 'Combinations are impossible',
    IMPROBABLE: 'Combinations are improbable',
  },
  DELETE_ITEM: {
    title: 'Delete {item}',
    description:
      'Are you certain you want to delete this {item}. There is no turning back?',
  },
  NEW_MODEL: {
    btn: 'New model',
    title: 'Choose a new model and erase everything',
    description:
      'Are you sure that you want to delete your existing model and start one of the available new ones? There is no way back.',
    choose: 'Choose your new model',
    remove: 'Remove all key values',
  },
  INCONSISTENCIES: {
    title: 'Edit inconsistencies',
    SELECT_ROW: 'Select row',
    SELECT_COL: 'Select column',
  },
  saveButton: {
    label: 'Save',
    tooltip: 'Save unsaved changes',
  },
  i18n: {
    /** Label for the edit button of the RepeatList */
    editRepeat: 'Edit',
    /** Label for the create button of the RepeatList */
    createRepeat: 'Add',
    /** Label for the delete button of the RepeatList */
    deleteItem: 'Delete',
    /** Label for the agree button of the RepeatList */
    agree: 'Yes',
    /** Label for the disagree button of the RepeatList */
    disagree: 'No',
    /** Pick one */
    pickOne: 'Pick one',
    /** Pick one or more */
    pickOneOrMore: 'Pick one or more',
    /** Cancel button text */
    cancel: 'Cancel',
    /** Save button text */
    save: 'Save',
  },
  COMP: {
    AVAILABLEBUDGET: 'Budget',
    BEHAVIOURDURINGPREPARATION: 'Behaviour during preparation',
    CAPABILITIES: 'Capability',
    COMPARTMENTSPRESENT: 'Compartments present',
    CRIMINALPHASE: 'Criminal phase',
    DURATION: 'Duration',
    EQUIPMENT: 'Equipment',
    EXISTINGINFRA: 'Existing infra',
    IMPACT: 'Impact',
    INTENT: 'Bystander intent',
    LOCATION: 'Location',
    LOCATION2: 'Location',
    MODUSOPERANDIDURINGEXECUTION: 'Mode of operation',
    MOTIVATION: 'Motivation',
    NARRATIVE: 'Narrative',
    NARRATIVE_PLACEHOLDER:
      'Describe the context in which the incident took place, such as a description of the (geographic) location, the person or building that must be protected, the way an actor obtains information, at what time did the action take place, under what weather circumstances, how many persons were involved in the action, from which organisation, how did they obtain access, or which means/weapons were employed.',
    OBJECT: 'Object',
    OPENCOMPARTMENTS: 'Open compartment',
    PEOPLEDENSITY: 'Person density',
    PERSONS: 'Person',
    PHYSICALANGLEOFATTACKDURINGEXECUTION: 'Physical angle of attack',
    PHYSICAL_ANGLE: 'Physical angle',
    PRIVACYAWARENESS: 'Privacy awareness',
    RELATIONOWNEROBJECTANDOWNERSECURITYSYSTEM:
      'Relation owner object and owner security system',
    RESPONSIBILITY: 'Responsibility',
    SCENARIOS: 'Scenario',
    SECURITYAWARENESS: 'Security awareness',
    TARGETTYPE: 'Target type',
    THREATDIRECTION: 'Threat direction',
    ACTOR: 'Actor',
    ACTION: 'Action',
    ACCESS: 'Access',
    MEANS: 'Means',
    TYPEOFENVIRONMENT: 'Environment type',
    TYPEOFOBJECT: 'Type of object',
    WEAPON: 'Weapon',
    WEATHERBEHAVIOUR: 'Weather behaviour',
    WEATHERTYPE: 'Weather condition',
    PI: 'Protected interest (target)',
    MEANSWEAPON: 'Means/weapon',
    MISSIONCONTEXT: 'Mission context',
    ADVERSARY: 'Adversary',
    C2HEADQUARTERS: 'C2-HQ location',
    TARGET: 'Target',
    DELIBERATEACTION: 'Deliberate action',
    MEANS2: 'Means of attack',
    MEANS3: 'Means for action',
    MEANS4: 'Means for access',
    ACCESS2: 'Means of access',
    MEANS2ACCESS: 'Means to access',
  },
  MODEL_NAMES: {
    0: 'Simple model (in English)',
  },
  MODEL_DESC: {
    0: 'A scenario model with a threat and a context category.',
  },
};

export const messagesNL: typeof messages = {
  HOME: { TITLE: 'home', ROUTE: '/home' },
  ABOUT: { TITLE: 'over', ROUTE: '/over' },
  DEFINE_BOX: { TITLE: 'Definieer', ROUTE: '/definieer' },
  SETTINGS: { TITLE: 'Instellingen', ROUTE: '/instellingen' },
  CREATE_SCENARIO: { TITLE: 'Maak', ROUTE: '/maak' },
  SHOW_SCENARIO: { TITLE: 'Toon', ROUTE: '/toon' },
  DOWNLOAD: 'Downloaden',
  UPLOAD: 'Uploaden',
  CANCEL: 'Afbreken',
  DELETE: 'Verwijderen',
  YES: 'Ja',
  NO: 'Nee',
  OK: 'Ok',
  NAME: 'Naam',
  DESCRIPTION: 'Omschrijving',
  CATEGORIES: 'Categoriën',
  DIMENSION: 'Hoofdfactor',
  DIMENSIONS: 'Hoofdfactoren',
  KEY_VALUE: 'Waarde',
  CONTEXT: 'Context',
  NONE: 'Geen',
  LOCATION: 'Locatie',
  LOCATION_TYPE: 'Locatietype',
  COORDINATES: 'Coordinaten',
  LOCATION_NAME: 'Locatienaam',
  LATITUDE: 'Latitude',
  LONGITUDE: 'Longitude',
  MANUAL: 'Manuele mode',
  Type: 'Type',
  PICK_FROM_LIST: 'Kies uit de lijst',
  ENTER_KEY_VALUE: 'Vul een sleutel en waarde in',
  EDIT_COMPONENT: 'Bewerk optie',
  ADD_COMPONENT: 'Nieuwe optie',
  GENERATE_NARRATIVE: 'Genereer',
  CLEAR_NARRATIVE: 'Wis',
  NARRATIVE: 'verhaallijn',
  NAME_NARRATIVE: 'Titel van huidige verhaallijn',
  SAVE_NARRATIVE: 'Bewaar',
  INCLUDE_NARRATIVE: 'Neem verhaallijn op',
  SELECT_NARRATIVE: 'Selecteer verhaallijn',
  KEY: 'Sleutel',
  VALUE: 'Waarde',
  MODEL: 'Model',
  SELECTION: 'Geselecteerde waarde',
  EDITOR_PLACEHOLDER: 'Bewerk verhaallijn',
  THRESHOLDS: 'Kleuren voor weergave gebruik van componenten',
  THRESHOLD: 'Drempelwaarde',
  COLOR: 'Kleur',
  ORDER: 'Volgorde',
  COMBINATIONS: {
    POSSIBLE: 'Combinaties zijn mogelijk',
    IMPOSSIBLE: 'Combinaties zijn onmogelijk',
    IMPROBABLE: 'Combinaties zijn onwaarschijnlijk',
  },
  DELETE_ITEM: {
    title: 'Verwijder {item}',
    description:
      'Weet u zeker dat u de {item} wilt verwijderen? Dit kan niet ongedaan gemaakt worden.',
  },
  NEW_MODEL: {
    btn: 'Nieuw model',
    title: 'Kies een nieuw model en wis alles',
    description:
      'Weet u zeker dat u het huidige model wilt wissen, en met één van onderstaande modellen wilt verdergaan? Er is geen weg terug.',
    choose: 'Kies uw nieuwe model',
    remove: 'Verwijder alle reeds ingevulde waarden',
  },
  INCONSISTENCIES: {
    title: 'Bewerk inconsistencies',
    SELECT_ROW: 'Selecteer rij',
    SELECT_COL: 'Selecteer kolom',
  },
  saveButton: {
    label: 'Opslaan',
    tooltip: 'Sla aanpassingen op',
  },
  i18n: {
    /** Label for the edit button of the RepeatList */
    editRepeat: 'Bewerk',
    /** Label for the create button of the RepeatList */
    createRepeat: 'Nieuw',
    /** Label for the delete button of the RepeatList */
    deleteItem: 'Verwijder',
    /** Label for the agree button of the RepeatList */
    agree: 'Ja',
    /** Label for the disagree button of the RepeatList */
    disagree: 'Nee',
    /** Pick one */
    pickOne: 'Kies één',
    /** Pick one or more */
    pickOneOrMore: 'Kies één of meer',
    /** Cancel button text */
    cancel: 'Afbreken',
    /** Save button text */
    save: 'Opslaan',
  },
  COMP: {
    AVAILABLEBUDGET: 'Budget',
    BEHAVIOURDURINGPREPARATION: 'Gedrag tijdens voorbereiding',
    CAPABILITIES: 'Capability',
    COMPARTMENTSPRESENT: 'Aanwezige compartimenten',
    CRIMINALPHASE: 'Criminele fase',
    DURATION: 'Duur',
    EQUIPMENT: 'Materieel',
    EXISTINGINFRA: 'Bestaande infra',
    IMPACT: 'Impact',
    INTENT: 'Intentie publiek',
    LOCATION: 'TBB: locatie',
    LOCATION2: 'Locatie',
    MODUSOPERANDIDURINGEXECUTION: 'Modus operandus',
    MOTIVATION: 'Motivatie',
    NARRATIVE: 'Verhaallijn',
    NARRATIVE_PLACEHOLDER:
      'Beschrijf de context waarin het incident plaatsvindt, zoals een nadere beschrijving van de (geografische) locatie, de te beschermen persoon of gebouw, de wijze waarop een actor informatie verzamelt, op welk tijdstip vindt de actie plaats, onder welke weersomstandigheden, hoeveel personen zijn er betrokken bij de actie, van welke organisatie, hoe kregen ze toegang, of welke middelen/wapens werden ingezet.',
    OBJECT: 'Object',
    OPENCOMPARTMENTS: 'Open compartiment',
    PEOPLEDENSITY: 'Personendichtheid',
    PERSONS: 'Persoon',
    PHYSICALANGLEOFATTACKDURINGEXECUTION: 'Fysieke aanvalshoek',
    PHYSICAL_ANGLE: 'Fysieke hoek',
    PRIVACYAWARENESS: 'Privacy-bewustzijn',
    RELATIONOWNEROBJECTANDOWNERSECURITYSYSTEM:
      'Relatie eigenaar object en eigenaar beveiligingssysteem',
    RESPONSIBILITY: 'Verantwoordelijkheid',
    SCENARIOS: 'Scenario',
    SECURITYAWARENESS: 'Beveiligingsbewustzijn',
    TARGETTYPE: 'Doeltype',
    THREATDIRECTION: 'Dreigingsrichting',
    ACTOR: 'Actor',
    ACTION: 'Moedwillige actie',
    ACCESS: 'Wijze van toegang',
    MEANS: 'Middel / wapen',
    TYPEOFENVIRONMENT: 'Omgevingstype',
    TYPEOFOBJECT: 'Objecttype',
    WEAPON: 'Wapen',
    WEATHERBEHAVIOUR: 'Weersgedrag',
    WEATHERTYPE: 'Weersconditie',
    PI: 'TBB: Soort doelwit',
    MEANSWEAPON: 'Middel/wapen',
    MISSIONCONTEXT: 'Missiecontext',
    ADVERSARY: 'Tegenstander',
    C2HEADQUARTERS: 'C2-HQ locatie',
    TARGET: 'Doelwit',
    DELIBERATEACTION: 'Moedwillige actie',
    MEANS2: 'Aanslagmiddel',
    MEANS3: 'Middel tbv actie',
    MEANS4: 'Middel tbv toegang',
    ACCESS2: 'Wijze van binnendringen',
    MEANS2ACCESS: 'Middel om binnen te dringen',
  },
  MODEL_NAMES: {
    0: 'Simpel model (in Engels)',
  },
  MODEL_DESC: {
    0: 'Een scenario model met een dreigings- en contextcategorie.',
  },
};

const setGuiLanguage = (language: Languages) => {
  const options = {
    // These are the defaults:
    debug: true, //[Boolean]: Logs missing translations to console and add "@@" around output, if `true`.
    array: true, //[Boolean]: Returns translations with placeholder-replacements as Arrays, if `true`.
    resolveAliases: true, //[Boolean]: Parses all translations for aliases and replaces them, if `true`.
    pluralize: plural_EN, //[Function(count)]: Provides a custom pluralization mapping function, should return a string (or number)
    useKeyForMissingTranslation: true, //[Boolean]: If there is no translation found for given key, the key is used as translation, when set to false, it returns undefiend in this case
  };
  return translate(
    language === 'nl' ? messagesNL : messages,
    options
  ) as Translate<typeof messages, Options>;
};

export type TextDirection = 'rtl' | 'ltr';

export type Locale = {
  /** Friendly name */
  name: string;
  /** Fully qualified name, e.g. 'en-UK' */
  fqn: string;
  /** Text direction: Left to right or right to left */
  dir?: TextDirection;
  /** Is the default language */
  default?: boolean;
};

export type Locales = Record<Languages, Locale>;
// export type Locales = {
//   [key: Languages]: Localeg;
// } & {
//   /** Default URL to load the language files, e.g. '/lang/{locale}.json' */
//   url?: string;
// };

export type Listener = (locale: string, dir: TextDirection) => void;

const onChangeLocale = [] as Listener[];

export const i18n = {
  defaultLocale: 'en' as Languages,
  currentLocale: 'en' as Languages,
  locales: {} as Locales,
  init,
  addOnChangeListener,
  loadAndSetLocale,
  i18n: {} as I18n,
  // } as {
  //   defaultLocale: Languages;
  //   currentLocale: Languages;
  //   locales: Locales;
  //   t: Translate<typeof messages, Options>;
};

export let t: Translate<typeof messages, Options>;

async function init(locales: Locales, selectedLocale: Languages) {
  i18n.locales = locales;
  const defaultLocale = (Object.keys(locales) as Languages[])
    .filter((l) => (locales[l] as Locale).default)
    .shift();
  if (defaultLocale) {
    i18n.defaultLocale = defaultLocale || selectedLocale;
  }
  await loadAndSetLocale(selectedLocale);
}

function addOnChangeListener(listener: Listener) {
  onChangeLocale.push(listener);
}

async function loadAndSetLocale(newLocale: Languages) {
  if (i18n.currentLocale === newLocale) {
    return;
  }

  const resolvedLocale = supported(newLocale) ? newLocale : i18n.defaultLocale;
  i18n.currentLocale = resolvedLocale;
  t = setGuiLanguage(newLocale);
  i18n.i18n = {
    editRepeat: t('i18n', 'editRepeat'),
    createRepeat: t('i18n', 'createRepeat'),
    deleteItem: t('i18n', 'deleteItem'),
    agree: t('i18n', 'agree'),
    disagree: t('i18n', 'disagree'),
    pickOne: t('i18n', 'pickOne'),
    pickOneOrMore: t('i18n', 'pickOneOrMore'),
    cancel: t('i18n', 'cancel'),
    save: t('i18n', 'save'),
  } as I18n;
  onChangeLocale.forEach((listener) => listener(i18n.currentLocale, dir()));
}

function supported(locale: Languages) {
  return Object.keys(i18n.locales).indexOf(locale) >= 0;
}

function dir(locale = i18n.currentLocale) {
  return (i18n.locales[locale] as Locale).dir || 'ltr';
}
