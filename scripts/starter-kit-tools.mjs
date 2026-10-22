#!/usr/bin/env node
// Maintenance tools for src/models/starter-kits/<lang>.json.
//
//   to-box <lang> <boxId> <box.json>        Starter kit box -> morph-box CLI box (+ <box>.example.json)
//   to-spec <box.json> [--lang en]          CLI box (+ <box>.example.json) -> insert/replace in <lang>.json
//   check [<lang>]                          Validate every box of a kit
//   check-box <box.json>                    Validate a CLI box (+ .example.json) as starter kit box
//   extract <lang> <out.json> [--missing] [--base <old-en.json>]
//                                           Translatable strings per box. --missing: only strings that
//                                           are absent, still English, or whose English source changed
//                                           compared to --base (an earlier copy of en.json)
//   merge <lang> <strings.json>             Write translated strings into <lang>.json, using en.json
//                                           as structure
import { readFileSync, writeFileSync } from 'node:fs';
import { checkSelection, generateCombination, setInconsistency, validateBox } from 'morphological-box';
import { createScenario } from '../src/models/starter-kit.ts';

const kitPath = (lang) => new URL(`../src/models/starter-kits/${lang}.json`, import.meta.url);
const readKit = (lang) => JSON.parse(readFileSync(kitPath(lang), 'utf8'));
const writeKit = (lang, kit) => writeFileSync(kitPath(lang), `${JSON.stringify(kit, null, 2)}\n`);
const fail = (msg) => {
  console.error(`Error: ${msg}`);
  process.exit(2);
};

const toBox = (lang, boxId, file) => {
  const spec = readKit(lang).boxes.find(({ id }) => id === boxId) || fail(`Unknown box ${boxId}`);
  const factorIds = new Set(spec.categories.flatMap(({ factors }) => factors.map(({ id }) => id)));
  const categories = spec.categories.map((c) => ({
    id: factorIds.has(c.id) ? `cat-${c.id}` : c.id,
    specId: c.id,
    label: c.label,
    desc: c.desc,
    ...(c.decision ? { decisionSupport: true } : {}),
    componentIds: c.factors.map(({ id }) => id),
  }));
  const components = spec.categories.flatMap((c) =>
    c.factors.map((f) => ({
      id: f.id,
      label: f.label,
      desc: f.desc,
      ...((c.decision || (f.manual ?? c.manual)) ? { manual: true } : {}),
      values: f.values.map(([v, label]) => ({ id: `${f.id}-${v}`, label })),
    })),
  );
  const ref = (r) => r.replace('.', '-');
  const inconsistencies = {};
  for (const [a, b] of spec.exclusions) setInconsistency(inconsistencies, ref(a), ref(b), 'impossible');
  const box = {
    id: spec.id,
    label: spec.label,
    desc: spec.desc,
    language: lang,
    hideInconsistentValues: true,
    includeDecisionSupport: false,
    narratives: [],
    template: spec.template,
    llm: { id: 'clipboard', url: '', model: 'gemma3', temperature: 0.7, prompts: [
      { type: 'narrative', prompt: spec.prompt, categories: categories.map(({ id }) => id) },
    ] },
    categories,
    components,
    inconsistencies,
  };
  writeFileSync(file, `${JSON.stringify(box, null, 2)}\n`);
  const example = { label: spec.example.label, desc: spec.example.desc, choices: spec.example.choices.map(ref) };
  writeFileSync(file.replace(/\.json$/, '.example.json'), `${JSON.stringify(example, null, 2)}\n`);
  console.log(`Wrote ${file} and its .example.json`);
};

const boxToSpec = (file) => {
  const box = JSON.parse(readFileSync(file, 'utf8'));
  const example = JSON.parse(readFileSync(file.replace(/\.json$/, '.example.json'), 'utf8'));
  const { errors } = validateBox(box);
  if (errors.length) fail(`${file}: ${errors.map((e) => e.message).join('; ')}`);
  const byId = new Map(box.components.map((c) => [c.id, c]));
  const valueKey = new Map();
  const ordered = [];
  const categories = box.categories.map((c) => {
    const comps = (c.componentIds || []).map((id) => byId.get(id));
    const allManual = comps.every((f) => f.manual);
    return {
      id: c.specId || c.id,
      label: c.label,
      desc: c.desc || fail(`Category ${c.id} needs a desc`),
      ...(allManual ? { manual: true } : {}),
      ...(c.decisionSupport ? { decision: true } : {}),
      factors: comps.map((f) => {
        ordered.push(f.id);
        return {
          id: f.id,
          label: f.label,
          desc: f.desc || fail(`Component ${f.id} needs a desc`),
          ...(!allManual && f.manual ? { manual: true } : {}),
          values: f.values.map((v) => {
            const key = v.id.startsWith(`${f.id}-`) ? v.id.slice(f.id.length + 1) : v.id;
            valueKey.set(v.id, `${f.id}.${key}`);
            return [key, v.label];
          }),
        };
      }),
    };
  });
  const exclusions = [];
  const seen = new Set();
  for (const [a, row] of Object.entries(box.inconsistencies || {})) {
    for (const [b, state] of Object.entries(row)) {
      if (state === false) fail(`Only impossible pairs are supported in the starter kit (${a} x ${b})`);
      const key = [a, b].sort().join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      exclusions.push([valueKey.get(a), valueKey.get(b)]);
    }
  }
  const template = (box.template || fail('Missing template')).replace(/\{([^{}]+)\}/g, (m, token) => {
    const comp = /^\d+$/.test(token) ? box.components[Number(token) - 1] : byId.get(token);
    return comp ? `{${ordered.indexOf(comp.id) + 1}}` : m;
  });
  const prompt = box.llm?.prompts?.find((p) => p.type === 'narrative')?.prompt || fail('Missing narrative prompt');
  const spec = {
    id: box.id,
    label: box.label,
    desc: box.desc || fail('Missing box desc'),
    categories,
    exclusions,
    template,
    prompt,
    example: {
      label: example.label,
      desc: example.desc,
      choices: example.choices.map((id) => valueKey.get(id) || fail(`Unknown example value ${id}`)),
    },
  };
  return spec;
};

const toSpec = (file, lang = 'en') => {
  const spec = boxToSpec(file);
  const kit = readKit(lang);
  const index = kit.boxes.findIndex(({ id }) => id === spec.id);
  if (index >= 0) kit.boxes[index] = spec;
  else kit.boxes.push(spec);
  writeKit(lang, kit);
  console.log(`${index >= 0 ? 'Replaced' : 'Added'} ${spec.id} in ${lang}.json (${kit.boxes.length} boxes)`);
};

const checkSpecs = (specs, effectsPrompt = '', personaPrompt = '') => {
  let problems = 0;
  const report = (box, msg) => {
    problems++;
    console.log(`${box}: ${msg}`);
  };
  const ids = new Set();
  for (const spec of specs) {
    if (ids.has(spec.id)) report(spec.id, 'duplicate box id');
    ids.add(spec.id);
    let box;
    try {
      box = createScenario(spec, effectsPrompt, personaPrompt, []);
    } catch (e) {
      report(spec.id, e.message);
      continue;
    }
    const { errors, warnings } = validateBox(box);
    for (const issue of [...errors, ...warnings]) report(spec.id, `${issue.level} ${issue.code}: ${issue.message}`);
    // Decision factors are listed in their own section, so the template only describes the situation.
    const factorIsDecision = spec.categories.flatMap((c) => c.factors.map(() => !!c.decision));
    const situationNumbers = factorIsDecision.flatMap((dec, i) => (dec ? [] : [i + 1]));
    const numbers = [...spec.template.matchAll(/\{(\d+)\}/g)].map(([, n]) => Number(n)).sort((a, b) => a - b);
    if (numbers.join() !== situationNumbers.join()) report(spec.id, 'template must use every non-decision {n} exactly once and no decision factors');
    const paragraphs = spec.template.trim().split('\n');
    if (paragraphs.length !== spec.categories.filter((c) => !c.decision).length) report(spec.id, 'template needs one paragraph (line) per non-decision category');
    if (!paragraphs.every((p) => p.trim().endsWith('.'))) report(spec.id, 'every template paragraph must end with "."');
    for (const c of box.components) {
      for (const v of c.values) {
        const result = generateCombination(box, { locked: { [c.id]: [v.id] }, includeManual: true, optimize: false });
        if (!result.ok) report(spec.id, `value ${v.id} can never be part of a consistent combination`);
      }
    }
    if (!checkSelection(box, box.narratives[0].components).consistent) report(spec.id, 'example contains an excluded pair');
    if (!box.components.some((c) => c.manual)) console.log(`${spec.id}: note, no manual (measure) factors`);
    for (const c of spec.categories) {
      if (!c.decision && c.factors.length && c.factors.every((f) => f.manual ?? c.manual)) {
        console.log(`${spec.id}: warning, manual category ${c.id} is not a decision category (add "decision": true)`);
      }
    }
    if (spec.prompt.length < 100) report(spec.id, 'prompt too short');
    if (!spec.example.desc.includes('<p>') || spec.example.desc.length < 100) report(spec.id, 'example desc needs <p> paragraphs');
    if (spec.example.choices.length !== box.components.length) report(spec.id, 'example needs one choice per factor');
    if (spec.categories.length < 4) report(spec.id, 'needs >= 4 categories');
    if (box.components.length < 12) report(spec.id, 'needs >= 12 factors');
    if (spec.exclusions.length < 2) report(spec.id, 'needs >= 2 exclusions');
    for (const c of spec.categories) {
      if (!c.desc?.trim()) report(spec.id, `category ${c.id} needs a desc`);
      if (c.factors.length < 2) report(spec.id, `category ${c.id} needs >= 2 factors`);
      for (const f of c.factors) {
        if (f.values.length < 3) report(spec.id, `factor ${f.id} needs >= 3 values`);
        if (!f.desc?.trim()) report(spec.id, `factor ${f.id} needs a desc`);
      }
    }
  }
  console.log(`${specs.length} box(es), ${problems} problem(s)`);
  if (problems) process.exitCode = 1;
};

const check = (lang = 'en') => {
  const kit = readKit(lang);
  checkSpecs(kit.boxes, kit.effectsPrompt, kit.personaPrompt);
};

/** Flatten translatable strings of a box to stable, id-based paths. */
const strings = (box) => {
  const out = { label: box.label, desc: box.desc };
  for (const c of box.categories) {
    out[`cat.${c.id}.label`] = c.label;
    out[`cat.${c.id}.desc`] = c.desc;
    for (const f of c.factors) {
      out[`factor.${f.id}.label`] = f.label;
      out[`factor.${f.id}.desc`] = f.desc;
      for (const [v, label] of f.values) out[`value.${f.id}.${v}`] = label;
    }
  }
  Object.assign(out, {
    template: box.template,
    prompt: box.prompt,
    'example.label': box.example.label,
    'example.desc': box.example.desc,
  });
  return out;
};

const extract = (lang, file, missing, basePath) => {
  const en = readKit('en');
  const base = basePath ? JSON.parse(readFileSync(basePath, 'utf8')) : undefined;
  const kit = readKit(lang);
  const result = {};
  for (const enBox of en.boxes) {
    const source = strings(enBox);
    const current = kit.boxes.find(({ id }) => id === enBox.id);
    const translated = current ? strings(current) : {};
    const baseBox = base?.boxes.find(({ id }) => id === enBox.id);
    const old = baseBox ? strings(baseBox) : {};
    const entries = Object.entries(source).filter(([key, value]) =>
      !missing || lang === 'en' || !translated[key] || translated[key] === value || (base && old[key] !== value));
    if (entries.length) result[enBox.id] = Object.fromEntries(entries);
  }
  writeFileSync(file, `${JSON.stringify(result, null, 2)}\n`);
  console.log(`Wrote ${Object.values(result).reduce((n, b) => n + Object.keys(b).length, 0)} strings of ${Object.keys(result).length} boxes to ${file}`);
};

const merge = (lang, file) => {
  const en = readKit('en');
  const kit = readKit(lang);
  const updates = JSON.parse(readFileSync(file, 'utf8'));
  const boxes = en.boxes.map((enBox) => {
    const current = kit.boxes.find(({ id }) => id === enBox.id);
    const old = current ? strings(current) : {};
    const get = (key, fallback) => updates[enBox.id]?.[key] ?? old[key] ?? fallback;
    return {
      id: enBox.id,
      label: get('label', enBox.label),
      desc: get('desc', enBox.desc),
      categories: enBox.categories.map((c) => ({
        id: c.id,
        label: get(`cat.${c.id}.label`, c.label),
        desc: get(`cat.${c.id}.desc`, c.desc),
        ...(c.manual ? { manual: true } : {}),
        ...(c.decision ? { decision: true } : {}),
        factors: c.factors.map((f) => ({
          id: f.id,
          label: get(`factor.${f.id}.label`, f.label),
          desc: get(`factor.${f.id}.desc`, f.desc),
          ...(f.manual ? { manual: true } : {}),
          values: f.values.map(([v, label]) => [v, get(`value.${f.id}.${v}`, label)]),
        })),
      })),
      exclusions: enBox.exclusions,
      template: get('template', enBox.template),
      prompt: get('prompt', enBox.prompt),
      example: {
        label: get('example.label', enBox.example.label),
        desc: get('example.desc', enBox.example.desc),
        choices: enBox.example.choices,
      },
    };
  });
  writeKit(lang, { ...kit, boxes });
  console.log(`Merged ${lang}.json (${boxes.length} boxes)`);
};

const [command, ...args] = process.argv.slice(2);
const langFlag = args.indexOf('--lang');
switch (command) {
  case 'to-box':
    toBox(args[0], args[1], args[2] || fail('Usage: to-box <lang> <boxId> <box.json>'));
    break;
  case 'to-spec':
    toSpec(args[0] || fail('Usage: to-spec <box.json> [--lang en]'), langFlag >= 0 ? args[langFlag + 1] : 'en');
    break;
  case 'check':
    check(args[0]);
    break;
  case 'check-box':
    checkSpecs([boxToSpec(args[0] || fail('Usage: check-box <box.json>'))]);
    break;
  case 'extract':
    extract(
      args[0],
      args[1] || fail('Usage: extract <lang> <out.json> [--missing] [--base <old-en.json>]'),
      args.includes('--missing'),
      args.includes('--base') ? args[args.indexOf('--base') + 1] : undefined,
    );
    break;
  case 'merge':
    merge(args[0], args[1] || fail('Usage: merge <lang> <strings.json>'));
    break;
  default:
    console.log(readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(1, 13).join('\n'));
}
