import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const esbuild = createRequire(require.resolve('vite/package.json'))('esbuild');
const materialized = require('mithril-materialized');

const loadHomePage = (saveModel, locale, onStarterLanguage, onToast = () => {}, failStarter = false) => {
  const source = readFileSync(new URL('../src/components/home-page.ts', import.meta.url), 'utf8');
  const code = esbuild.transformSync(source, { loader: 'ts', format: 'cjs', target: 'es2022' }).code;
  const mocks = {
    'mithril-materialized': {
      ...materialized,
      toast: ({ html }) => onToast(html),
    },
    '../services': {
      t: (...args) => args.join(':'),
      i18n: { currentLocale: locale },
      routingSvc: { switchTo: () => {} },
      saveModel,
      setPage: () => {},
    },
    '../models': {
      Dashboards: { HOME: 'home', SETTINGS: 'settings', DEFINE_BOX: 'define' },
      defaultModels: [
        () => ({ scenario: { id: 'empty' } }),
        (language) => {
          onStarterLanguage(language);
          if (failStarter) throw new Error('Kit unavailable');
          return { scenario: { id: 'starter' } };
        },
      ],
      newScenario: () => ({}),
      thresholdColors: [],
    },
    '../models/starter-kit': {
      addStarterKitToModel: () => ({ added: 0 }),
      loadStarterKit: async () => {
        if (failStarter) throw new Error('Kit unavailable');
        return {};
      },
    },
    '../utils': {
      SAVED: 'SAVED',
      capitalize: (value) => value,
      convertFromOld: () => ({}),
      modelToSaveName: () => '',
      uploadFile: () => {},
    },
    './new-scenario-wizard': { NewScenarioWizard: () => ({}) },
    './llm-scenario-wizard': { LLMScenarioWizard: () => ({}) },
    '../utils/import-model': { parseImportedModel: () => ({}) },
    '../utils/json-filename': { jsonFilename: () => '' },
  };
  const module = { exports: {} };
  globalThis.window = { File: true, FileReader: true, FileList: true, Blob: true };
  new Function('require', 'module', 'exports', code)(
    (name) => name.startsWith('../assets/') ? '' : mocks[name] || require(name),
    module,
    module.exports
  );
  return module.exports.HomePage();
};

const find = (node, predicate) => {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = find(child, predicate);
      if (found) return found;
    }
  } else if (node && typeof node === 'object') {
    if (predicate(node)) return node;
    return find(node.children, predicate);
  }
  return null;
};

test('new collection keeps the selected radio checked after redraw and saves that preset', async () => {
  let saved;
  let selectedLanguage;
  const page = loadHomePage(
    async (_cell, preset) => { saved = preset; },
    'fr',
    (language) => { selectedLanguage = language; }
  );
  const model = {
    scenario: { id: 'own', label: 'Own collection', components: [], categories: [], narratives: [] },
    scenarios: [],
  };
  const attrs = { state: { model, language: 'fr' }, getState: () => ({ model }) };
  const modal = () => find(
    page.view({ attrs }),
    (node) => node.tag === materialized.ModalPanel && node.attrs.id === 'clearAll'
  );
  const radio = () => find(
    modal().attrs.description,
    (node) => node.tag === materialized.RadioButtons
  );

  assert.equal(radio().attrs.checkedId, 1);
  const selected = materialized.RadioButtons();
  selected.oninit({ attrs: radio().attrs });
  const form = selected.view({ attrs: radio().attrs }).children.find((node) => node?.tag === 'form');
  const starterOption = form.children[0].attrs.options[1];
  starterOption.props.onchange(2);

  await modal().attrs.buttons.find(({ label }) => label === 'OK').onclick();
  assert.equal(saved.scenario.id, 'starter');
  assert.equal(selectedLanguage, 'fr');
  assert.equal(radio().attrs.checkedId, 2);
  const redrawnForm = selected.view({ attrs: radio().attrs }).children.find((node) => node?.tag === 'form');
  assert.equal(redrawnForm.children[0].attrs.options[1].props.checked, true);

  redrawnForm.children[0].attrs.options[0].props.onchange(1);
  assert.equal(radio().attrs.checkedId, 1);
  await modal().attrs.buttons.find(({ label }) => label === 'OK').onclick();
  assert.equal(saved.scenario.id, 'empty');
});

test('unavailable locale kit reports an error without changing the collection', async () => {
  const notifications = [];
  let saves = 0;
  const page = loadHomePage(
    async () => { saves++; },
    'fr',
    () => {},
    (message) => notifications.push(message),
    true
  );
  const model = {
    scenario: { id: 'own', label: 'Own collection', components: [], categories: [], narratives: [] },
    scenarios: [],
  };
  const attrs = { state: { model, language: 'fr' }, getState: () => ({ model }) };
  const findModal = () => find(
    page.view({ attrs }),
    (node) => node.tag === materialized.ModalPanel && node.attrs.id === 'clearAll'
  );
  const radios = find(findModal().attrs.description, (node) => node.tag === materialized.RadioButtons);
  radios.attrs.onchange(2);
  const previousConsoleError = console.error;
  console.error = () => {};
  try {
    await findModal().attrs.buttons.find(({ label }) => label === 'OK').onclick();
    const addButton = find(
      page.view({ attrs }),
      (node) => node.tag === materialized.Button && node.attrs.label === 'ADD_STARTER_KIT'
    );
    await addButton.attrs.onclick();
  } finally {
    console.error = previousConsoleError;
  }
  assert.equal(saves, 0);
  assert.deepEqual(notifications, ['STARTER_KIT_LOAD_FAILED', 'STARTER_KIT_LOAD_FAILED']);
});
