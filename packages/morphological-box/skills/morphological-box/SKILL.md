---
name: morphological-box
description: Builds a morphological box (Zwicky box) for scenario planning and decision support as a validated Scenario Spark JSON file - key factors grouped in categories, their values, optional decision categories of measures (the solution space), impossible or unlikely value combinations (cross-consistency assessment), a narrative template, an LLM narrative prompt and, for decision support, an LLM decision prompt that assesses courses of action, in a chosen language - from user input or external documents, using the morph-box CLI step by step. Use when asked to create, extend or check a morphological box, morphological analysis, scenario framework, key drivers/factors, response measures/options, courses of action (COAs), or a Scenario Spark JSON.
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
- [ ] 3. One add-category per category (measure categories: "decision": true)
- [ ] 4. Inconsistencies within each category
- [ ] 5. Inconsistencies between each pair of categories
- [ ] 6. Narrative template
- [ ] 7. LLM narrative and persona prompts, concise or extensive as the user chose (decision-support boxes: also a decision prompt)
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

   **Decision support (solution space).** When the box should also help decide what to do, e.g. for crisis management, add the possible measures as separate *decision categories* with `"decision": true` (see [Decision-support boxes](#decision-support-boxes)); their factors become manual. `set-decision box.json <categoryId>[,<categoryId>]` marks existing categories (`--off` only clears the flag; factors stay manual). Use `"manual": true` without `"decision"` only for a factor a person sets that is part of the situation, not a decision (e.g. the exercise location).
4. **Within-category constraints.** For each category run `$MB matrix box.json <categoryId>` and mark pairs that cannot (`impossible`) or rarely (`unlikely`) co-occur:
   ```bash
   $MB set-inconsistencies box.json --data '[
     {"a":"actor-type-insider","b":"motive-political","type":"unlikely"},
     {"a":"actor-type-state-actor","b":"motive-revenge","type":"impossible"}]'
   ```
   Use a component id for `a` or `b` to address all its values. Use `"possible"` to undo.
5. **Between-category constraints.** For every pair of categories run `$MB matrix box.json <catA> <catB>` and add entries the same way. Work through the pairs systematically; skip none.
6. **Template.** Once the categories are final, run `$MB template-prompt box.json` and follow its instructions: one paragraph per situation category, `{n}` for the numbered key drivers. Leave decision (measure) categories out of the template: decision support can be switched off, and measures are chosen by the user. Each placeholder becomes the selected value label(s), so write the sentences around value labels, then:
   ```bash
   $MB set-template box.json --input template.txt   # or --data '…'
   ```
   It lists what each placeholder resolves to and which key drivers are unused; include all of them.
7. **LLM prompt.** Write the instruction Scenario Spark puts before the "key driver: value" lines when asking an LLM for a narrative: the role, audience, purpose, length, tone and structure, tailored to the box. Default categories are all; restrict with `--categories`.
   **Ask first** which response style the user wants, unless they already said so: *concise* (recommended; a hard word limit and a fixed Markdown structure, easy to read in the app's note fields) or *extensive* (an in-depth analysis without a word limit). Apply the choice to every prompt. Concise defaults: narrative about 300 words; persona feedback at most 150 words; decision assessment at most 250 words with exactly the parts **Verdict** (2–3 sentences), **Strengths** (2 bullets), **Risks and gaps** (2–3 bullets) and **Improvement** (1 recommendation). Extensive prompts may list all assessment criteria and ask for a full analysis, but still ask for Markdown without a title or code fences.
   ```bash
   $MB set-llm-prompt box.json --data 'You are a port security trainer. Write a realistic, 300-word incident scenario for an exercise, based on the following elements. …'
   ```
   Also set a **persona prompt** (`--type persona`) for feedback from one selected persona. In the app, Scenario Spark adds the selected persona descriptions, identifies the target persona, and includes the scenario narrative and selected factors; ask for grounded, persona-specific feedback without invented details.
   ```bash
   $MB set-llm-prompt box.json --type persona --data 'Describe how the target persona perceives this situation. Ground the feedback in the scenario and persona description; do not invent details. Return only feedback for the target persona, in at most 150 words.'
   $MB llm-prompt box.json --type persona --select <situation value ids>
   ```
   For decision-support boxes, also set a **decision prompt** (`--type decision`) that assesses one course of action; see [Decision-support boxes](#decision-support-boxes). Check what the LLM will receive with `$MB llm-prompt box.json [--type decision] --select <situation value ids> --coa <decision value ids>`.
8. **Validate.** `$MB validate box.json` must print `OK`. Fix every error; for each warning decide whether it is intended (see [REFERENCE.md](REFERENCE.md#validation-codes)). In decision-support boxes, `decision-component-not-manual` and `decision-unlinked` almost always need fixing.
9. **Sample.** `$MB generate box.json -n 5` and read the scenarios and rendered template. If one is implausible, add the missing constraint; if generation fails or values never appear, relax constraints (`$MB generate box.json -n 20 --cover` uses every value about equally often, so a value that stays rare is over-constrained); if the text reads badly, revise the template. For decision-support boxes also run `$MB options box.json --select <situation value ids>` for a few realistic situations and check that the excluded measures (`X`, under *Decisions*) are exactly the ones that make no sense. Then compare two or three plausible courses of action for one situation with `$MB compare-coas box.json --select <situation> --coa A=<measures> --coa B=<measures>`: every conflict it lists should be a real one, and a sensible COA should have none.

Deliver `box.json` with a short summary: categories, factor counts, number of impossible/unlikely pairs (`$MB stats box.json`) and any assumptions.

## Constraint guidance

- `impossible`: the combination is logically or physically excluded. Use sparingly; over-constraining kills variety.
- `unlikely`: plausible but improbable; generators avoid it when an alternative exists.
- Leave everything else possible. Only constrain pairs of values from different components.

## Decision-support boxes

A box can describe both the problem (scenario/incident) and the solution space (measures), so a professional can specify the current situation and immediately see which measures remain sensible.

- **Situation categories** first (e.g. *Hazard*, *Location and exposure*, *Impact and capacity*): normal, generated factors.
- **Measure (decision) categories** last, each with `"decision": true` (stored as `"decisionSupport": true`; its factors become `"manual": true`), e.g. *Protection and rescue*, *Containment and recovery*, *Coordination and public information*. Every value is a concrete action that can be combined with other measures (users may select several values of one measure factor). Generators leave manual factors empty, so generating a scenario never generates its solution; the user picks measures, or locks them.
- **Man-made threats** (attacks, sabotage, arson, unrest, cyber, piracy, …): add a decision category for investigation and apprehension of those responsible (e.g. securing evidence, tracing suspects, arrest or intervention, prosecution support), next to containment measures.
- **`manual` vs. decision category**: a decision category says *what* the factors are (decisions; Scenario Spark's decision support reads it); `manual` only says *don't generate this factor*. Measures belong in decision categories; use `manual` alone for situation factors a person sets.
- **Constraints** must cover situation × situation, situation × measure (measures that make no sense or cannot be applied in that situation) and measure × measure (incompatible measures). Use `impossible` for measures that must disappear from the options; Scenario Spark hides them when *hide inconsistent values* is on.
- **Template**: describe the situation only; do not add placeholders for measure (decision) categories. `template-prompt` already leaves them out.
- **LLM narrative prompt**: Scenario Spark sends the situation and the selected measures in separate sections (*Situation* and *Suggested actions*), with all selected values per factor; without measures it adds a line saying none were selected. Ask the model to describe the incident from the situation, to assess the listed measures and, when no measures are given, not to invent a solution.
- **LLM decision prompt** (`set-llm-prompt --type decision`): reflects on *one* course of action. Its input lists the situation, the scenario narrative text, the decisions of that COA (factor by factor) and only the labels of the other COAs. Write it so the model grounds every statement in the given situation and narrative; assesses suitability, timing and sequence, dependencies, side effects and risks, gaps and safeguards; and does not invent missing facts (it should name the missing information instead). Restricting `--categories` only filters the situation; the decisions are always included. Example: `$MB set-llm-prompt box.json --type decision --data 'You are an experienced crisis-management advisor. Assess the course of action below for the given situation: suitability, timing and sequence, dependencies, side effects and risks, gaps, and safeguards. Stay grounded in the situation and narrative; do not invent facts, name missing information instead. Be concise: at most 250 words, in Markdown, with exactly these parts: **Verdict**, **Strengths**, **Risks and gaps** and **Improvement**. No title or code fences.'` (concise style; drop the last two sentences for the extensive style)
- **Courses of action (COAs)**: one situation can have several alternative COAs, each a set of decision values (Scenario Spark stores them as `narratives[].coas`, the `CourseOfAction` type). `options --select <situation> --coa <decision values>` reports which COA values the situation excludes; `compare-coas` puts several COAs side by side with their conflicts.

## Using the result

- Scenario Spark: on the home page, use *Load box or collection* and pick the JSON file.
- Code: see [REFERENCE.md](REFERENCE.md#library) for `validateBox` and `generateCombination`.
