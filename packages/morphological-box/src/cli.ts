#!/usr/bin/env node
import { existsSync, readFileSync, realpathSync, renameSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import {
  applyInconsistencies,
  createBox,
  removeCategory,
  setBoxDetails,
  toScenarioSpark,
  upsertCategory,
  type CategoryInput,
  type InconsistencyInput,
} from './builder.ts';
import { countCombinations, createRandom, generateCombinations, getBoxComponents } from './generate.ts';
import { getInconsistency, listInconsistencies } from './inconsistencies.ts';
import type { Component, MorphologicalBox } from './types.ts';
import { validateBox } from './validate.ts';

const HELP = `morph-box - build, validate and sample morphological boxes (Scenario Spark JSON)

Usage: morph-box <command> <file> [options]

Build incrementally (each step rewrites <file>):
  init <file> --label <text> [--desc <text>] [--id <id>] [--force]
      Create an empty box.
  details <file> [--label <text>] [--desc <text>] [--id <id>]
      Update the box (scenario) label, description or id.
  add-category <file> [--data <json> | --input <path> | < stdin]
      Add or replace a category with its components and values:
      {"label":"Actor","components":[{"label":"Motive","values":["Money","Ideology"]}]}
  remove-category <file> <categoryId>
  set-inconsistencies <file> [--data <json> | --input <path> | < stdin]
      Mark value pairs: [{"a":"<valueId>","b":"<valueId>","type":"impossible|unlikely|possible"}]
      a/b may also be a component id to address all its values.

Inspect:
  outline <file> [--json]          Categories, components and value ids.
  matrix <file> <id> [<id2>]       Cross-consistency worksheet for a category or
                                   component (with itself, or against id2).
  validate <file> [--json] [--strict]
                                   Exit code 1 on errors (or warnings with --strict).
  stats <file> [--json]            Size and constraint statistics.
  generate <file> [-n <count>] [--seed <n>] [--json]
                                   Sample consistent combinations.

Options:
  -h, --help                       Show this help.
`;

type Args = ReturnType<typeof parse>;
const parse = (argv: string[]) =>
  parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      label: { type: 'string' },
      desc: { type: 'string' },
      id: { type: 'string' },
      json: { type: 'boolean' },
      data: { type: 'string' },
      input: { type: 'string' },
      force: { type: 'boolean' },
      strict: { type: 'boolean' },
      seed: { type: 'string' },
      n: { type: 'string', short: 'n' },
      help: { type: 'boolean', short: 'h' },
    },
  });

class CliError extends Error {}

const fail = (message: string): never => {
  throw new CliError(message);
};

const readJson = (path: string): unknown => {
  if (!existsSync(path)) fail(`File not found: ${path}`);
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    return fail(`Invalid JSON in ${path}: ${(e as Error).message}`);
  }
};

/** Read a box; a Scenario Spark collection ({scenario, scenarios}) is accepted for read-only use. */
const readBox = (path: string, readOnly = false): MorphologicalBox => {
  const data = readJson(path) as Record<string, unknown>;
  if (data && typeof data === 'object' && data.scenario && Array.isArray(data.scenarios)) {
    if (!readOnly) fail('This is a Scenario Spark collection; write commands only work on a single box file.');
    return data.scenario as MorphologicalBox;
  }
  return data as unknown as MorphologicalBox;
};

const writeBox = (path: string, box: MorphologicalBox) => {
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(toScenarioSpark(box), null, 2)}\n`);
  renameSync(tmp, path);
};

const readFragment = (args: Args): unknown => {
  const { data, input } = args.values;
  let text: string | undefined;
  if (data !== undefined) text = data;
  else if (input !== undefined) text = existsSync(input) ? readFileSync(input, 'utf8') : fail(`File not found: ${input}`);
  else if (!process.stdin.isTTY) text = readFileSync(0, 'utf8');
  if (!text || !text.trim()) return fail('Provide JSON via --data, --input or stdin.');
  try {
    return JSON.parse(text);
  } catch (e) {
    return fail(`Invalid JSON fragment: ${(e as Error).message}`);
  }
};

const fileArg = (args: Args) => args.positionals[1] || fail('Missing <file> argument.');

const reportValidation = (box: MorphologicalBox, quiet = false) => {
  const { errors, warnings } = validateBox(box);
  if (!quiet) {
    for (const i of [...errors, ...warnings]) console.log(`${i.level.toUpperCase()} ${i.code} ${i.path}: ${i.message}`);
    console.log(errors.length === 0 ? `OK (${warnings.length} warning(s))` : `${errors.length} error(s), ${warnings.length} warning(s)`);
  }
  return { errors, warnings };
};

const outline = (box: MorphologicalBox) => {
  const byId = new Map(box.components.map((c) => [c.id, c]));
  const lines = [`# ${box.label} (${box.id})`];
  if (box.desc) lines.push(box.desc);
  for (const cat of box.categories) {
    lines.push('', `## ${cat.label} [category: ${cat.id}]`);
    for (const cid of cat.componentIds || []) {
      const comp = byId.get(cid);
      if (!comp) continue;
      lines.push(`- ${comp.label} [component: ${comp.id}]`);
      for (const v of comp.values || []) lines.push(`  - ${v.label} [${v.id}]`);
    }
  }
  return lines.join('\n');
};

const resolveComponents = (box: MorphologicalBox, id: string): Component[] => {
  const category = box.categories.find((c) => c.id === id);
  if (category) {
    const ids = new Set(category.componentIds || []);
    return getBoxComponents(box).filter((c) => ids.has(c.id));
  }
  const component = box.components.find((c) => c.id === id);
  return component ? [component] : fail(`Unknown category or component id "${id}".`);
};

const matrix = (box: MorphologicalBox, idA: string, idB?: string) => {
  const left = resolveComponents(box, idA);
  const right = idB ? resolveComponents(box, idB) : left;
  const lines = ['Legend: . possible, ~ unlikely, X impossible. Rows and columns are value ids.'];
  const seen = new Set<string>();
  for (const a of left) {
    for (const b of right) {
      const key = [a.id, b.id].sort().join('|');
      if (a.id === b.id || seen.has(key)) continue;
      seen.add(key);
      const cols = b.values || [];
      lines.push('', `## ${a.label} [${a.id}] x ${b.label} [${b.id}]`);
      cols.forEach((v, i) => lines.push(`  c${i + 1} = ${v.id} (${v.label})`));
      const width = Math.max(...(a.values || []).map((v) => v.id.length), 4);
      lines.push(`${''.padEnd(width)}  ${cols.map((_, i) => `c${i + 1}`.padEnd(4)).join('')}`);
      for (const v of a.values || []) {
        const cells = cols.map((w) => {
          const state = getInconsistency(box.inconsistencies, v.id, w.id);
          return (state === true ? 'X' : state === false ? '~' : '.').padEnd(4);
        });
        lines.push(`${v.id.padEnd(width)}  ${cells.join('')}  (${v.label})`);
      }
    }
  }
  if (seen.size === 0) lines.push('', 'No component pairs to compare.');
  return lines.join('\n');
};

const stats = (box: MorphologicalBox) => {
  const comps = getBoxComponents(box);
  const values = comps.reduce((sum, c) => sum + (c.values || []).length, 0);
  const pairs = listInconsistencies(box.inconsistencies || {});
  const impossible = pairs.filter((p) => p.type === 'impossible').length;
  return {
    categories: box.categories.length,
    components: comps.length,
    values,
    combinations: countCombinations(box),
    impossiblePairs: impossible,
    unlikelyPairs: pairs.length - impossible,
  };
};

export const run = (argv: string[]): number => {
  const args = parse(argv);
  const [command] = args.positionals;
  if (!command || args.values.help || command === 'help') {
    console.log(HELP);
    return 0;
  }
  const { label, desc, id, force, strict } = args.values;
  const asJson = !!args.values.json;
  switch (command) {
    case 'init': {
      const file = fileArg(args);
      if (existsSync(file) && !force) fail(`${file} already exists (use --force to overwrite).`);
      if (!label) fail('init requires --label.');
      writeBox(file, createBox({ id, label: label as string, desc }));
      console.log(`Created ${file}. Next: add-category.`);
      return 0;
    }
    case 'details': {
      const file = fileArg(args);
      writeBox(file, setBoxDetails(readBox(file), { id, label, desc }));
      console.log(`Updated ${file}.`);
      return 0;
    }
    case 'add-category': {
      const file = fileArg(args);
      const fragment = readFragment(args);
      const inputs = (Array.isArray(fragment) ? fragment : [fragment]) as CategoryInput[];
      let box = readBox(file);
      for (const input of inputs) box = upsertCategory(box, input);
      writeBox(file, box);
      const added = box.categories.filter((c) => inputs.some((i) => i.label === c.label));
      console.log(added.map((c) => outline({ ...box, categories: [c] }).split('\n').slice(2).join('\n')).join('\n'));
      return 0;
    }
    case 'remove-category': {
      const file = fileArg(args);
      const categoryId = args.positionals[2] || fail('Missing <categoryId>.');
      writeBox(file, removeCategory(readBox(file), categoryId));
      console.log(`Removed category ${categoryId}.`);
      return 0;
    }
    case 'set-inconsistencies': {
      const file = fileArg(args);
      const fragment = readFragment(args);
      const entries = (Array.isArray(fragment) ? fragment : [fragment]) as InconsistencyInput[];
      const box = applyInconsistencies(readBox(file), entries);
      writeBox(file, box);
      const s = stats(box);
      console.log(`Applied ${entries.length} entr${entries.length === 1 ? 'y' : 'ies'}: ${s.impossiblePairs} impossible, ${s.unlikelyPairs} unlikely pairs in total.`);
      reportValidation(box, true).errors.forEach((e) => console.log(`ERROR ${e.code}: ${e.message}`));
      return 0;
    }
    case 'outline': {
      const box = readBox(fileArg(args), true);
      console.log(asJson ? JSON.stringify(box.categories.map((cat) => ({ ...cat, components: resolveComponents(box, cat.id) })), null, 2) : outline(box));
      return 0;
    }
    case 'matrix': {
      const box = readBox(fileArg(args), true);
      console.log(matrix(box, args.positionals[2] || fail('Missing category or component id.'), args.positionals[3]));
      return 0;
    }
    case 'stats': {
      const s = stats(readBox(fileArg(args), true));
      console.log(asJson ? JSON.stringify(s, null, 2) : Object.entries(s).map(([k, v]) => `${k}: ${v}`).join('\n'));
      return 0;
    }
    case 'validate': {
      const box = readBox(fileArg(args), true);
      const result = validateBox(box);
      if (asJson) console.log(JSON.stringify(result, null, 2));
      else reportValidation(box);
      return result.errors.length > 0 || (strict && result.warnings.length > 0) ? 1 : 0;
    }
    case 'generate': {
      const box = readBox(fileArg(args), true);
      const count = Number(args.values.n || 5);
      const random = args.values.seed !== undefined ? createRandom(Number(args.values.seed)) : undefined;
      const results = generateCombinations(box, count, { random });
      if (results.length === 0) fail('No consistent combination exists.');
      if (asJson) {
        console.log(JSON.stringify(results, null, 2));
        return 0;
      }
      const labels = new Map(box.components.flatMap((c) => (c.values || []).map((v) => [v.id, v.label])));
      results.forEach(({ selection, unlikelyCount }, i) => {
        console.log(`\nScenario ${i + 1}${unlikelyCount ? ` (${unlikelyCount} unlikely pair(s))` : ''}`);
        for (const comp of getBoxComponents(box)) {
          const ids = selection[comp.id] || [];
          console.log(`- ${comp.label}: ${ids.map((v) => labels.get(v) || v).join(', ')}`);
        }
      });
      return 0;
    }
    default:
      return fail(`Unknown command "${command}". Run morph-box --help.`);
  }
};

const isMain = () => {
  try {
    const self = fileURLToPath(import.meta.url);
    return !!process.argv[1] && realpathSync(process.argv[1]) === realpathSync(self);
  } catch {
    return false;
  }
};

if (isMain()) {
  try {
    process.exitCode = run(process.argv.slice(2));
  } catch (e) {
    console.error(`Error: ${(e as Error).message}`);
    process.exitCode = 2;
  }
}
