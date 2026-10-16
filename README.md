# Scenario generator

Spark is a tool to generate scenarios based on a morphological box, a.k.a. Zwicky Box after its inventor. In the morphological box, key drivers of a scenario are identified, and for each key driver, a number of potential values are specified. By combining possible combinations, the basis of a scenario can be created, and, if desired, converted to a full-fledged scenario using large language models (LLMs).

For an overview, see the [5 minute video introduction](https://www.youtube.com/watch?v=-jmsidX8yLM).

## Features

- [Online morphological box tool](tno.github.io/scenario-spark), free to use and modify.
- All data is stored locally, in your browser, and can be downloaded as JSON.
- A collection holds multiple morphological boxes. Select a box on the home page to create or reopen its scenarios; edit the box separately to change its factors and constraints. The box actions menu contains new, AI-generated, download, and delete options; the globe icon beside the theme switcher changes language.
- Items can have a location on the map, optionally including radii.
- Supports modelling inconsistencies, e.g. a small research reactor can only produce modest radiation levels during an incident.
- Can integrate with LLM-service, or by using copy-paste.
- First-time visitors receive 45 public-safety and continuity boxes in the selected app language, each with at least four categories, described key drivers, impossible combinations, an example scenario, a prose template covering every driver, and a tailored LLM prompt addressing short- and medium-term effects and conditional game changers. Each language's kit is loaded on demand from its own JSON file; the current language is cached for offline use once online. Existing browser collections are not translated or replaced when the app language changes. Use **Add or update starter kit** to add missing starter boxes and personas and update the ones you have not changed to the current kit version in the current app language; they keep their ids and position. Starter boxes or personas you edited (including boxes with your own narratives or decisions) are listed first, and only the ones you select are overwritten; the ones you keep are not offered again until the kit changes. The button only appears when the kit for the current language has missing or changed items. Boxes added before this check existed are treated as unchanged unless they hold your own narratives or decisions. **New collection** replaces the entire collection (download it first if needed).
- **Crisis-management starter kit.** Besides event safety, public buildings, religious centres and port and airport continuity, the kit covers natural hazards (earthquake, tsunami, volcanic eruption, landslide/avalanche, high water, flash flood, storm, wildfire, extreme temperature, drought, epidemic/pandemic, animal disease, insect infestation), technological hazards (CBRN industrial accident, nuclear/radiological incident, air, rail, road and maritime accidents, pipeline/gas explosion, structure collapse, dam/levee failure, power outage, telecom failure, water contamination, hazardous spill) and man-made threats (explosive and CBRN terrorism, active shooter, sabotage, hostage taking/kidnapping, demonstrations including student, farmer and embassy protests, civil unrest, maritime piracy, drone attack, hybrid threat, disinformation, cyber attack, deliberate supply-chain disruption, arson). Each box describes the incident in its first categories and the solution space in manual measure categories, such as protection and rescue, coordination and public information, and, for man-made threats, investigation and apprehension. Generating a scenario never fills in measures. The measure categories are decision categories. Starter boxes open with decision support off, so you can explore incidents first; when you open a box with decision categories, Scenario Spark asks once whether to turn decision support on (you can change it later in Settings via *Activate decision support*). With it on, describe the current situation and pick measures yourself: with *Hide inconsistent combinations* on, measures that do not fit the situation are hidden, so the box doubles as a decision-support aid.

## Persona feedback

Personas are reusable audience profiles. Select the relevant personas for each morphological box independently of decision support. For each saved scenario, their feedback captures a **hypothetical perspective**: how they might perceive the situation, respond to proposed measures, and need to be informed or involved. It is not evidence from real people. Each persona has a separate feedback field so their perspectives stay distinct.


New starter collections include translated profiles for an event visitor, a nearby resident and an event organiser. Event safety selects all three; high water and levee breach select the resident. Adding missing starter boxes also adds only their missing profiles without replacing existing personas or box selections.

In the box's LLM settings, choose **Narrative prompt** or **Persona prompt** in the prompt-type selector to edit its included categories and text; there is one editor, not an addable list of prompts. On a saved scenario, use **Copy feedback prompt** beside a persona to send its prompt to an external LLM; paste its plain-text response directly into that persona's feedback field. With Ollama or OpenAI configured, **Generate feedback** fills that field automatically. The prompt includes the selected scenario factors, the narrative when available, and the selected personas and their descriptions, while requesting a response for only the chosen persona.

## Development

This is a pnpm workspace: the app lives in the repository root, reusable packages in `packages/`.

```bash
pnpm i        # also builds packages/morphological-box
pnpm start    # dev server on http://localhost:8339
pnpm test     # app and package tests
pnpm build    # production build into ./docs
```

GitHub Pages serves committed files from `main/docs`; building locally does not publish them. Each production build stamps the service worker with a hash of its deployed files. Once the new build is committed and Pages publishes it, visiting the site updates the worker's offline cache automatically. Already-open tabs keep their current page until the next normal reload or visit; no cache clearing or hard refresh is needed.

## Morphological box library, CLI and agent skill

The scenario generation engine is published separately as the npm package [`morphological-box`](packages/morphological-box/README.md): a zero-dependency library to validate boxes, generate consistent combinations and assess which options remain for a given situation, plus the `morph-box` CLI to build a Scenario Spark JSON incrementally. Its agent skill, [`morphological-box`](packages/morphological-box/skills/morphological-box/SKILL.md), teaches any LLM agent (GitHub Copilot, Claude Code, Codex, …) to create a box from user input or documents: categories, key drivers and values, manual measure categories for decision support, impossible and unlikely combinations, a narrative template and LLM narrative and persona prompts, in one of the app languages. Load the result in Scenario Spark via **Load box or collection**.

### Standalone use

You do not need this repository; Node.js 18 or newer is enough.

```bash
# Run the CLI without installing
npx -y -p morphological-box morph-box --help

# Or install it in a project (library + CLI + skill)
npm install morphological-box
npx morph-box --help
```

The easiest way to install the agent skill is with the [`skills`](https://www.npmjs.com/package/skills) CLI, which fetches it from this GitHub repository and links it into the skills folder of your agent(s):

```bash
npx skills add TNO/scenario-spark --skill morphological-box            # current project, choose agents interactively
npx skills add TNO/scenario-spark --skill morphological-box -g -y      # user level (all projects), no prompts
npx skills add TNO/scenario-spark --skill morphological-box -a claude-code   # a specific agent only
npx skills add TNO/scenario-spark --list                               # list the skills in the repository
npx skills update                                                      # later: update installed skills
```

Use `--copy` to copy the files instead of symlinking them.

Alternatively, copy the skill manually from the installed package to your agent's skills folder (for example `~/.agents/skills`, `~/.claude/skills` or `.github/skills` in a repository), and ask the agent to create a morphological box:

```bash
cp -r node_modules/morphological-box/skills/morphological-box ~/.agents/skills/
```

The skill calls the CLI via `npx -y -p morphological-box morph-box`, so it also works without a local install. To use the latest unpublished version instead, check out this repository and build the package (`pnpm i`), then use `node packages/morphological-box/dist/cli.js` as the CLI and copy `packages/morphological-box/skills/morphological-box` as the skill.

### CLI

Each write command validates its input and rewrites the box file, so ids stay unique and constraints symmetric.

```bash
morph-box init box.json --language en --label "Flooding" --desc "Exercise and decision-support box"
morph-box add-category box.json --data '{"label":"Water","components":[{"label":"Water depth","values":["Below 20 cm","20-100 cm","Above 1 m"]}]}'
morph-box add-category box.json --data '{"label":"Rescue measures","decision":true,"components":[{"label":"Rescue","values":["Boat rescue","Wading teams","Helicopter hoist"]}]}'
morph-box matrix box.json water rescue-measures       # cross-consistency worksheet
morph-box set-inconsistencies box.json --data '[{"a":"water-depth-below-20-cm","b":"rescue-boat-rescue","type":"impossible"}]'
morph-box template-prompt box.json                    # how to write the narrative template
morph-box set-template box.json --data $'Water depth: {1}.\nRescue: {2}.'
morph-box set-llm-prompt box.json --data 'You are a crisis-management trainer. Write a realistic incident scenario based on the following elements.'
morph-box validate box.json                           # exit code 1 on errors
morph-box generate box.json -n 5 --seed 1             # manual measures stay empty (--include-manual fills them)
morph-box options box.json --select water-depth-below-20-cm   # which measures remain for this situation?
morph-box set-llm-prompt box.json --type decision --data 'Assess the course of action for the given situation; stay grounded in it and do not invent facts.'
morph-box compare-coas box.json --select water-depth-below-20-cm --coa A=rescue-boat-rescue --coa B=rescue-wading-teams   # courses of action side by side
morph-box llm-prompt box.json --type decision --select water-depth-below-20-cm --coa A=rescue-wading-teams   # what the LLM receives
```

Other commands: `details` (box label, description, id, language), `remove-category`, `set-manual <id> [--off]`, `set-decision <categoryId> [--off]` (mark decision categories; their factors become manual, `--off` only clears the flag), `options … --coa [<label>=]<valueIds>` (which values of a course of action the situation excludes), `outline` and `stats`; add `--json` for machine-readable output. Run `morph-box --help` for all options.

### Manual measures and decision support

A factor in **manual mode** (the *Manual mode* switch of a key driver in the box settings, or `"manual": true` in the JSON) is chosen by the user and is never filled in when generating a scenario, e.g. a location you always pick yourself. Manual factors are always shown.

A **decision category** (*For decision support* in the category settings, or `"decisionSupport": true` in the JSON) holds decisions such as response measures; ticking it makes its factors manual. The box setting *Activate decision support* controls these categories:

- **Off:** decision categories are hidden on the create page, in the scenario view and in the Word export, and generating a scenario leaves them empty. When a box with decision categories is opened while decision support is off, a dialog asks once (per box) whether to turn it on.
- **On:** the create page shows them in a separate *Decisions* section below the situation. Generation never fills them. Measures that are impossible in the selected situation are greyed out with the conflicting situation value, or hidden when *Hide inconsistent combinations* is on. The scenario view and Word export list the chosen decisions in their own section, and the decision-support page compares them.

**Courses of action.** One scenario (situation) can have several courses of action (COAs): alternative sets of decisions for the same incident, so you no longer need to clone a scenario to compare measures. In the *Decisions* section, chips select the active COA (A, B, …); *Add* creates an empty one, *Duplicate* copies the active one, and the edit and delete buttons rename or remove it; each COA has its own notes. The situation is shared, so generating a new situation keeps the COAs. When the situation changes, chosen measures that no longer fit are not removed but flagged with a warning (on the chip, below the chips, in the scenario view and in the Word export). The scenario view and Word export list every COA under the situation; the LLM prompts, the narrative template and the decision-support page use the active COA of each scenario. Below the measures, each COA has optional **residual risk** selectors (probability and impact after the COA, plus the resulting risk, calculated with the same 5×5 matrix as the situation's risk); the scenario view and Word export show it as "Residual risk: Medium (situation: Very high)". In the JSON, decisions are stored in `narrative.coas` (`{ id, label, desc?, components, notes?, risk?, probability?, impact?, scores? }`) with `narrative.activeCoaId`; `narrative.components` holds the situation. Older files are migrated when loaded: decisions selected in a scenario move into COA "A". Marking an existing category as a decision category moves its selected values into a COA in the same way.

In boxes with decision categories, the narrative and persona LLM prompts (also when copied to the clipboard) list the selected values of the prompt's included categories in two sections: the **situation** (used to describe the incident) and the **suggested actions** (the chosen decisions, every selected value per factor). When decision support is off, or no decisions are selected, the actions section is left out and the prompt states that no measures were selected, so the LLM does not invent them. Boxes without decision categories keep a single list of factors.

**Comparing decisions.** The decision-support page appears in the menu once a saved scenario is selected for analysis (the *Show scenarios* page once any scenario is saved). It has four views (page state only, not saved in the box). Saved scenarios marked **Select for analysis** on the *Create scenario* page form the shortlist (the home page lists only these). Short COA names (up to four characters, such as *A* or *B1*) are shown as "Course of action A"; longer names are shown as is. *Overview* and *Compare courses of action* focus on the current scenario (the one open on the *Create scenario* page, or else the first selected scenario): *Overview* is a table with one column per COA, showing its residual probability, impact and risk and its decisions. *Compare courses of action* puts the same COAs side by side, with the decisions grouped under their decision category; measures that conflict with the situation are marked with a warning, and *Show differences only* hides decisions on which all COAs agree. A *Risk: situation → after the course of action* row shows the situation's risk and each COA's residual risk, with an arrow when the risk goes down or up. Below the table, the optional *Criteria scoring* section (collapsed until used) rates each COA from 1 to 5 (or leaves it empty) on effect, speed, capacity, safety, legality and acceptance; the weight sliders (0–5, default 1, 0 ignores a criterion) are saved per box (`scenario.criteriaWeights`), the scores per COA (`coa.scores`), and the footer shows each COA's weighted total and rank. Scores only support the discussion: they never change the suggested approach. *Robustness* and *Risk matrix* compare the selected scenarios, for example several situations that are active at the same time, such as a flood followed by a power failure. *Robustness* lists every measure against the selected scenarios (each with its active COA): chosen, excluded by the situation, or not used, each with its own icon and tooltip. The last column counts in how many scenarios a measure is chosen; measures chosen in every scenario are marked robust, measures chosen in only one scenario scenario-specific; below it, the suggested approach is explained. *Risk matrix* plots the selected scenarios (numbered, by situation probability and impact) and the COAs of the selected scenario (lettered, by residual probability and impact) on a 5×5 probability × impact grid coloured by risk level; a table below lists the same markers, and items without probability or impact are listed as not shown.

**Decision log and export.** Below every view, the *Decision log* records decisions taken during the exercise or incident: *Record decision* asks for the decision, an optional rationale and author, and optionally the scenario and course of action it concerns (defaults: the first selected scenario and its active COA). Entries are listed newest first with a locale-aware date and time; you can edit them (the original time is kept and an "edited" note added) or delete them. If the referenced scenario or COA is later removed, the entry keeps its stored label, marked as removed. The log is saved in the box (`scenario.decisionLog`: `{ id, timestamp, edited?, narrativeId?, narrativeLabel?, coaId?, coaLabel?, decision, rationale?, author? }`). **Export to Word** next to the view switcher downloads a landscape document covering the selected scenarios plus the current one: the overview and suggested approach (with *Why this suggestion*), the full COA comparison of the current scenario (regardless of *Show differences only*, with residual risk and, when used, the criteria scoring), the robustness table, the coloured risk matrix and the decision log.

**Scenario actions.** On the *Create scenario* page, the ⋮ *More actions* menu next to the scenario picker duplicates the open scenario, exports it (or the selected or all saved scenarios, optionally with the box) to Word, or deletes it after confirmation.

**Suggested approach.** Per decision factor, the *Robustness* view suggests the measures with the highest risk-weighted count over the active COAs of the selected scenarios (weight = risk level, 1 for very low to 5 for very high; ties are all suggested). The suggestion never contradicts itself: measures that are impossible in every compared situation are skipped, and of two mutually impossible measures the stronger one wins (ties: factor order, then value order in the box), after which the factor falls back to its next best consistent measure. Unlikely combinations are allowed. Below the robustness table, *Why this suggestion* explains every pick (for example "chosen in 3 of 4 scenarios, weight 11"), lists skipped measures with the reason, and says why a factor has no suggestion.

**Reflecting on decisions.** With decision support on, the box's LLM settings get a third prompt type, **Decision-reflection prompt**, whose default text (in the app language, editable like the others; your own text is never replaced) asks the LLM to assess one course of action: suitability, timing, dependencies, side effects, gaps and safeguards, grounded in the given situation. Below the notes of the active COA, **Reflect on decisions** sends the situation (the selected non-decision values of the prompt's included categories, plus the current narrative text), the COA's decisions factor by factor with all selected values, and the labels of the other COAs for contrast. The answer is stored in the COA's editable *Reflection* field (`coa.reflection` in the JSON); in clipboard mode the prompt is copied instead, so you can paste the external LLM's answer into that field.

Manual factors outside decision categories behave like the situation: with *Hide inconsistent combinations* on, selecting the current situation removes the values that are impossible in it.

## Creating templates

If you have already defined your morfological box, you can go to the settings and add a template, which converts the items in a generated scenario to a paragraph which is often easier to read. You can use the following prompt for that, combined with your morphological box which can be copied from the Settings tab, Advanced Code Editor.

```md
You are an expert in scenario design and morphological analysis.

Your task is to generate a coherent, well-written scenario TEMPLATE based on a provided morphological box.

INPUT I WILL PROVIDE:
- A numbered list of driving factors (sorted list items).
- Each driving factor has multiple possible values (unsorted list items).
- Each driving factor represents one column in a morphological box.

OUTPUT YOU MUST PRODUCE:
1. A narrative scenario TEMPLATE in the language specified by the user.
2. The template MUST use numbered placeholders:
   - {1} for values from driving factor 1
   - {2} for values from driving factor 2
   - etc., strictly following the order of the factors.
3. The template must be generic and reusable, NOT tied to specific values.
4. Write in complete, natural sentences suitable for scenario descriptions.
5. Do NOT list options or IDs; only reference them via placeholders.
6. Do NOT invent additional driving factors.
7. Optionally (if it adds clarity), include:
   - A short title for the template
   - A brief mapping list: Driving factor → placeholder number

USER-SELECTABLE PARAMETERS:
- Output language: <<USER_SPECIFIED_LANGUAGE>>
- Tone: neutral, analytical, policy-oriented (default: neutral)
- Length:
  - short (1 paragraph)
  - standard (2–3 paragraphs, default)
  - extended (rich narrative, optional)

ASSUMPTIONS:
- Each driving factor represents a meaningful dimension of uncertainty.
- Each placeholder corresponds exactly to one factor.
- Logical ordering should follow how humans typically describe scenarios
  (location/context → action → threats → conditions → actors/effects).

NOW WAIT FOR ME TO PROVIDE:
- The morphological box
- The desired output language (e.g. English, Dutch, German)
- Optional tone or length overrides
``
```
