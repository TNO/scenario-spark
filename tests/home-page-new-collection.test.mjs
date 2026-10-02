import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const esbuild = createRequire(require.resolve('vite/package.json'))('esbuild');
const materialized = require('mithril-materialized');

const loadHomePage = (saveModel, locale, onStarterLanguage, onToast = () => {}, failStarter = false, onNavigate = () => {}) => {
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
      routingSvc: { switchTo: () => {}, href: (page) => `/${page}` },
      saveModel,
      setPage: () => {},
      changePage: (_attrs, page) => onNavigate(page),
    },
    '../models': {
      Dashboards: { HOME: 'home', SETTINGS: 'settings', DEFINE_BOX: 'define', CREATE_SCENARIO: 'create' },
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
      (node) => node.tag === materialized.FlatButton && node.attrs.label === 'ADD_STARTER_KIT'
    );
    await addButton.attrs.onclick();
  } finally {
    console.error = previousConsoleError;
  }
  assert.equal(saves, 0);
  assert.deepEqual(notifications, ['STARTER_KIT_LOAD_FAILED', 'STARTER_KIT_LOAD_FAILED']);
});

test('saved scenarios are browsable without an expanded factor table or unnecessary filter', () => {
  let destination;
  const page = loadHomePage(async () => {}, 'nl', () => {}, () => {}, false, (page) => { destination = page; });
  const model = {
    scenario: {
      id: 'box',
      label: 'Cyberincident',
      categories: [{ id: 'context', label: 'Context', componentIds: ['service'] }],
      components: [{ id: 'service', label: 'Service', values: [{ id: 'local', label: 'Local service' }] }],
      narratives: [{
        id: 'example',
        label: 'The local service is delayed',
        included: true,
        components: { service: ['local'] },
      }],
    },
    scenarios: [],
  };
  let selectedNarrative;
  const attrs = {
    state: { model, language: 'nl' },
    getState: () => ({ model }),
    update: ({ curNarrative }) => { selectedNarrative = curNarrative(); },
  };
  const screen = page.view({ attrs });
  const scenarioLink = find(screen, (node) => node.tag === 'a' && node.attrs?.className === 'home-scenario-link');
  assert.ok(scenarioLink);
  scenarioLink.attrs.onclick();
  assert.equal(selectedNarrative.id, 'example');
  assert.equal(find(screen, (node) => node.tag === materialized.Tabs), null);
  assert.equal(find(screen, (node) => node.attrs?.label === 'FILTER_NARRATIVES'), null);
  assert.ok(find(screen, (node) => node.tag === 'img' && node.attrs?.className === 'home-hero-image'));
  const primary = find(screen, (node) => node.tag === materialized.Button && node.attrs?.label === 'CREATE_SCENARIO:TITLE');
  assert.ok(primary);
  primary.attrs.onclick();
  assert.equal(destination, 'create');
  const boxActions = find(screen, (node) => node.attrs?.ariaLabel === 'BOX_ACTIONS');
  assert.deepEqual(boxActions.attrs.items.map(({ id }) => id), ['new', 'llm', 'download', 'delete']);
  model.scenario.narratives.push({
    id: 'second', label: 'The service recovers', included: true, components: { service: ['local'] },
  });
  const compare = find(page.view({ attrs }), (node) => node.attrs?.label === 'COMPARE_SCENARIOS');
  assert.ok(compare);
  compare.attrs.onclick();
  assert.ok(find(page.view({ attrs }), (node) => node.tag === 'div' && node.attrs?.className === 'home-comparison'));
});

test('scenario actions retain confirmation before deletion and a named download', async () => {
  let saves = 0;
  const page = loadHomePage(async () => { saves++; }, 'en', () => {});
  const model = {
    scenario: { id: 'current', label: 'Current box', categories: [], components: [], narratives: [] },
    scenarios: [{ id: 'next', label: 'Next box', categories: [], components: [], narratives: [] }],
  };
  const attrs = { state: { model, language: 'en' }, getState: () => ({ model }) };
  const actionMenu = find(page.view({ attrs }), (node) => node.attrs?.ariaLabel === 'BOX_ACTIONS');
  assert.ok(actionMenu);
  actionMenu.attrs.onSelect('new');
  const openWizard = find(page.view({ attrs }), (node) =>
    node.attrs?.isOpen === true && typeof node.attrs?.onComplete === 'function'
  );
  assert.ok(openWizard);
  openWizard.attrs.onClose();
  actionMenu.attrs.onSelect('llm');
  assert.ok(find(page.view({ attrs }), (node) =>
    node.attrs?.isOpen === true && typeof node.attrs?.onComplete === 'function'
  ));
  actionMenu.attrs.onSelect('download');
  assert.equal(find(page.view({ attrs }), (node) => node.attrs?.id === 'downloadScenario').attrs.isOpen, true);
  actionMenu.attrs.onSelect('delete');
  const confirmation = find(page.view({ attrs }), (node) => node.attrs?.id === 'deleteScenario');
  assert.equal(confirmation.attrs.isOpen, true);
  assert.equal(saves, 0);
  await confirmation.attrs.buttons.find(({ label }) => label === 'DELETE_MODEL:btn').onclick();
  assert.equal(saves, 1);
  assert.equal(model.scenario.id, 'next');
  assert.deepEqual(model.scenarios, []);
});

test('search appears for larger scenario sets and keeps a visible no-match state', () => {
  const page = loadHomePage(async () => {}, 'en', () => {});
  const model = {
    scenario: {
      id: 'box', label: 'Box', categories: [], components: [],
      narratives: Array.from({ length: 5 }, (_, index) => ({
        id: String(index), label: `Example ${index}`, included: true, components: {},
      })),
    },
    scenarios: [],
  };
  const attrs = { state: { model, language: 'en' }, getState: () => ({ model }) };
  const filter = find(page.view({ attrs }), (node) => node.attrs?.label === 'FILTER_NARRATIVES');
  assert.ok(filter);
  filter.attrs.oninput('nonexistent');
  const screen = page.view({ attrs });
  assert.ok(find(screen, (node) => node.tag === 'p' && node.attrs?.className === 'home-empty-state'));
  assert.equal(find(screen, (node) => node.tag === 'a' && node.attrs?.className === 'home-scenario-link'), null);
});

test('an empty box leads to the box editor instead of scenario creation', () => {
  let destination;
  const page = loadHomePage(async () => {}, 'nl', () => {}, () => {}, false, (route) => { destination = route; });
  const model = {
    scenario: { id: 'empty', label: 'Empty box', components: [], categories: [], narratives: [] },
    scenarios: [],
  };
  const attrs = { state: { model, language: 'nl' }, getState: () => ({ model }) };
  const screen = page.view({ attrs });
  const primary = find(screen, (node) => node.tag === materialized.Button && node.attrs?.label === 'EDIT_BOX');
  assert.ok(primary);
  primary.attrs.onclick();
  assert.equal(destination, 'define');
  assert.ok(find(screen, (node) => node.tag === 'img' && node.attrs?.className === 'home-hero-image'));
});
