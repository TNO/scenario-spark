import { I18n } from 'mithril-ui-form';
import translate, { Options, Translate } from 'translate.js';
import { plural_EN } from 'translate.js/pluralize';

export type Languages = 'nl' | 'en';

export const messages = {
  HOME: { TITLE: 'home', ROUTE: '/home' },
  ABOUT: { TITLE: 'About the app', ROUTE: '/about' },
  DEFINE_BOX: { TITLE: 'Morphological box', ROUTE: '/define' },
  SETTINGS: { TITLE: 'Settings', ROUTE: '/settings' },
  CREATE_SCENARIO: { TITLE: 'Create scenario', ROUTE: '/create' },
  SHOW_SCENARIO: { TITLE: 'Show scenarios', ROUTE: '/show' },
  DECISION_SUPPORT: { TITLE: 'Decision support', ROUTE: '/decide' },
  DOWNLOAD: {
    COLLECTION: 'Save collection',
    MODEL: 'Save scenario file',
  },
  UPLOAD: {
    COLLECTION: 'Load collection',
    MODEL: 'Load scenario file',
  },
  CANCEL: 'Cancel',
  DELETE: 'Delete',
  AND: 'and',
  YES: 'Yes',
  NO: 'No',
  OK: 'Ok',
  NAME: 'Name',
  DESCRIPTION: 'Description',
  NEW_BOX: 'New morphological box',
  CATEGORIES: 'Categories',
  DIMENSION: 'Key driver',
  DIMENSION_SELECTED: 'Selected drivers',
  DIMENSIONS: 'Drivers',
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
  SAVED_NARRATIVES: 'Saved scenarios',
  NARRATIVE: 'narrative',
  INCLUDE_NARRATIVE: 'Include scenario',
  NARRATIVE_INCLUDED: 'Scenario is included',
  SELECT_NARRATIVE: 'Select narrative',
  SELECT_SCENARIO: 'Select scenario',
  KEY: 'Key',
  VALUE: 'Value',
  MODEL: 'Model',
  SELECTION: 'Selected value',
  EDITOR_PLACEHOLDER: 'Edit narrative',
  THRESHOLDS: 'Thresholds colors reflecting component options',
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
  NEW_SCENARIO: 'New scenario',
  NEW_MODEL: {
    btn: 'New collection',
    title: 'Choose a new scenario model and erase everything',
    description:
      'Are you sure that you want to delete your existing collection and start one of the available new ones? There is no way back.',
    choose: 'Choose your new collection',
    remove: 'Remove all key values',
  },
  DELETE_MODEL: {
    btn: 'Delete scenario',
    title: 'Delete the selected scenario',
    description:
      'Are you sure that you want to delete your scenario? There is no way back.',
  },
  INCONSISTENCIES: {
    title: 'Inconsistencies',
    SELECT_ROW_CATEGORY: 'Select row category',
    SELECT_COLUMN_CATEGORY: 'Select column category',
    SELECT_CATEGORIES_TO_START: 'Select categories to start',
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
    /** Pick */
    pick: 'Pick',
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
    0: 'Empty model',
    1: 'Simple model (in English)',
  },
  MODEL_DESC: {
    0: 'An empty scenario model.',
    1: 'A scenario model with a threat and a context category.',
  },
  JSON_NOT_VALID: 'JSON model file not valid! Aborting.',
  NO_NARRATIVE: 'Narrative not generated in 100 tries!',
  SPEC_CATS:
    'First specify some categories, where each category contains some key drivers.',
  EXPORT2WORD: {
    TITLE: 'Export to Word',
    DESC: 'Which scenario do you want to export?',
    CURRENT: 'Current',
    SELECTED: 'Selected',
    ALL: 'All',
  },
  HIDE_INCONSISTENT: 'Hide inconsistent combinations',
  GOAL: {
    TITLE: 'Goal',
    DESC: 'ScenarioSpark is a web application that can be used to systematically create and manage a set of scenarios for risk management activities.',
  },
  USAGE: {
    TITLE: 'Usage',
    DESC: 'ScenarioSpark supports the user in creating and compiling a representative set of scenarios that can be used in the various steps of the risk management process.',
  },
  SECURITY: {
    TITLE: 'Security',
    DESC: 'All information used and entered is processed and stored exclusively locally.',
  },
  SUMMARY:
    'A free tool to support you in creating new scenarios using a morphological box. First, you define the aspects that are of interest in your domain. Next, you specify variations for each aspect. And finally, you either manually create new scenarios, or become inspired by generating possible scenarios automatically.',
  SET_LANGUAGE: 'Set language',
  SCENARIO_LOADED_MSG: 'Scenario successfully loaded',
  COLLECTION_LOADED_MSG: 'The scenario collection is loaded',
  SCENARIO_NOT_LOADED_MSG:
    'The scenario is not loaded: most likely cause, scenario is already part of the collection.',
  SCENARIO_CREATED_MSG: 'A new scenario is created',
  COPY_TO_CLIPBOARD: 'Copy table to clipboard',
  GROUP: { SELECTED: 'Selected scenarios', UNSELECTED: 'Unselected scenarios' },
  CLONE_NARRATIVE: 'Clone',
  INCLUDE_DECISION_SUPPORT: 'Activate decision support',
  IS_DECISION_CATEGORY: 'For decision support',
  PROBABILITY: 'Probability of occurence',
  IMPACT: 'Impact',
  RISK: 'Risk',
  RISK_PLACEHOLDER: 'Probability x Impact',
  PROB5: { 0: 'Very low', 1: 'Low', 2: 'Medium', 3: 'High', 4: 'Very high' },
  IMP5: { 0: 'Very low', 1: 'Low', 2: 'Medium', 3: 'High', 4: 'Very high' },
  RISK5: { 0: 'Very low', 1: 'Low', 2: 'Medium', 3: 'High', 4: 'Very high' },
  SUGGESTED_APPROACH: {
    TITLE: 'Suggested approach',
    DESC: 'The suggested approach is a (risk-)weighted combination of the selected counter-measures.',
  },
  TEMPLATE: {
    TITLE: 'Template string for fluid text',
    DESC: 'Write a paragraph where XXX is replaced by the value for key factor 1, etc. Empty lines are converted to paragraphs.',
  },
  SELECT_PERSONA: 'Select relevant persona for scenario',
  PERSONA_IMPRESSION: 'Impression',
  PERSONA: {
    1: 'Persona',
    n: 'Personas',
  },
  IMAGE: 'Image',
  SAVE: 'Save',
  EDIT: 'Edit',
  LLM: 'LLM',
  SERVICE: 'Service',
  PROVIDER: 'Provider',
  SYSTEM_PROMPT: 'System prompt',
  USER_PROMPT: 'Narrative prompt',
  EFFECT_PROMPT: 'Effect prompt',
  PERSONA_PROMPT: 'Persona prompt',
  COMMUNICATIONS_PROMPT: 'Communications prompt',
  TEMPERATURE: {
    BTN: 'Temperature',
    DESC: 'How creative should the LLM be (max = 1)?',
  },
  API_KEY: 'API key',
  URL: 'URL',
  ASK_LLM: 'Ask LLM',
  INCLUDE_LLM: 'Include in LLM',
  OLLAMA_URL:
    'Hostname (and port, optionally via a [proxy](https://github.com/erikvullings/proxy))',
  ADV_EDIT: 'Code editor',
  TOGGLE: { SHOW: 'Show table', HIDE: 'Hide table' },
  AUTO_CREATE: {
    BTN: 'Auto create',
    COUNT: 'LLM auto create count',
    COUNT_DESC: 'How many scenarios do you want to generate at once?',
  },
  AUTO_CREATE_MSG: {
    1: `Auto create 1 scenario`,
    n: 'Auto create {n} scenarios',
  },
  COPY_BOX: {
    LABEL: 'Copy box',
    TITLE: 'Copy table to clipboard',
    TOAST: 'Morphological box copied to clipboard.',
  },
  PROMPT_TYPE: {
    PROMPTS: 'Prompts',
    LABEL: 'Prompt type',
    NARRATIVE: 'Narrative prompt',
    EFFECT: 'Effect prompt',
    PERSONA: 'Persona prompt',
    COM: 'Communications prompt',
  },
  RESPONSE_INSTRUCTIONS:
    'Start your response with a short, descriptive title on its own line, then a blank line, then the main content.',
};

export const messagesNL: typeof messages = {
  HOME: { TITLE: 'home', ROUTE: '/home' },
  ABOUT: { TITLE: 'over de app', ROUTE: '/over' },
  DEFINE_BOX: { TITLE: 'Morfologische box', ROUTE: '/definieer' },
  SETTINGS: { TITLE: 'Instellingen', ROUTE: '/instellingen' },
  CREATE_SCENARIO: { TITLE: 'Maak scenario', ROUTE: '/maak' },
  SHOW_SCENARIO: { TITLE: "Toon scenario's", ROUTE: '/toon' },
  DECISION_SUPPORT: { TITLE: 'Beslisondersteuning', ROUTE: '/beslis' },
  DOWNLOAD: {
    COLLECTION: 'Bewaar collectie',
    MODEL: 'Bewaar scenario bestand',
  },
  UPLOAD: {
    COLLECTION: 'Lees collectie',
    MODEL: 'Lees scenario bestand',
  },
  CANCEL: 'Afbreken',
  DELETE: 'Verwijderen',
  AND: 'en',
  YES: 'Ja',
  NO: 'Nee',
  OK: 'Ok',
  NAME: 'Naam',
  DESCRIPTION: 'Omschrijving',
  NEW_BOX: 'Nieuwe morfologische box',
  CATEGORIES: 'Categorieën',
  DIMENSION: 'Hoofdfactor',
  DIMENSION_SELECTED: 'Geselecteerde stuurfactoren',
  DIMENSIONS: 'Stuurfactoren',
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
  SAVED_NARRATIVES: "Bewaarde scenario's",
  INCLUDE_NARRATIVE: 'Selecteer scenario',
  NARRATIVE_INCLUDED: 'GESELECTEERD',
  SELECT_NARRATIVE: 'Selecteer verhaallijn',
  SELECT_SCENARIO: 'Selecteer scenario',
  KEY: 'Sleutel',
  VALUE: 'Waarde',
  MODEL: 'Model',
  SELECTION: 'Geselecteerde waarde',
  EDITOR_PLACEHOLDER: 'Bewerk verhaallijn',
  THRESHOLDS: 'Kleuren voor weergave gebruik van opties',
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
  NEW_SCENARIO: 'Nieuw scenario',
  NEW_MODEL: {
    btn: 'Nieuwe collectie',
    title: 'Kies een nieuw scenario en wis alles',
    description:
      'Weet u zeker dat u de huidige collectie wilt wissen, en met één van onderstaande modellen wilt verdergaan? Er is geen weg terug.',
    choose: 'Kies uw nieuwe scenario',
    remove: 'Verwijder alle reeds ingevulde waarden',
  },
  DELETE_MODEL: {
    btn: 'Verwijder scenario',
    title: 'Verwijder het geselecteerde scenario',
    description:
      'Weet u zeker dat u uw scenario wilt verwijderen? Er is geen weg terug.',
  },
  INCONSISTENCIES: {
    title: 'Bewerk inconsistencies',
    SELECT_ROW_CATEGORY: 'Selecteer rij categorie',
    SELECT_COLUMN_CATEGORY: 'Selecteer kolom categorie',
    SELECT_CATEGORIES_TO_START: 'Selecteer categorieën om te beginnen',
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
    /** Pick */
    pick: 'Kies',
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
    0: 'Leeg model',
    1: 'Simpel model (in Engels)',
  },
  MODEL_DESC: {
    0: 'Een leeg scenario model.',
    1: 'Een scenario model met een dreigings- en contextcategorie.',
  },
  JSON_NOT_VALID: 'JSON bestand niet valide! Het inladen wordt afgebroken.',
  NO_NARRATIVE: 'Er kon geen verhaallijn gegenereerd worden na 100 pogingen!',
  SPEC_CATS:
    'Definieer eerst 1 of 2 categorieën, met in iedere categorie enkele hoofdfactoren.',
  EXPORT2WORD: {
    TITLE: 'Exporteer naar Word',
    DESC: "Welke scenario's wilt u exporteren?",
    CURRENT: 'Huidige',
    SELECTED: 'Selectie',
    ALL: 'Allemaal',
  },
  HIDE_INCONSISTENT: 'Verberg inconsistente combinaties',
  GOAL: {
    TITLE: 'Doel',
    DESC: 'ScenarioSpark is een webapplicatie waarmee systematisch een set scenario’s ten behoeve van risicomanagement- activiteiten kan worden gemaakt en beheerd.',
  },
  USAGE: {
    TITLE: 'Gebruik',
    DESC: 'ScenarioSpark ondersteunt de gebruiker bij het op- en samenstellen van een representatieve set scenario’s die gebruikt kan worden in de diverse stappen van het risicomanagement proces. ',
  },
  SECURITY: {
    TITLE: 'Security',
    DESC: 'Alle gebruikte en ingevoerde informatie wordt uitsluitend lokaal verwerkt en opgeslagen.',
  },
  SUMMARY:
    "Een gratis hulpmiddel om u te ondersteunen bij het creëren van nieuwe scenario's met behulp van een morfologische doos. Eerst definieert u de aspecten die van belang zijn voor uw domein. Vervolgens specificeert u variaties voor elk aspect. En ten slotte creëer je handmatig nieuwe scenario's, of laat u zich inspireren door mogelijke scenario's te genereren.",
  SET_LANGUAGE: 'Kies de taal',
  SCENARIO_LOADED_MSG: 'Het scenario is ingeladen',
  COLLECTION_LOADED_MSG: "De scenario's zijn ingeladen",
  SCENARIO_NOT_LOADED_MSG:
    'Het scenario is niet ingeladen: mogelijk bestaat het al in de collectie.',
  SCENARIO_CREATED_MSG: 'Een nieuw scenario is aangemaakt',
  COPY_TO_CLIPBOARD: 'Kopieer tabel naar het plakbord',
  GROUP: { SELECTED: 'Geselecteerd', UNSELECTED: 'Niet geselecteerd' },
  CLONE_NARRATIVE: 'Kopieer',
  INCLUDE_DECISION_SUPPORT: 'Activeer beslisondersteuning',
  IS_DECISION_CATEGORY: 'Voor beslisondersteuning',
  PROBABILITY: 'Kans van optreden',
  IMPACT: 'Impact',
  RISK: 'Risico',
  RISK_PLACEHOLDER: 'Kans x Impact',
  PROB5: {
    0: 'Zeer laag',
    1: 'Laag',
    2: 'Gemiddeld',
    3: 'Hoog',
    4: 'Zeer hoog',
  },
  IMP5: {
    0: 'Zeer laag',
    1: 'Laag',
    2: 'Gemiddeld',
    3: 'Hoog',
    4: 'Zeer hoog',
  },
  RISK5: {
    0: 'Zeer laag',
    1: 'Laag',
    2: 'Gemiddeld',
    3: 'Hoog',
    4: 'Zeer hoog',
  },
  SUGGESTED_APPROACH: {
    TITLE: 'Aanbevolen aanpak',
    DESC: 'De aanbevolen aanpak is gebaseerd op een risicogewogen combinatie van de gekozen maatregelen.',
  },
  TEMPLATE: {
    TITLE: 'Template om de stuurfactoren te vertalen naar een lopende tekst.',
    DESC: 'Schrijf een paragraaf waarbij XXX zal vervangen worden door de waarde van factor 1, etc. Lege regels worden omgezet naar paragrafen.',
  },
  SELECT_PERSONA: "Selecteer relevante persona's",
  PERSONA_IMPRESSION: 'Impressie',
  PERSONA: {
    1: 'Persona',
    n: 'Personas',
  },
  IMAGE: 'Afbeelding',
  EDIT: 'Bewerken',
  SAVE: 'Opslaan',
  LLM: 'LLM',
  SERVICE: 'Service',
  PROVIDER: 'Provider',
  SYSTEM_PROMPT: 'Systeem prompt',
  USER_PROMPT: 'Scenario prompt',
  EFFECT_PROMPT: 'Effect prompt',
  PERSONA_PROMPT: 'Persona prompt',
  COMMUNICATIONS_PROMPT: 'Communicatie prompt',
  TEMPERATURE: {
    BTN: 'Temperatuur',
    DESC: 'Hoe creatief mag de LLM zijn (max = 1)?',
  },
  API_KEY: 'API sleutel',
  URL: 'URL',
  ASK_LLM: 'Vraag LLM',
  INCLUDE_LLM: 'Stuur naar LLM',
  OLLAMA_URL:
    'Domeinnaam (en poort, eventueel via een [proxy](https://github.com/erikvullings/proxy))',
  ADV_EDIT: 'Code editor',
  TOGGLE: { SHOW: 'Toon tabel', HIDE: 'Verberg tabel' },
  AUTO_CREATE: {
    BTN: 'Autom.',
    COUNT: 'LLM auto gen aantal',
    COUNT_DESC: 'Hoeveel verhaallijnen moeten automatisch gemaakt worden?',
  },
  AUTO_CREATE_MSG: {
    1: 'Genereer 1 scenario automatisch',
    n: "Genereer {n} scenario's automatisch",
  },
  COPY_BOX: {
    LABEL: 'Kopieer box',
    TITLE: 'Kopieer box naar clipboard',
    TOAST: 'Morphologische box is gekopieerd naar het clipboard.',
  },
  PROMPT_TYPE: {
    LABEL: 'Prompt type',
    PROMPTS: 'Prompts',
    NARRATIVE: 'Prompt voor narratieve',
    EFFECT: 'Prompt voor effecten',
    PERSONA: "Prompt voor persona's",
    COM: 'Prompt voor communicatie',
  },
  RESPONSE_INSTRUCTIONS:
    'Start je antwoord met een korte beschrijvende titel op een eigen regel, gevolgd door een lege regel en dan de rest van de inhoud.',
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

const onChangeLocale: Listener[] = [];

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
  document.documentElement.setAttribute('lang', selectedLocale);
  await loadAndSetLocale(selectedLocale);
}

function addOnChangeListener(listener: Listener) {
  onChangeLocale.push(listener);
}

async function loadAndSetLocale(newLocale: Languages) {
  // if (i18n.currentLocale === newLocale) {
  //   return;
  // }

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
