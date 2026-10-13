# morphological-box

Zero-dependency TypeScript library and CLI for **morphological analysis** (Zwicky boxes): define key factors grouped in categories, their possible values, and which value combinations are impossible or unlikely (cross-consistency assessment); validate the box; and generate consistent scenarios.

It is the engine behind [Scenario Spark](https://tno.github.io/scenario-spark), and its JSON format is directly importable there.

## Install

```bash
npm install morphological-box
```

## Library

```ts
import { validateBox, generateCombination, generateCombinations, createRandom } from 'morphological-box';

const { valid, errors, warnings } = validateBox(box);

// One combination without impossible pairs and with as few unlikely pairs as possible
const result = generateCombination(box, { locked: { motive: ['motive-revenge'] } });
if (result.ok) console.log(result.selection); // { componentId: [valueId], ... }
else console.log(result.diagnostic);

// Up to 10 distinct consistent combinations, reproducible with a seed
const samples = generateCombinations(box, 10, { random: createRandom(42) });

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

`inconsistencies[a][b]` is `true` for impossible, `false` for unlikely, and absent for possible pairs; entries are symmetric. Optional Scenario Spark fields: `language` (e.g. `"nl"`), `template` (narrative text with placeholders) and `llm` (prompts for LLM-written narratives).

Builders for incremental construction: `createBox`, `upsertCategory`, `removeCategory`, `applyInconsistencies`, `setBoxDetails`, `setTemplate`, `setLlmPrompt`, `toScenarioSpark`. Narrative helpers: `createTemplatePrompt`, `parseTemplate`, `renderTemplate`. Helpers: `checkSelection`, `countCombinations`, `diagnoseGeneration`, `getBoxComponents`, `getInconsistencyType`, `setInconsistency`, `listInconsistencies`, `normalizeInconsistencies`.

## CLI

```bash
npx -p morphological-box morph-box --help

morph-box init box.json --language en --label "Cyber attack on a port"
morph-box add-category box.json --data '{"label":"Actor","components":[{"label":"Motive","values":["Money","Revenge"]}]}'
morph-box add-category box.json --data '{"label":"Target","components":[{"label":"Asset","values":["Cranes","Ship"]}]}'
morph-box matrix box.json actor target
morph-box set-inconsistencies box.json --data '[{"a":"motive-revenge","b":"asset-ship","type":"impossible"}]'
morph-box template-prompt box.json   # instructions for writing the template
morph-box set-template box.json --data 'A {1} attacker targets the {2}.'
morph-box set-llm-prompt box.json --data 'Write a realistic scenario based on the following elements.'
morph-box validate box.json      # exit code 1 on errors
morph-box generate box.json -n 5 --seed 1
```

## Agent skill

The package ships an agent skill in [`skills/morphological-box`](skills/morphological-box/SKILL.md) that teaches an LLM agent to build a box from user input or documents with this CLI, in a chosen language, category by category, followed by within- and between-category inconsistencies, a narrative template and an LLM narrative prompt. Copy the folder to your agent's skills directory, e.g.:

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
