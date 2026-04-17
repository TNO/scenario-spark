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
