# morphological-box

Zero-dependency TypeScript library and CLI for **morphological analysis** (Zwicky boxes): define key factors grouped in categories, their possible values, and which value combinations are impossible or unlikely (cross-consistency assessment); validate the box; and generate consistent scenarios. Boxes can also describe the solution space: *manual* factors (e.g. response measures) are left to the user instead of being generated, but are filtered by the constraints, which turns a box into a decision-support tool.

It is the engine behind [Scenario Spark](https://tno.github.io/scenario-spark), and its JSON format is directly importable there.

## Install

```bash
npm install morphological-box
```

## Library

```ts
import { validateBox, generateCombination, generateCombinations, createRandom, assessOptions, assessCoa, compareCoas, createLlmPrompt, renderTemplate } from 'morphological-box';

const { valid, errors, warnings } = validateBox(box);

// One combination without impossible pairs and with as few unlikely pairs as possible
const result = generateCombination(box, { locked: { motive: ['motive-revenge'] } });
if (result.ok) console.log(result.selection); // { componentId: [valueId], ... }
else console.log(result.diagnostic);

// Up to 10 distinct consistent combinations, reproducible with a seed
const samples = generateCombinations(box, 10, { random: createRandom(42) });

// Decision support: given the situation, which measures remain?
const options = assessOptions(box, { motive: ['motive-revenge'] });
// [{ componentId, label, manual, decision, values: [{ id, label, status: 'selected'|'available'|'unlikely'|'excluded', conflicts }] }]

// Optional narrative template: {n} is the n-th component, {componentId} also works
if (box.template) console.log(renderTemplate(box, box.template, samples[0].selection));

// Courses of action (decisions only) for one situation: which decisions does the situation exclude?
const situation = { motive: ['motive-revenge'] };
const coaA = { id: 'a', label: 'A', components: { 'port-measures': ['port-measures-stop-cranes'] } };
const coaB = { id: 'b', label: 'B', components: { 'port-measures': ['port-measures-isolate-network'] } };
assessCoa(box, situation, coaA); // { label, values: [{ id, status, conflicts }], excluded, unlikely, internalConflicts, consistent }
compareCoas(box, situation, [coaA, coaB]); // { components, coas: [assessment per COA] }

// LLM prompt as Scenario Spark builds it: the box prompt of the type, then situation and decisions
createLlmPrompt(box, { type: 'decision', narrative: { components: situation, coas: [coaA, coaB], activeCoaId: 'a' }, narrativeText: '…' });
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

Set `"decisionSupport": true` on a category to make it a **decision category**: its factors are decisions or measures a person chooses (the solution space), not part of the situation. Scenario Spark uses this flag for decision support. Components of a decision category should be manual: `upsertCategory` with `decision: true` (or `decisionSupport: true`) makes them manual unless a component sets `manual: false`, and `setDecision(box, categoryIds)` marks existing categories and makes their components manual. `setDecision(box, categoryIds, false)` only clears the flag; the components stay manual (use `setManual(box, ids, false)` to generate them again). Use `manual` *without* a decision category for factors that a person sets but that describe the situation, e.g. the location of an exercise. `validateBox` warns (`decision-component-not-manual`) when a decision category has non-manual components, and (`decision-unlinked`) when no impossible pair links a situation value to a decision value. `getDecisionComponentIds(box)` returns the components of decision categories.

A **course of action** (`CourseOfAction`: `{ id, label, desc?, components, notes?, reflection?, risk?, probability?, impact?, scores? }`, as in Scenario Spark's `narratives[].coas`) is one alternative set of decisions for a situation; `components` holds only decision-component selections; `probability`, `impact` and `risk` are the residual risk after the COA, and `scores` holds optional 1–5 criteria scores (`effect`, `speed`, `capacity`, `safety`, `legality`, `acceptance`). `assessCoa(box, situation, coa)` (built on `assessOptions`) reports which COA values the situation excludes or makes unlikely and which decisions are impossible together; `compareCoas` does that for several COAs. `activeCoa`, `effectiveSelection(box, narrative, coaId?)` (situation + the COA's values of decision components; other COA values are ignored) and `nextCoaLabel` mirror the app.

**LLM prompts.** `llm.prompts[].type` is `narrative`, `persona`, `effect`, `communications` or `decision`. `createLlmInput(box, { type, narrative, coaId?, categories?, narrativeText?, labels? })` renders the input Scenario Spark sends after the prompt text (`createLlmPrompt` prepends the box prompt): narrative and persona prompts of a box with decision categories get a *Situation* and a *Suggested actions* section, listing all selected values per factor, or a line saying that no measures were selected; a `decision` prompt gets the situation, the narrative text, the decisions of one COA and the labels of the other COAs (its categories only filter the situation). Headings are English by default (`DEFAULT_LLM_INPUT_LABELS`); pass `labels` to translate. `validateBox` warns (`decision-prompt-without-decisions`) about a decision prompt in a box without decision categories.

`inconsistencies[a][b]` is `true` for impossible, `false` for unlikely, and absent for possible pairs; entries are symmetric. Optional Scenario Spark fields: `language` (e.g. `"nl"`), `template` (narrative text with placeholders) and `llm` (prompts for LLM-written narratives).

Builders for incremental construction: `createBox`, `upsertCategory`, `removeCategory`, `setManual`, `setDecision`, `applyInconsistencies`, `setBoxDetails`, `setTemplate`, `setLlmPrompt`, `toScenarioSpark`. Narrative helpers: `createTemplatePrompt`, `parseTemplate`, `renderTemplate`, `createLlmInput`, `createLlmPrompt`, `renderFactorLines`. Courses of action: `assessCoa`, `compareCoas`, `activeCoa`, `effectiveSelection`, `nextCoaLabel`. Helpers: `assessOptions`, `checkSelection`, `countCombinations`, `diagnoseGeneration`, `getBoxComponents`, `getDecisionComponentIds`, `getInconsistencyType`, `setInconsistency`, `listInconsistencies`, `normalizeInconsistencies`.

## CLI

```bash
npx -p morphological-box morph-box --help

morph-box init box.json --language en --label "Cyber attack on a port"
morph-box add-category box.json --data '{"label":"Actor","components":[{"label":"Motive","values":["Money","Revenge"]}]}'
morph-box add-category box.json --data '{"label":"Target","components":[{"label":"Asset","values":["Cranes","Ship"]}]}'
morph-box add-category box.json --data '{"label":"Measures","decision":true,"components":[{"label":"Port measures","values":["Isolate network","Stop cranes","Inform shipping"]}]}'
morph-box matrix box.json actor target
morph-box set-inconsistencies box.json --data '[{"a":"motive-revenge","b":"asset-ship","type":"impossible"}]'
morph-box template-prompt box.json   # instructions for writing the template
morph-box set-template box.json --data 'A {1} attacker targets the {2}.'
morph-box set-llm-prompt box.json --data 'Write a realistic scenario based on the following elements.'
morph-box validate box.json      # exit code 1 on errors
morph-box generate box.json -n 5 --seed 1   # manual measures stay empty; add --include-manual to fill them
morph-box options box.json --select motive-revenge   # decision support: available/excluded measures, grouped into situation and decisions
morph-box set-decision box.json measures        # mark an existing category as a decision category (its components become manual)
morph-box set-decision box.json measures --off  # clear the decision flag only; components stay manual
morph-box set-manual box.json measures --off  # make a category or component automatic again
morph-box options box.json --select motive-revenge --coa A=port-measures-stop-cranes   # which decisions of course of action A does the situation exclude?
morph-box compare-coas box.json --select motive-revenge --coa A=port-measures-stop-cranes --coa B=port-measures-isolate-network,port-measures-inform-shipping   # side-by-side table with conflicts
morph-box set-llm-prompt box.json --type decision --data 'Assess the course of action for the given situation: suitability, timing, side effects, gaps. Stay grounded in the situation; do not invent facts.'
morph-box llm-prompt box.json --type decision --select motive-revenge --coa A=port-measures-stop-cranes --text 'Narrative…'   # the prompt as sent to the LLM
```

## Agent skill

The package ships an agent skill in [`skills/morphological-box`](skills/morphological-box/SKILL.md) that teaches an LLM agent to build a box from user input or documents with this CLI, in a chosen language, category by category (including manual measure categories for decision support), followed by within- and between-category inconsistencies, a narrative template, LLM narrative and persona prompts and, for decision support, a decision prompt and a check of courses of action. Install it with `npx skills add TNO/scenario-spark --skill morphological-box` (add `-g` for all projects), or copy the folder to your agent's skills directory, e.g.:

```bash
cp -r node_modules/morphological-box/skills/morphological-box ~/.agents/skills/
```

## Development

From the repository root (pnpm workspace):

```bash
pnpm --filter morphological-box build
pnpm --filter morphological-box test
```

Publishing: bump the version in `package.json` and push a tag `morphological-box-v<version>`; the GitHub workflow publishes to npm via npm Trusted Publishing (configure `TNO/scenario-spark` + `publish-morphological-box.yml` under the package's Settings → Trusted Publisher on npmjs.com; no token needed). Manually: `cd packages/morphological-box && npm publish --access public`.

## License

MIT
