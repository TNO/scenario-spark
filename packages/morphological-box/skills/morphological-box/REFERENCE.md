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
- `manual: true` marks a component whose value a person chooses, e.g. a measure. Generators leave it empty unless it is locked (or `includeManual` / `--include-manual` is used); constraints still apply, so impossible values disappear once related values are selected.
- `language`: ISO 639-1 code; Scenario Spark supports `en`, `nl`, `fr`, `de`, `es`, `pl`.
- `template`: `{n}` is the n-th entry of `components` (1-based; the numbers `template-prompt` shows), `{componentId}` also works. `add-category` and `remove-category` renumber `{n}` when components move; placeholders of removed components become `{oldId}` and fail validation.
- `llm.prompts[]`: `type` is `narrative`, `persona`, `effect` or `communications`; `categories` selects whose key drivers follow the prompt. Scenario Spark adds missing default prompts on import.

## CLI fragments

`add-category` (object, or an array of objects):

```json
{ "id": "optional", "label": "Category", "desc": "optional", "manual": false,
  "components": [{ "id": "optional", "label": "Factor", "desc": "optional", "manual": false,
    "values": ["Short label", { "id": "optional", "label": "Value", "desc": "optional" }] }] }
```

Missing ids are derived from labels: category/component `slug(label)`, value `<componentId>-slug(label)`; a numeric suffix is added on collisions. Replacing a category (same id or label) keeps constraints of value ids that still exist and drops the rest.

`set-inconsistencies` (array, or a single entry):

```json
[{ "a": "valueOrComponentId", "b": "valueOrComponentId", "type": "impossible | unlikely | possible", "reason": "optional, not stored" }]
```

`set-template` and `set-llm-prompt` take plain text, not JSON.

`set-manual <file> <id>[,<id>]` marks categories or components as manual, `--off` reverts. `options <file> --select <valueId>,…` lists, for every component, which values are selected (`*`), available (`+`), unlikely (`~`) or excluded (`X`, with the selected values that exclude them).

Fragments may also be passed with `--input file.json` or on stdin. Read-only commands (`outline`, `matrix`, `stats`, `validate`, `generate`) also accept a Scenario Spark collection export and use its current scenario. Add `--json` for machine-readable output.

## Modelling rules

- 3–7 categories, 2–6 components per category, 2–6 values per component. Prefer fewer, sharper factors.
- Values of one component are mutually exclusive and together cover the realistic range (include a neutral or "none" value when relevant).
- Components are independent dimensions: if two factors always move together, merge them; if one value determines another, model that as constraints.
- Labels are short (1–4 words); put explanation, examples and sources in `desc` (markdown allowed).
- Use the box language for all labels, descriptions, the template and the prompts.
- Order categories from context/cause to effect, e.g. context → actor → modus operandi → target → impact.

## Validation codes

Errors (must fix): `invalid-manual`, `not-an-object`, `missing-id`, `missing-label`, `invalid-desc`, `missing-categories`, `missing-components`, `invalid-inconsistencies`, `duplicate-id`, `no-values`, `invalid-values`, `invalid-component-ids`, `unknown-component`, `unknown-value`, `invalid-inconsistency-state`, `conflicting-inconsistency`, `no-components`, `infeasible` (no combination without impossible pairs), `invalid-language`, `invalid-template`, `invalid-template-placeholder` (unknown or out-of-range placeholder), `invalid-llm`, `invalid-llm-prompt`.

Warnings (review): `too-few-values`, `duplicate-label`, `empty-category`, `component-in-multiple-categories`, `uncategorized-component`, `self-inconsistency`, `same-component-inconsistency`, `asymmetric-inconsistency`, `dead-value` (a value is impossible with every value of another component, so it is never generated), `unsupported-language`, `invalid-template-placeholder` (placeholder of an uncategorized component), `empty-llm-prompt`, `unknown-prompt-category`.

## Library

```ts
import { readFileSync } from 'node:fs';
import { validateBox, generateCombination, generateCombinations, createRandom, assessOptions, renderTemplate } from 'morphological-box';

const box = JSON.parse(readFileSync('box.json', 'utf8'));
const { valid, errors } = validateBox(box);
const result = generateCombination(box, { locked: { 'actor-type': ['actor-type-insider'] } });
if (result.ok) console.log(result.selection, result.unlikelyCount); // { componentId: [valueId] }
const samples = generateCombinations(box, 10, { random: createRandom(42) });
// Decision support: which measures remain once the situation is known?
const options = assessOptions(box, { 'actor-type': ['actor-type-insider'] }); // [{ componentId, manual, values: [{ id, status, conflicts }] }]
if (box.template) console.log(renderTemplate(box, box.template, samples[0].selection));
```

Other exports: `assessOptions`, `setManual`, `checkSelection`, `countCombinations`, `diagnoseGeneration`, `getBoxComponents`, `createBox`, `upsertCategory`, `removeCategory`, `applyInconsistencies`, `setInconsistency`, `getInconsistencyType`, `listInconsistencies`, `normalizeInconsistencies`, `toScenarioSpark`, `createTemplatePrompt`, `setTemplate`, `parseTemplate`, `renderTemplate`, `setLlmPrompt`.
