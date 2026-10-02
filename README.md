# Scenario generator

Spark is a tool to generate scenarios based on a morphological box, a.k.a. Zwicky Box after its inventor. In the morphological box, key drivers of a scenario are identified, and for each key driver, a number of potential values are specified. By combining possible combinations, the basis of a scenario can be created, and, if desired, converted to a full-fledged scenario using large language models (LLMs).

For an overview, see the [5 minute video introduction](https://www.youtube.com/watch?v=-jmsidX8yLM).

## Features

- [Online morphological box tool](tno.github.io/scenario-spark), free to use and modify.
- All data is stored locally, in your browser, and can be downloaded as JSON.
- Supports one or more morphological boxes to define a single scenario. For example, one for a dissaster scenario, and one for measures.
- Items can have a location on the map, optionally including radii.
- Supports modelling inconsistencies, e.g. a small research reactor can only produce modest radiation levels during an incident.
- Can integrate with LLM-service, or by using copy-paste.
- First-time visitors receive ten public-safety and continuity boxes in the selected app language, each with four categories, described key drivers, impossible combinations, an example scenario, a prose template covering every driver, and a tailored LLM prompt addressing short- and medium-term effects and conditional game changers. Each language's kit is loaded on demand from its own JSON file; the current language is cached for offline use once online. Existing browser collections are not translated or replaced when the app language changes. Use **Add starter kit** to append only missing boxes in the current app language without changing existing ones. To get an updated version of a starter box already in your collection, remove that old box first; **New collection** replaces the entire collection (download it first if needed).

## Persona feedback

Personas are reusable audience profiles. Select the relevant personas for each morphological box independently of decision support. For each saved scenario, their feedback captures a **hypothetical perspective**: how they might perceive the situation, respond to proposed measures, and need to be informed or involved. It is not evidence from real people. Each persona has a separate feedback field so their perspectives stay distinct.

New starter collections include translated profiles for an event visitor, a nearby resident and an event organiser. Event safety selects all three; high water and levee breach select the resident. Adding missing starter boxes also adds only their missing profiles without replacing existing personas or box selections.

In the box's LLM settings, choose **Narrative prompt** or **Persona prompt** in the prompt-type selector to edit its included categories and text; there is one editor, not an addable list of prompts. On a saved scenario, use **Copy feedback prompt** beside a persona to send its prompt to an external LLM; paste its plain-text response directly into that persona's feedback field. With Ollama or OpenAI configured, **Generate feedback** fills that field automatically. The prompt includes the selected scenario factors, the narrative when available, and the selected personas and their descriptions, while requesting a response for only the chosen persona.

## Development

```bash
pnpm i
npm start
```

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
