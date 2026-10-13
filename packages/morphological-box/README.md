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

`inconsistencies[a][b]` is `true` for impossible, `false` for unlikely, and absent for possible pairs; entries are symmetric.

Builders for incremental construction: `createBox`, `upsertCategory`, `removeCategory`, `applyInconsistencies`, `setBoxDetails`, `toScenarioSpark`. Helpers: `checkSelection`, `countCombinations`, `diagnoseGeneration`, `getBoxComponents`, `getInconsistencyType`, `setInconsistency`, `listInconsistencies`, `normalizeInconsistencies`.

## CLI

```bash
npx -p morphological-box morph-box --help

morph-box init box.json --label "Cyber attack on a port"
morph-box add-category box.json --data '{"label":"Actor","components":[{"label":"Motive","values":["Money","Revenge"]}]}'
morph-box add-category box.json --data '{"label":"Target","components":[{"label":"Asset","values":["Cranes","Ship"]}]}'
morph-box matrix box.json actor target
morph-box set-inconsistencies box.json --data '[{"a":"motive-revenge","b":"asset-ship","type":"impossible"}]'
morph-box validate box.json      # exit code 1 on errors
morph-box generate box.json -n 5 --seed 1
```

## Agent skill

The package ships an agent skill in [`skills/morphological-box`](skills/morphological-box/SKILL.md) that teaches an LLM agent to build a box from user input or documents with this CLI, category by category, followed by within- and between-category inconsistencies. Copy the folder to your agent's skills directory, e.g.:

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
