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
