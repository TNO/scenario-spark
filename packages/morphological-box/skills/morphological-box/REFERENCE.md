# Morphological box reference

## Contents

- [JSON format](#json-format)
- [CLI fragments](#cli-fragments)
- [Modelling rules](#modelling-rules)
- [Validation codes](#validation-codes)
- [Library](#library)

## JSON format

The file is a Scenario Spark scenario. The CLI adds the Scenario Spark defaults (`narratives`, `thresholdColors`, …).

```json
{
  "id": "port-attack",
  "label": "Cyber attack on a port",
  "desc": "Scenarios for 2030 exercises",
  "language": "en",
  "template": "A {1} with a {2} motive attacks the port.",
  "llm": { "id": "clipboard", "url": "", "model": "gemma3", "temperature": 0.7, "prompts": [
    { "type": "narrative", "prompt": "Write a realistic scenario based on the following elements.", "categories": ["threat-actor"] } ] },
  "categories": [{ "id": "threat-actor", "label": "Threat actor", "componentIds": ["actor-type", "motive"] }],
  "components": [
    { "id": "actor-type", "label": "Actor type", "values": [
      { "id": "actor-type-state-actor", "label": "State actor" },
      { "id": "actor-type-insider", "label": "Insider", "desc": "Employee or contractor" } ] },
    { "id": "motive", "label": "Motive", "manual": false, "values": [
      { "id": "motive-financial", "label": "Financial" },
      { "id": "motive-revenge", "label": "Revenge" } ] }
  ],
  "inconsistencies": {
    "actor-type-state-actor": { "motive-revenge": true },
    "motive-revenge": { "actor-type-state-actor": true }
  }
}
```

- All ids (box, categories, components, values) are unique.
- `inconsistencies[a][b]`: `true` = impossible, `false` = unlikely, absent = possible. Always stored in both directions.
- A component belongs to exactly one category; uncategorized components are ignored.
- `decisionSupport: true` on a category marks a *decision category*: its factors are decisions or measures a person chooses (the solution space). Its components should be `manual: true`; the builder and `set-decision` set that, and validation warns otherwise. Scenario Spark's decision support reads this flag.
- `manual: true` marks a component whose value a person chooses, e.g. a measure. Generators leave it empty unless it is locked (or `includeManual` / `--include-manual` is used); constraints still apply, so impossible values disappear once related values are selected.
- `language`: ISO 639-1 code; Scenario Spark supports `en`, `nl`, `fr`, `de`, `es`, `pl`.
- `template`: `{n}` is the n-th entry of `components` (1-based; the numbers `template-prompt` shows), `{componentId}` also works. `add-category` and `remove-category` renumber `{n}` when components move; placeholders of removed components become `{oldId}` and fail validation.
- `llm.prompts[]`: `type` is `narrative`, `persona`, `effect`, `communications` or `decision`; `categories` selects whose key drivers follow the prompt (for `decision` prompts it only filters the situation; the decisions are always listed). Scenario Spark adds missing default prompts on import.
- `narratives[]` (written by Scenario Spark): `components` holds the situation; `coas` holds the courses of action (`{ id, label, desc?, components: { decisionComponentId: [valueId] }, notes?, reflection?, risk?, probability?, impact?, scores? }`, the `CourseOfAction` type; `probability`/`impact`/`risk` are the residual risk after the COA, `scores` optional 1–5 criteria scores written by the app) and `activeCoaId` the one in use.

## CLI fragments

`add-category` (object, or an array of objects):

```json
{ "id": "optional", "label": "Category", "desc": "optional", "manual": false, "decision": false,
  "components": [{ "id": "optional", "label": "Factor", "desc": "optional", "manual": false,
    "values": ["Short label", { "id": "optional", "label": "Value", "desc": "optional" }] }] }
```

`"decision": true` (alias `"decisionSupport": true`) makes a decision category; its components default to manual unless a component sets `"manual": false`. When replacing a category, omitting `decision` keeps its current flag; `false` clears it.

Missing ids are derived from labels: category/component `slug(label)`, value `<componentId>-slug(label)`; a numeric suffix is added on collisions. Replacing a category (same id or label) keeps constraints of value ids that still exist and drops the rest.

`set-inconsistencies` (array, or a single entry):

```json
[{ "a": "valueOrComponentId", "b": "valueOrComponentId", "type": "impossible | unlikely | possible", "reason": "optional, not stored" }]
```

`set-template` and `set-llm-prompt` take plain text, not JSON.

`set-manual <file> <id>[,<id>]` marks categories or components as manual, `--off` reverts. `set-decision <file> <categoryId>[,<categoryId>]` marks categories as decision categories and makes their components manual; `--off` clears only the decision flag and leaves `manual` untouched. `options <file> --select <valueId>,…` lists, for every component, which values are selected (`*`), available (`+`), unlikely (`~`) or excluded (`X`, with the selected values that exclude them); with decision categories, the output is grouped into `## Situation` and `## Decisions` (`--json` adds `decision: true|false` per component). `outline` marks decision categories with `(decision)`; `stats` reports `decisionCategories`.

Courses of action: `--coa [<label>=]<valueId>,…` (repeatable; values of decision categories only; labels default to A, B, …). `options … --coa …` adds a `## Course of action <label>` section per COA with the status of each COA value given the situation (`+`, `~`, `X <- situation values`), the excluded and unlikely values, and decisions that are impossible together; `--json` then prints `{ options, coas }`. `compare-coas <file> --select <situation> --coa A=… --coa B=…` prints a markdown table (one row per decision factor, one column per COA, values marked `+`/`~`/`X`) followed by the conflicts; `--json` prints `{ situation, components, coas }`.

`llm-prompt <file> [--type …] [--select <situation>] [--coa …] [--active <label>] [--text <narrative>] [--categories <ids>]` prints what Scenario Spark sends to the LLM: the box prompt of the type, then the input. Narrative and persona prompts of a box with decision categories get a *Situation* section and a *Suggested actions* section (all selected values per factor, `- Factor (desc): Value, Value`), or a line saying no measures were selected. Decision prompts get the situation, the narrative text (`--text`), the decisions of the `--active` (default first) COA and the labels of the other COAs. Other types and boxes without decision categories get a plain list.

Fragments may also be passed with `--input file.json` or on stdin. Read-only commands (`outline`, `matrix`, `stats`, `validate`, `generate`) also accept a Scenario Spark collection export and use its current scenario. Add `--json` for machine-readable output.

## Modelling rules

- 3–7 categories, 2–6 components per category, 2–6 values per component. Prefer fewer, sharper factors.
- Values of one component are mutually exclusive and together cover the realistic range (include a neutral or "none" value when relevant).
- Components are independent dimensions: if two factors always move together, merge them; if one value determines another, model that as constraints.
- Labels are short (1–4 words); put explanation, examples and sources in `desc` (markdown allowed).
- Use the box language for all labels, descriptions, the template and the prompts.
- Order categories from context/cause to effect, e.g. context → actor → modus operandi → target → impact.

## Validation codes

Errors (must fix): `invalid-manual`, `invalid-decision-support`, `not-an-object`, `missing-id`, `missing-label`, `invalid-desc`, `missing-categories`, `missing-components`, `invalid-inconsistencies`, `duplicate-id`, `no-values`, `invalid-values`, `invalid-component-ids`, `unknown-component`, `unknown-value`, `invalid-inconsistency-state`, `conflicting-inconsistency`, `no-components`, `infeasible` (no combination without impossible pairs), `invalid-language`, `invalid-template`, `invalid-template-placeholder` (unknown or out-of-range placeholder), `invalid-llm`, `invalid-llm-prompt`.

Warnings (review): `too-few-values`, `duplicate-label`, `empty-category`, `component-in-multiple-categories`, `uncategorized-component`, `self-inconsistency`, `same-component-inconsistency`, `asymmetric-inconsistency`, `dead-value` (a value is impossible with every value of another component, so it is never generated), `unsupported-language`, `invalid-template-placeholder` (placeholder of an uncategorized component), `empty-llm-prompt`, `unknown-prompt-category`, `decision-prompt-without-decisions` (a decision prompt in a box without decision categories), `decision-component-not-manual` (a component of a decision category is generated), `decision-unlinked` (the box has decision categories, but no impossible pair links a situation value to a decision value, so no measure is ever excluded).

## Library

```ts
import { readFileSync } from 'node:fs';
import { validateBox, generateCombination, generateCombinations, createRandom, assessOptions, assessCoa, compareCoas, createLlmPrompt, renderTemplate } from 'morphological-box';

const box = JSON.parse(readFileSync('box.json', 'utf8'));
const { valid, errors } = validateBox(box);
const result = generateCombination(box, { locked: { 'actor-type': ['actor-type-insider'] } });
if (result.ok) console.log(result.selection, result.unlikelyCount); // { componentId: [valueId] }
const samples = generateCombinations(box, 10, { random: createRandom(42) });
// Decision support: which measures remain once the situation is known?
const options = assessOptions(box, { 'actor-type': ['actor-type-insider'] }); // [{ componentId, manual, decision, values: [{ id, status, conflicts }] }]
if (box.template) console.log(renderTemplate(box, box.template, samples[0].selection));
// Courses of action for one situation
const situation = { 'actor-type': ['actor-type-insider'] };
const coaA = { id: 'a', label: 'A', components: { 'port-measures': ['port-measures-stop-cranes'] } };
const coaB = { id: 'b', label: 'B', components: { 'port-measures': ['port-measures-isolate-network'] } };
const coa = assessCoa(box, situation, coaA);
// { label, values: [{ componentId, id, status: 'available'|'unlikely'|'excluded', conflicts }], excluded, unlikely, internalConflicts, consistent }
const table = compareCoas(box, situation, [coaA, coaB]); // { components, coas: [assessment per COA] }
// LLM input as Scenario Spark builds it (English headings by default; pass `labels` to translate)
const prompt = createLlmPrompt(box, { type: 'decision', narrative: { components: situation, coas: [coaA, coaB], activeCoaId: coaA.id }, narrativeText: '…' });
```

Other exports: `assessOptions`, `setManual`, `setDecision`, `getDecisionComponentIds`, `checkSelection`, `countCombinations`, `diagnoseGeneration`, `getBoxComponents`, `createBox`, `upsertCategory`, `removeCategory`, `applyInconsistencies`, `setInconsistency`, `getInconsistencyType`, `listInconsistencies`, `normalizeInconsistencies`, `toScenarioSpark`, `createTemplatePrompt`, `setTemplate`, `parseTemplate`, `renderTemplate`, `setLlmPrompt`, `createLlmInput`, `createLlmPrompt`, `renderFactorLines`, `DEFAULT_LLM_INPUT_LABELS`, `assessCoa`, `compareCoas`, `activeCoa`, `effectiveSelection`, `nextCoaLabel`; type `CourseOfAction`.
