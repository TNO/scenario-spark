import { I18n } from 'mithril-ui-form';
import translate, { Options, Translate } from 'translate.js';
import { plural_EN } from 'translate.js/pluralize';
import { messages as messagesEN } from './translations/en';
import { messages as messagesNL } from './translations/nl';
import { messages as messagesFR } from './translations/fr';
import { messages as messagesDE } from './translations/de';
import { messages as messagesES } from './translations/es';
import { messages as messagesPL } from './translations/pl';

export type Languages = 'nl' | 'en' | 'fr' | 'de' | 'es' | 'pl';

export const messages = messagesEN;
const setGuiLanguage = (language: Languages) => {
  const options = {
    // These are the defaults:
    debug: true, //[Boolean]: Logs missing translations to console and add "@@" around output, if `true`.
    array: true, //[Boolean]: Returns translations with placeholder-replacements as Arrays, if `true`.
    resolveAliases: true, //[Boolean]: Parses all translations for aliases and replaces them, if `true`.
    pluralize: plural_EN, //[Function(count)]: Provides a custom pluralization mapping function, should return a string (or number)
    useKeyForMissingTranslation: true, //[Boolean]: If there is no translation found for given key, the key is used as translation, when set to false, it returns undefiend in this case
  };

  const languageMessages = {
    en: messagesEN,
    nl: messagesNL,
    fr: messagesFR,
    de: messagesDE,
    es: messagesES,
    pl: messagesPL,
  };

  return translate(
    languageMessages[language] || messagesEN,
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
