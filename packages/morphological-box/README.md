# morphological-box

Zero-dependency TypeScript library and CLI for **morphological analysis** (Zwicky boxes): define key factors grouped in categories, their possible values, and which value combinations are impossible or unlikely (cross-consistency assessment); validate the box; and generate consistent scenarios. Boxes can also describe the solution space: *manual* factors (e.g. response measures) are left to the user instead of being generated, but are filtered by the constraints, which turns a box into a decision-support tool.

It is the engine behind [Scenario Spark](https://tno.github.io/scenario-spark), and its JSON format is directly importable there.

## Install

```bash
npm install morphological-box
```

## Library

```ts
import { validateBox, generateCombination, generateCombinations, createRandom, assessOptions, renderTemplate } from 'morphological-box';

const { valid, errors, warnings } = validateBox(box);

// One combination without impossible pairs and with as few unlikely pairs as possible
const result = generateCombination(box, { locked: { motive: ['motive-revenge'] } });
if (result.ok) console.log(result.selection); // { componentId: [valueId], ... }
else console.log(result.diagnostic);

// Up to 10 distinct consistent combinations, reproducible with a seed
const samples = generateCombinations(box, 10, { random: createRandom(42) });

// Decision support: given the situation, which measures remain?
const options = assessOptions(box, { motive: ['motive-revenge'] });
// [{ componentId, label, manual, values: [{ id, label, status: 'selected'|'available'|'unlikely'|'excluded', conflicts }] }]

// Optional narrative template: {n} is the n-th component, {componentId} also works
if (box.template) console.log(renderTemplate(box, box.template, samples[0].selection));
```

A box looks like:

```json
{
  "id": "port-attack",
  "label": "Cyber attack on a port",
  "categories": [{ "id": "actor", "label": "Actor", "componentIds": ["motive"] }],
  "components": [
    { "id": "motive", "label": "Motive", "values": [{ "id": "motive-money", "label": "Money" }, { "id": "motive-revenge", "label": "Revenge" }] }
  ],
  "inconsistencies": { "motive-revenge": { "asset-ship": true }, "asset-ship": { "motive-revenge": true } }
}
```

Set `"manual": true` on a component for values a person chooses, such as measures: `generateCombination` leaves manual components empty unless they are locked or `includeManual: true` is passed.

`inconsistencies[a][b]` is `true` for impossible, `false` for unlikely, and absent for possible pairs; entries are symmetric. Optional Scenario Spark fields: `language` (e.g. `"nl"`), `template` (narrative text with placeholders) and `llm` (prompts for LLM-written narratives).

Builders for incremental construction: `createBox`, `upsertCategory`, `removeCategory`, `setManual`, `applyInconsistencies`, `setBoxDetails`, `setTemplate`, `setLlmPrompt`, `toScenarioSpark`. Narrative helpers: `createTemplatePrompt`, `parseTemplate`, `renderTemplate`. Helpers: `assessOptions`, `checkSelection`, `countCombinations`, `diagnoseGeneration`, `getBoxComponents`, `getInconsistencyType`, `setInconsistency`, `listInconsistencies`, `normalizeInconsistencies`.

## CLI

```bash
npx -p morphological-box morph-box --help

morph-box init box.json --language en --label "Cyber attack on a port"
morph-box add-category box.json --data '{"label":"Actor","components":[{"label":"Motive","values":["Money","Revenge"]}]}'
morph-box add-category box.json --data '{"label":"Target","components":[{"label":"Asset","values":["Cranes","Ship"]}]}'
morph-box add-category box.json --data '{"label":"Measures","manual":true,"components":[{"label":"Port measures","values":["Isolate network","Stop cranes","Inform shipping"]}]}'
morph-box matrix box.json actor target
morph-box set-inconsistencies box.json --data '[{"a":"motive-revenge","b":"asset-ship","type":"impossible"}]'
morph-box template-prompt box.json   # instructions for writing the template
morph-box set-template box.json --data 'A {1} attacker targets the {2}.'
morph-box set-llm-prompt box.json --data 'Write a realistic scenario based on the following elements.'
morph-box validate box.json      # exit code 1 on errors
morph-box generate box.json -n 5 --seed 1   # manual measures stay empty; add --include-manual to fill them
morph-box options box.json --select motive-revenge   # decision support: available/excluded measures
morph-box set-manual box.json measures --off  # make a category or component automatic again
```

## Agent skill

The package ships an agent skill in [`skills/morphological-box`](skills/morphological-box/SKILL.md) that teaches an LLM agent to build a box from user input or documents with this CLI, in a chosen language, category by category (including manual measure categories for decision support), followed by within- and between-category inconsistencies, a narrative template and an LLM narrative prompt. Install it with `npx skills add TNO/scenario-spark --skill morphological-box` (add `-g` for all projects), or copy the folder to your agent's skills directory, e.g.:

```bash
cp -r node_modules/morphological-box/skills/morphological-box ~/.agents/skills/
```

## Development

From the repository root (pnpm workspace):

```bash
pnpm --filter morphological-box build
pnpm --filter morphological-box test
```

Publishing: bump the version in `package.json` and push a tag `morphological-box-v<version>`; the GitHub workflow publishes to npm (requires the `NPM_TOKEN` secret). Manually: `cd packages/morphological-box && npm publish --access public`.

## License

MIT
