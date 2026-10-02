import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const esbuild = createRequire(require.resolve('vite/package.json'))('esbuild');
const materialized = require('mithril-materialized');

const loadHomePage = (saveModel) => {
  const source = readFileSync(new URL('../src/components/home-page.ts', import.meta.url), 'utf8');
  const code = esbuild.transformSync(source, { loader: 'ts', format: 'cjs', target: 'es2022' }).code;
  const mocks = {
    '../services': {
      t: (...args) => args.join(':'),
      routingSvc: { switchTo: () => {} },
      saveModel,
      setPage: () => {},
    },
    '../models': {
      Dashboards: { HOME: 'home', SETTINGS: 'settings', DEFINE_BOX: 'define' },
      defaultModels: [
        () => ({ scenario: { id: 'empty' } }),
        () => ({ scenario: { id: 'starter' } }),
      ],
      newScenario: () => ({}),
      thresholdColors: [],
    },
    '../models/starter-kit-nl': {
      addStarterKitToModel: () => ({ added: 0 }),
      createStarterKitNl: () => ({}),
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
  const page = loadHomePage(async (_cell, preset) => { saved = preset; });
  const model = {
    scenario: { id: 'own', label: 'Own collection', components: [], categories: [], narratives: [] },
    scenarios: [],
  };
  const attrs = { state: { model, language: 'nl' }, getState: () => ({ model }) };
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
  assert.equal(radio().attrs.checkedId, 2);
  const redrawnForm = selected.view({ attrs: radio().attrs }).children.find((node) => node?.tag === 'form');
  assert.equal(redrawnForm.children[0].attrs.options[1].props.checked, true);

  redrawnForm.children[0].attrs.options[0].props.onchange(1);
  assert.equal(radio().attrs.checkedId, 1);
  await modal().attrs.buttons.find(({ label }) => label === 'OK').onclick();
  assert.equal(saved.scenario.id, 'empty');
});
