#!/usr/bin/env node
import { existsSync, readFileSync, realpathSync, renameSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import {
  applyInconsistencies,
  createBox,
  removeCategory,
  setBoxDetails,
  setDecision,
  setManual,
  toScenarioSpark,
  upsertCategory,
  type CategoryInput,
  type InconsistencyInput,
} from './builder.ts';
import {
  assessOptions,
  countCombinations,
  createRandom,
  generateCombinations,
  getBoxComponents,
  getDecisionComponentIds,
  type ComponentOptions,
} from './generate.ts';
import { assessCoa, compareCoas, nextCoaLabel, type CoaAssessment, type CoaInput } from './coa.ts';
import { getInconsistency, listInconsistencies } from './inconsistencies.ts';
import {
  createLlmPrompt,
  createTemplatePrompt,
  parseTemplate,
  renderTemplate,
  setLlmPrompt,
  setTemplate,
  LLM_PROMPT_TYPES,
  type LlmPromptType,
  type NarrativeSettings,
} from './narrative.ts';
import type { Component, MorphologicalBox as BaseBox } from './types.ts';
import { validateBox } from './validate.ts';

const HELP = `morph-box - build, validate and sample morphological boxes (Scenario Spark JSON)

Usage: morph-box <command> <file> [options]

Build incrementally (each step rewrites <file>):
  init <file> --label <text> [--language <code>] [--desc <text>] [--id <id>] [--force]
      Create an empty box. --language (en, nl, fr, de, es, pl) is the language
      of all labels, the template and the prompts.
  details <file> [--label <text>] [--desc <text>] [--id <id>] [--language <code>]
      Update the box (scenario) label, description, id or language.
  add-category <file> [--data <json> | --input <path> | < stdin]
      Add or replace a category with its components and values:
      {"label":"Actor","components":[{"label":"Motive","values":["Money","Ideology"]}]}
      Add "decision": true to a category of decisions or measures that a person
      chooses (its components become manual), or "manual": true to a category or
      component that is chosen by a person but is not a decision.
  remove-category <file> <categoryId>
  set-manual <file> <id>[,<id>...] [--off]
      Mark categories or components as manual (chosen by a person, e.g.
      measures; never generated unless locked) or, with --off, automatic.
  set-decision <file> <categoryId>[,<categoryId>...] [--off]
      Mark categories as decision categories (decisions or measures a person
      chooses) and make their components manual. --off only clears the
      decision flag; the components stay manual (use set-manual --off).
  set-inconsistencies <file> [--data <json> | --input <path> | < stdin]
      Mark value pairs: [{"a":"<valueId>","b":"<valueId>","type":"impossible|unlikely|possible"}]
      a/b may also be a component id to address all its values.
  set-template <file> [--data <text> | --input <path> | < stdin]
      Set the narrative template (plain text). {n} is the n-th key driver as
      numbered by template-prompt; {componentId} also works.
  set-llm-prompt <file> [--type narrative|persona|effect|communications|decision]
                 [--categories <id,id>] [--data <text> | --input <path> | < stdin]
      Set the LLM prompt (plain text) for the type (default narrative), applied
      to the given categories (default all). A decision prompt assesses one
      course of action; its categories only filter the situation.

Inspect:
  outline <file> [--json]          Categories (decision categories are marked),
                                   components and value ids.
  template-prompt <file> [--language <code>]
                                   Instructions and numbered key drivers for
                                   writing the template.
  matrix <file> <id> [<id2>]       Cross-consistency worksheet for a category or
                                   component (with itself, or against id2).
  validate <file> [--json] [--strict]
                                   Exit code 1 on errors (or warnings with --strict).
  stats <file> [--json]            Size and constraint statistics.
  generate <file> [-n <count>] [--seed <n>] [--include-manual] [--json]
                                   Sample consistent combinations (rendered with
                                   the template, if any). Manual components stay
                                   empty unless --include-manual is given.
  options <file> --select <valueId>[,<valueId>...] [--json]
                                   Decision support: given the selected values
                                   (e.g. the current situation), list for every
                                   other component which values are available,
                                   unlikely or excluded (and why), grouped into
                                   situation and decisions if the box has
                                   decision categories.
          [--coa [<label>=]<valueId>[,<valueId>...]]...
                                   Also assess courses of action (decision
                                   values): which are excluded or unlikely
                                   given the situation, or conflict with each
                                   other.
  compare-coas <file> --select <valueIds> --coa [<label>=]<valueIds>
               --coa [<label>=]<valueIds> [...] [--json]
                                   Side-by-side table of courses of action for
                                   one situation, with their conflicts.
  llm-prompt <file> [--type narrative|persona|effect|communications|decision]
             [--select <valueIds>] [--coa [<label>=]<valueIds>]...
             [--active <label>] [--text <narrative text>] [--categories <id,id>]
                                   Print the LLM prompt as Scenario Spark builds
                                   it: the box prompt of the type, then the
                                   situation and the decisions (of the --active
                                   or first COA for decision prompts; the other
                                   COAs are listed for contrast).

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
      language: { type: 'string' },
      type: { type: 'string' },
      categories: { type: 'string' },
      json: { type: 'boolean' },
      data: { type: 'string' },
      input: { type: 'string' },
      force: { type: 'boolean' },
      strict: { type: 'boolean' },
      seed: { type: 'string' },
      select: { type: 'string' },
      coa: { type: 'string', multiple: true },
      active: { type: 'string' },
      text: { type: 'string' },
      off: { type: 'boolean' },
      'include-manual': { type: 'boolean' },
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

const readText = (args: Args, what: string): string => {
  const { data, input } = args.values;
  let text: string | undefined;
  if (data !== undefined) text = data;
  else if (input !== undefined) text = existsSync(input) ? readFileSync(input, 'utf8') : fail(`File not found: ${input}`);
  else if (!process.stdin.isTTY) text = readFileSync(0, 'utf8');
  return text && text.trim() ? text : fail(`Provide ${what} via --data, --input or stdin.`);
};

const readFragment = (args: Args): unknown => {
  const text = readText(args, 'JSON');
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

const valueOwners = (box: MorphologicalBox) =>
  new Map(box.components.flatMap((c) => (c.values || []).map((v) => [v.id, c.id] as const)));

const parseIds = (text = '') => text.split(',').map((i) => i.trim()).filter(Boolean);

const toSelection = (box: MorphologicalBox, ids: string[]) => {
  const owner = valueOwners(box);
  const selection: Record<string, string[]> = {};
  for (const vid of ids) {
    const cid = owner.get(vid) || fail(`Unknown value id "${vid}".`);
    (selection[cid] ||= []).push(vid);
  }
  return selection;
};

/** Parse `--coa [<label>=]<valueId>,...` options; default labels A, B, ... */
const parseCoas = (box: MorphologicalBox, specs: string[] = []): CoaInput[] => {
  const decisions = getDecisionComponentIds(box);
  if (specs.length && decisions.size === 0) fail('The box has no decision categories (see set-decision), so it has no courses of action.');
  const owner = valueOwners(box);
  const coas: CoaInput[] = [];
  for (const spec of specs) {
    const eq = spec.indexOf('=');
    const label = eq >= 0 ? spec.slice(0, eq).trim() : '';
    const ids = parseIds(eq >= 0 ? spec.slice(eq + 1) : spec);
    for (const vid of ids) {
      const cid = owner.get(vid) || fail(`Unknown value id "${vid}".`);
      if (!decisions.has(cid)) fail(`"${vid}" is not a value of a decision category; use --select for the situation.`);
    }
    if (label && coas.some((c) => c.label === label)) fail(`Duplicate course of action label "${label}".`);
    const coaLabel = label || nextCoaLabel(coas);
    coas.push({ id: coaLabel, label: coaLabel, components: toSelection(box, ids) });
  }
  return coas;
};

const valueLabel = (box: MorphologicalBox, id: string) => {
  for (const c of box.components) {
    const v = (c.values || []).find((value) => value.id === id);
    if (v) return `${v.label} [${id}]`;
  }
  return id;
};

const coaConflictLines = (box: MorphologicalBox, coa: CoaAssessment) => {
  const lines = coa.values
    .filter((v) => v.status === 'excluded')
    .map((v) => `${coa.label}: ${v.label} [${v.id}] is excluded by ${v.conflicts.map((id) => valueLabel(box, id)).join(', ')}.`);
  for (const [a, b] of coa.internalConflicts) lines.push(`${coa.label}: ${valueLabel(box, a)} conflicts with ${valueLabel(box, b)}.`);
  return lines;
};

const outline = (box: MorphologicalBox) => {
  const byId = new Map(box.components.map((c) => [c.id, c]));
  const lines = [`# ${box.label} (${box.id})`];
  if (box.desc) lines.push(box.desc);
  for (const cat of box.categories) {
    lines.push('', `## ${cat.label} [category: ${cat.id}]${cat.decisionSupport ? ' (decision)' : ''}`);
    for (const cid of cat.componentIds || []) {
      const comp = byId.get(cid);
      if (!comp) continue;
      lines.push(`- ${comp.label} [component: ${comp.id}]${comp.manual ? ' (manual)' : ''}`);
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
    decisionCategories: box.categories.filter((c) => c.decisionSupport === true).length,
    components: comps.length,
    manualComponents: comps.filter((c) => c.manual).length,
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
  const { label, desc, id, force, strict, language } = args.values;
  const asJson = !!args.values.json;
  switch (command) {
    case 'init': {
      const file = fileArg(args);
      if (existsSync(file) && !force) fail(`${file} already exists (use --force to overwrite).`);
      if (!label) fail('init requires --label.');
      writeBox(file, createBox({ id, label: label as string, desc, language }));
      console.log(`Created ${file}${language ? ` (language: ${language})` : ''}. Next: add-category.`);
      return 0;
    }
    case 'details': {
      const file = fileArg(args);
      writeBox(file, setBoxDetails(readBox(file), { id, label, desc, language }));
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
    case 'set-manual': {
      const file = fileArg(args);
      const ids = (args.positionals[2] || fail('Missing category or component id(s).')).split(',').map((i) => i.trim()).filter(Boolean);
      const box = setManual(readBox(file), ids, !args.values.off);
      writeBox(file, box);
      const manual = getBoxComponents(box).filter((c) => c.manual).map((c) => c.id);
      console.log(`Manual components: ${manual.length ? manual.join(', ') : 'none'}.`);
      return 0;
    }
    case 'set-decision': {
      const file = fileArg(args);
      const ids = (args.positionals[2] || fail('Missing category id(s).')).split(',').map((i) => i.trim()).filter(Boolean);
      const box = setDecision(readBox(file), ids, !args.values.off);
      writeBox(file, box);
      const decisions = box.categories.filter((c) => c.decisionSupport).map((c) => c.id);
      console.log(`Decision categories: ${decisions.length ? decisions.join(', ') : 'none'}.`);
      return 0;
    }
    case 'options': {
      const box = readBox(fileArg(args), true);
      const selection = toSelection(box, parseIds(args.values.select));
      const coas = parseCoas(box, args.values.coa).map((coa) => assessCoa(box, selection, coa));
      const result = assessOptions(box, selection);
      if (asJson) {
        console.log(JSON.stringify(args.values.coa?.length ? { options: result, coas } : result, null, 2));
        return 0;
      }
      const marks = { selected: '*', available: '+', unlikely: '~', excluded: 'X' } as const;
      const lines = ['Legend: * selected, + available, ~ unlikely, X excluded (impossible with a selected value).'];
      const print = (comps: ComponentOptions[]) => {
        for (const comp of comps) {
          lines.push('', `${comp.label} [${comp.componentId}]${comp.manual ? ' (manual)' : ''}`);
          for (const v of comp.values) {
            lines.push(`  ${marks[v.status]} ${v.label} [${v.id}]${v.conflicts.length ? ` <- ${v.conflicts.join(', ')}` : ''}`);
          }
        }
      };
      if (result.some((c) => c.decision)) {
        lines.push('', '## Situation');
        print(result.filter((c) => !c.decision));
        lines.push('', '## Decisions');
        print(result.filter((c) => c.decision));
      } else print(result);
      for (const coa of coas) {
        lines.push('', `## Course of action ${coa.label}`);
        for (const v of coa.values) {
          lines.push(`  ${marks[v.status]} ${v.label} [${v.id}]${v.conflicts.length ? ` <- ${v.conflicts.join(', ')}` : ''}`);
        }
        if (coa.values.length === 0) lines.push('  (no decisions)');
        if (coa.excluded.length) lines.push(`Excluded by the situation: ${coa.excluded.join(', ')}.`);
        if (coa.unlikely.length) lines.push(`Unlikely in the situation: ${coa.unlikely.join(', ')}.`);
        for (const [a, b] of coa.internalConflicts) lines.push(`Conflicting decisions: ${a} x ${b}.`);
        if (coa.consistent && !coa.unlikely.length) lines.push('All decisions are possible in this situation.');
      }
      console.log(lines.join('\n'));
      return 0;
    }
    case 'compare-coas': {
      const box = readBox(fileArg(args), true);
      const situation = toSelection(box, parseIds(args.values.select));
      const coas = parseCoas(box, args.values.coa);
      if (coas.length === 0) fail('Provide at least one --coa [<label>=]<valueIds>.');
      const result = compareCoas(box, situation, coas);
      if (asJson) {
        console.log(JSON.stringify({ situation, ...result }, null, 2));
        return 0;
      }
      const marks = { available: '+', unlikely: '~', excluded: 'X' } as const;
      const cell = (text: string) => text.replace(/\|/g, '\\|');
      const situationIds = Object.values(situation).flat();
      const lines = [
        `Situation: ${situationIds.length ? situationIds.map((id) => valueLabel(box, id)).join(', ') : '(none)'}`,
        'Legend: + possible, ~ unlikely, X excluded by the situation.',
        '',
        `| Decision | ${result.coas.map((c) => cell(c.label)).join(' | ')} |`,
        `|---|${result.coas.map(() => '---').join('|')}|`,
      ];
      for (const comp of result.components) {
        const cells = result.coas.map((coa) => {
          const values = coa.values.filter((v) => v.componentId === comp.componentId);
          return values.length ? values.map((v) => cell(`${marks[v.status]} ${v.label}`)).join(', ') : '-';
        });
        lines.push(`| ${cell(comp.label)} | ${cells.join(' | ')} |`);
      }
      const conflicts = result.coas.flatMap((coa) => coaConflictLines(box, coa));
      lines.push('', 'Conflicts:', ...(conflicts.length ? conflicts.map((c) => `- ${c}`) : ['- none']));
      console.log(lines.join('\n'));
      return 0;
    }
    case 'llm-prompt': {
      const box = readBox(fileArg(args), true);
      const type = (args.values.type || 'narrative') as LlmPromptType;
      if (!LLM_PROMPT_TYPES.includes(type)) fail(`Prompt type must be one of: ${LLM_PROMPT_TYPES.join(', ')}.`);
      const coas = parseCoas(box, args.values.coa);
      const { active } = args.values;
      if (active && !coas.some((c) => c.label === active)) fail(`Unknown course of action "${active}".`);
      const categories = args.values.categories ? parseIds(args.values.categories) : undefined;
      const unknown = (categories || []).filter((cid) => !box.categories.some((c) => c.id === cid));
      if (unknown.length) fail(`Unknown category id(s): ${unknown.join(', ')}.`);
      if (!box.llm?.prompts?.some((p) => p.type === type && p.prompt.trim())) console.error(`Note: the box has no ${type} prompt; printing the input only.`);
      const narrative = { components: toSelection(box, parseIds(args.values.select)), coas, activeCoaId: active };
      console.log(createLlmPrompt(box, { type, narrative, categories, narrativeText: args.values.text }));
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
    case 'template-prompt': {
      const box = readBox(fileArg(args), true);
      console.log(createTemplatePrompt(box, language));
      return 0;
    }
    case 'set-template': {
      const file = fileArg(args);
      const box = setTemplate(readBox(file), readText(args, 'the template text'));
      writeBox(file, box);
      const used = parseTemplate(box, box.template!);
      console.log(`Template set with ${used.length} placeholder(s):`);
      used.forEach((p) => console.log(`  {${p.token}} -> ${p.component!.label} [${p.component!.id}]`));
      const decisionIds = getDecisionComponentIds(box);
      const unused = getBoxComponents(box).filter((c) => !decisionIds.has(c.id) && !used.some((p) => p.component?.id === c.id));
      if (unused.length) console.log(`Not in template: ${unused.map((c) => `${c.label} [${box.components.indexOf(c) + 1}]`).join(', ')}`);
      return 0;
    }
    case 'set-llm-prompt': {
      const file = fileArg(args);
      const categories = args.values.categories?.split(',').map((c) => c.trim()).filter(Boolean);
      const type = (args.values.type || 'narrative') as LlmPromptType;
      const box = setLlmPrompt(readBox(file), { type, categories, prompt: readText(args, 'the prompt text') });
      writeBox(file, box);
      const prompt = box.llm!.prompts.find((p) => p.type === type)!;
      console.log(`Set ${type} prompt for categories: ${prompt.categories.join(', ')}.`);
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
      const results = generateCombinations(box, count, { random, includeManual: !!args.values['include-manual'] });
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
          console.log(`- ${comp.label}: ${ids.length ? ids.map((v) => labels.get(v) || v).join(', ') : comp.manual ? '(manual, to be chosen)' : ''}`);
        }
        if (box.template) console.log(`\n${renderTemplate(box, box.template, selection, (labels) => labels.join(', ') || '…')}`);
      });
      return 0;
    }
    default:
      return fail(`Unknown command "${command}". Run morph-box --help.`);
  }
};

type MorphologicalBox = BaseBox & NarrativeSettings;

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
