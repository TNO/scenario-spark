import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { migrateUsageLegends, thresholdColors } from '../src/models/usage-legend.ts';

const require = createRequire(import.meta.url);
const esbuild = createRequire(require.resolve('vite/package.json'))('esbuild');
const load = (path, mocks) => {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  const code = esbuild.transformSync(source, { loader: 'ts', format: 'cjs', target: 'es2022' }).code;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)((name) => mocks[name] || require(name), module, module.exports);
  return module.exports;
};
const utils = load('../src/utils/index.ts', {
  'mithril-ui-form': {},
  '../models': {},
  '../services': {},
  './decision': {},
  './template-markdown': {},
  './html-to-markdown': {},
  './clipboard-markdown': {},
});
const { LegendComponent } = load('../src/components/ui/legend.ts', {
  '../../utils': utils,
  '../../services': { t: (key, params) => params ? `${key}: ${params.range}` : key },
});
const legacy = () => [
  { threshold: 0, color: '#ddeced' },
  { threshold: 1, color: '#FF7800' },
  { threshold: 2, color: '#ffff00' },
  { threshold: 3, color: '#ff0000' },
];
const swatches = (items) => LegendComponent.view({ attrs: { items } }).children[0].children;
const text = (node) => node.text ?? node.children.map((child) => child.children).join('');

test('default legend uses the six agreed count bands and blue palette', () => {
  assert.deepEqual(thresholdColors, [
    { threshold: 0, color: '#E5E7EB' },
    { threshold: 1, color: '#EFF3FF' },
    { threshold: 3, color: '#BDD7E7' },
    { threshold: 6, color: '#6BAED6' },
    { threshold: 11, color: '#2171B5' },
    { threshold: 21, color: '#084594' },
  ]);
  assert.deepEqual(swatches(thresholdColors).map(text), ['0', '1-2', '3-5', '6-10', '11-20', '21+']);
});

const find = (tree, predicate) => {
  if (Array.isArray(tree)) return tree.flatMap((node) => find(node, predicate));
  if (!tree || typeof tree !== 'object') return [];
  return [...(predicate(tree) ? [tree] : []), ...find(tree.children, predicate)];
};

test('option tooltips append a compact translated usage suffix without an extra paragraph', () => {
  const materialized = require('mithril-materialized');
  const previousWindow = globalThis.window;
  globalThis.window = { setTimeout: () => 0 };
  try {
    for (const [locale, expected] of [
      ['en', '3x used'], ['nl', '3x gebruikt'], ['fr', 'utilisée 3 fois'],
      ['de', '3x verwendet'], ['es', 'usada 3 veces'], ['pl', 'użyta 3 razy'],
    ]) {
      const { messages } = load(`../src/services/translations/${locale}.ts`, {});
      const t = (key, params) => key === 'OPTION_USAGE_COUNT'
        ? messages[key].replace('{count}', params.count)
        : key;
      const { CreateBoxPage } = load('../src/components/create-box-page.ts', {
        'mithril-materialized': { ...materialized, ThemeManager: { getEffectiveTheme: () => 'light' } },
        'mithril-ui-form': { LayoutForm: () => {}, SlimdownView: () => {} },
        '../models': { OsmTypes: [], contextTypeOptions: () => [] },
        '../services': { t, i18n: { i18n: {} } },
        '../utils': { ...utils, getDecisionCategoryIds: () => new Set() },
        './ui': { LegendComponent },
      });
      const updates = [];
      const scenario = {
        id: 'box', categories: [{ id: 'cat', componentIds: ['factor'] }],
        components: [{ id: 'factor', values: [{ id: 'option', label: 'Option', desc: 'Description' }] }],
        narratives: Array.from({ length: 3 }, () => ({ included: true, components: { factor: ['option'] } })),
        thresholdColors,
      };
      const page = CreateBoxPage();
      const attrs = { state: { model: { scenario } }, update: (patch) => updates.push(patch) };
      const tree = page.view({ attrs });
      const [tabs] = find(tree, (node) => node.tag === materialized.Tabs);
      const box = tabs.attrs.tabs[0].vnode;
      const [row] = find(box.tag().view(box), (node) => typeof node.tag === 'function' && node.attrs.sc);
      const [item] = find(row.tag().view(row), (node) => node.attrs?.item?.id === 'option');
      const component = item.tag();
      for (const description of ['Description', undefined]) {
        scenario.components[0].values[0].desc = description;
        const optionTree = component.view(item);
        assert.equal(optionTree.attrs.title, expected, locale);
        const [content] = find(optionTree, (node) => node.attrs?.onmouseenter);
        content.attrs.onmouseenter();
        assert.equal(updates.at(-1).activeTooltip, `Option${description ? ': Description' : ''} (${expected})`, locale);
        assert.ok(!updates.at(-1).activeTooltip.includes('\n'));
      }
    }
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});

test('legend sorts custom bands without mutating them and retains single-count ranges', () => {
  const items = legacy().reverse();
  const original = structuredClone(items);
  assert.deepEqual(swatches(items).map(text), ['0', '1', '2', '3+']);
  assert.deepEqual(items, original);
  assert.deepEqual(swatches([{ threshold: 5, color: '#fff' }]).map(text), ['5+']);
  assert.deepEqual(swatches([]), []);
  const tree = LegendComponent.view({ attrs: { items } });
  assert.equal(tree.attrs['aria-label'], 'OPTION_USAGE_LEGEND');
  assert.equal(swatches(items)[0].attrs.title, 'OPTION_USAGE_RANGE: 0');
  assert.ok(swatches(items).every((item) => item.key === undefined));
});

test('migration upgrades active and stored boxes without changing their content', () => {
  const narrative = { id: 'n', label: 'My story', desc: 'Keep my writing', components: { c: ['a'] } };
  const model = {
    scenario: { thresholdColors: legacy(), narratives: [narrative], dataVersion: 2 },
    scenarios: [{ thresholdColors: legacy().reverse().map((item) => ({ ...item, color: item.color.toUpperCase() })) }],
  };
  assert.equal(migrateUsageLegends(model), true);
  for (const scenario of [model.scenario, ...model.scenarios]) {
    assert.deepEqual(scenario.thresholdColors, thresholdColors);
    assert.notEqual(scenario.thresholdColors, thresholdColors);
    assert.notEqual(scenario.thresholdColors[0], thresholdColors[0]);
  }
  assert.equal(model.scenario.narratives[0], narrative);
  assert.equal(model.scenario.dataVersion, 2);
  assert.equal(migrateUsageLegends(model), false);
});

test('migration preserves customized thresholds, customized colors and empty legends', () => {
  for (const colors of [
    legacy().map((item, index) => index === 1 ? { ...item, color: '#123456' } : item),
    legacy().map((item, index) => index === 3 ? { ...item, threshold: 9 } : item),
    [],
    structuredClone(thresholdColors),
  ]) {
    const scenario = { thresholdColors: colors };
    assert.equal(migrateUsageLegends({ scenario }), false);
    assert.equal(scenario.thresholdColors, colors);
  }
});

test('missing legends get independent defaults', () => {
  const model = { scenario: {}, scenarios: [{}] };
  assert.equal(migrateUsageLegends(model), true);
  assert.deepEqual(model.scenario.thresholdColors, thresholdColors);
  assert.notEqual(model.scenario.thresholdColors, model.scenarios[0].thresholdColors);
  assert.equal(migrateUsageLegends({}), false);
});

test('each count boundary uses the matching legend color, counting included scenarios only', () => {
  const counts = [0, 1, 2, 3, 5, 6, 10, 11, 20, 21, 100];
  const narratives = Array.from({ length: 100 }, (_, index) => ({
    included: true,
    components: { c: counts.filter((count) => count > index).map(String) },
  }));
  narratives.push({ included: false, components: { c: ['0', '2'] } });
  const colors = utils.computeCompColor(narratives, thresholdColors);
  const expected = [0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5];
  counts.forEach((count, index) => {
    assert.equal((colors[count] || colors.OTHER)[0], thresholdColors[expected[index]].color, `count ${count}`);
  });
  narratives[0].included = false;
  assert.equal(utils.computeCompColor(narratives, thresholdColors)['3'][0], thresholdColors[1].color);
});

const luminance = (hex) => {
  const rgb = hex.slice(1).match(/../g).map((part) => parseInt(part, 16) / 255)
    .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
};
test('legend text meets WCAG AA in both themes and matches option text colors', () => {
  for (const dark of [false, true]) {
    const items = thresholdColors.map((item) => ({ ...item, color: dark ? utils.toDarkThemeColor(item.color) : item.color }));
    for (const swatch of swatches(items)) {
      const { color, backgroundColor } = swatch.attrs.style;
      const a = luminance(color), b = luminance(backgroundColor);
      assert.ok((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) >= 4.5, backgroundColor);
      assert.equal(color, utils.contrastingColor(backgroundColor));
    }
  }
});
