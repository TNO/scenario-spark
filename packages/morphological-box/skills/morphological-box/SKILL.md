---
name: morphological-box
description: Builds a morphological box (Zwicky box) for scenario planning as a validated Scenario Spark JSON file - key factors grouped in categories, their values, impossible or unlikely value combinations (cross-consistency assessment), a narrative template and an LLM narrative prompt, in a chosen language - from user input or external documents, using the morph-box CLI step by step. Use when asked to create, extend or check a morphological box, morphological analysis, scenario framework, key drivers/factors, or a Scenario Spark JSON.
---

# Morphological box

Produce a JSON file that Scenario Spark (and the `morphological-box` npm library) can load to generate consistent scenarios. Never write the whole JSON by hand: build it with the CLI, one step at a time, so ids stay unique and constraints stay symmetric.

## CLI

```bash
MB="npx -y -p morphological-box morph-box"   # or: node packages/morphological-box/dist/cli.js
$MB --help
```

Every write command validates its input and rewrites the file; on `Error:` (exit 2) fix the fragment and retry.

## Workflow

Copy this checklist and tick it off:

```
- [ ] 0. Language agreed
- [ ] 1. Scope: question, system boundary, time horizon, sources
- [ ] 2. init the box
- [ ] 3. One add-category per category
- [ ] 4. Inconsistencies within each category
- [ ] 5. Inconsistencies between each pair of categories
- [ ] 6. Narrative template
- [ ] 7. LLM narrative prompt
- [ ] 8. validate (no errors), review warnings
- [ ] 9. generate samples and sanity-check them
```

0. **Language.** Before anything else, settle the box language: `en`, `nl`, `fr`, `de`, `es` or `pl` (the Scenario Spark languages). Use the one the user asks for; otherwise ask, suggesting the language of their request. Write *every* label, description, the template and the prompts in it, even when sources use another language.
1. **Scope.** Read the user's request and any provided documents. Note the focal question, boundary, horizon and audience. Ask the user only for what you cannot infer. Ground factors and values in the sources; mention a source in `desc` when helpful.
2. **Init.** `$MB init box.json --language en --label "Cyber attack on a port" --desc "Scenarios for 2030 exercises; sources: …"`
3. **Categories.** Group key factors that strongly belong together (e.g. *Threat actor*, *Target*, *Modus operandi*, *Impact*, *Context*). Add each category with its components and values in one fragment:
   ```bash
   $MB add-category box.json --data '{"label":"Threat actor","components":[
     {"label":"Actor type","values":["State actor","Criminal group",{"label":"Insider","desc":"Employee or contractor"}]},
     {"label":"Motive","values":["Financial","Political","Revenge"]}]}'
   ```
   The output lists the generated ids (`actor-type-insider`). Re-running with the same label (or `"id"`) replaces that category. Quality rules are in [REFERENCE.md](REFERENCE.md#modelling-rules).
4. **Within-category constraints.** For each category run `$MB matrix box.json <categoryId>` and mark pairs that cannot (`impossible`) or rarely (`unlikely`) co-occur:
   ```bash
   $MB set-inconsistencies box.json --data '[
     {"a":"actor-type-insider","b":"motive-political","type":"unlikely"},
     {"a":"actor-type-state-actor","b":"motive-revenge","type":"impossible"}]'
   ```
   Use a component id for `a` or `b` to address all its values. Use `"possible"` to undo.
5. **Between-category constraints.** For every pair of categories run `$MB matrix box.json <catA> <catB>` and add entries the same way. Work through the pairs systematically; skip none.
6. **Template.** Once the categories are final, run `$MB template-prompt box.json` and follow its instructions: one paragraph per category, `{n}` for the numbered key drivers. Each placeholder becomes the selected value label(s), so write the sentences around value labels, then:
   ```bash
   $MB set-template box.json --input template.txt   # or --data '…'
   ```
   It lists what each placeholder resolves to and which key drivers are unused; include all of them.
7. **LLM prompt.** Write the instruction Scenario Spark puts before the "key driver: value" lines when asking an LLM for a narrative: the role, audience, purpose, length, tone and structure, tailored to the box. Default categories are all; restrict with `--categories`.
   ```bash
   $MB set-llm-prompt box.json --data 'You are a port security trainer. Write a realistic, 300-word incident scenario for an exercise, based on the following elements. …'
   ```
8. **Validate.** `$MB validate box.json` must print `OK`. Fix every error; for each warning decide whether it is intended (see [REFERENCE.md](REFERENCE.md#validation-codes)).
9. **Sample.** `$MB generate box.json -n 5` and read the scenarios and rendered template. If one is implausible, add the missing constraint; if generation fails or values never appear, relax constraints; if the text reads badly, revise the template.

Deliver `box.json` with a short summary: categories, factor counts, number of impossible/unlikely pairs (`$MB stats box.json`) and any assumptions.

## Constraint guidance

- `impossible`: the combination is logically or physically excluded. Use sparingly; over-constraining kills variety.
- `unlikely`: plausible but improbable; generators avoid it when an alternative exists.
- Leave everything else possible. Only constrain pairs of values from different components.

## Using the result

- Scenario Spark: on the home page, use *Load box or collection* and pick the JSON file.
- Code: see [REFERENCE.md](REFERENCE.md#library) for `validateBox` and `generateCombination`.
