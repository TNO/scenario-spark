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
  "categories": [{ "id": "threat-actor", "label": "Threat actor", "componentIds": ["actor-type", "motive"] }],
  "components": [
    { "id": "actor-type", "label": "Actor type", "values": [
      { "id": "actor-type-state-actor", "label": "State actor" },
      { "id": "actor-type-insider", "label": "Insider", "desc": "Employee or contractor" } ] },
    { "id": "motive", "label": "Motive", "values": [
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

## CLI fragments

`add-category` (object, or an array of objects):

```json
{ "id": "optional", "label": "Category", "desc": "optional",
  "components": [{ "id": "optional", "label": "Factor", "desc": "optional",
    "values": ["Short label", { "id": "optional", "label": "Value", "desc": "optional" }] }] }
```

Missing ids are derived from labels: category/component `slug(label)`, value `<componentId>-slug(label)`; a numeric suffix is added on collisions. Replacing a category (same id or label) keeps constraints of value ids that still exist and drops the rest.

`set-inconsistencies` (array, or a single entry):

```json
[{ "a": "valueOrComponentId", "b": "valueOrComponentId", "type": "impossible | unlikely | possible", "reason": "optional, not stored" }]
```

Fragments may also be passed with `--input file.json` or on stdin. Read-only commands (`outline`, `matrix`, `stats`, `validate`, `generate`) also accept a Scenario Spark collection export and use its current scenario. Add `--json` for machine-readable output.

## Modelling rules

- 3–7 categories, 2–6 components per category, 2–6 values per component. Prefer fewer, sharper factors.
- Values of one component are mutually exclusive and together cover the realistic range (include a neutral or "none" value when relevant).
- Components are independent dimensions: if two factors always move together, merge them; if one value determines another, model that as constraints.
- Labels are short (1–4 words); put explanation, examples and sources in `desc` (markdown allowed).
- Use the user's language for labels and descriptions.
- Order categories from context/cause to effect, e.g. context → actor → modus operandi → target → impact.

## Validation codes

Errors (must fix): `not-an-object`, `missing-id`, `missing-label`, `invalid-desc`, `missing-categories`, `missing-components`, `invalid-inconsistencies`, `duplicate-id`, `no-values`, `invalid-values`, `invalid-component-ids`, `unknown-component`, `unknown-value`, `invalid-inconsistency-state`, `conflicting-inconsistency`, `no-components`, `infeasible` (no combination without impossible pairs).

Warnings (review): `too-few-values`, `duplicate-label`, `empty-category`, `component-in-multiple-categories`, `uncategorized-component`, `self-inconsistency`, `same-component-inconsistency`, `asymmetric-inconsistency`, `dead-value` (a value is impossible with every value of another component, so it is never generated).

## Library

```ts
import { readFileSync } from 'node:fs';
import { validateBox, generateCombination, generateCombinations, createRandom } from 'morphological-box';

const box = JSON.parse(readFileSync('box.json', 'utf8'));
const { valid, errors } = validateBox(box);
const result = generateCombination(box, { locked: { 'actor-type': ['actor-type-insider'] } });
if (result.ok) console.log(result.selection, result.unlikelyCount); // { componentId: [valueId] }
const samples = generateCombinations(box, 10, { random: createRandom(42) });
```

Other exports: `checkSelection`, `countCombinations`, `diagnoseGeneration`, `getBoxComponents`, `createBox`, `upsertCategory`, `removeCategory`, `applyInconsistencies`, `setInconsistency`, `getInconsistencyType`, `listInconsistencies`, `normalizeInconsistencies`, `toScenarioSpark`.
