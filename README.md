# Scenario generator

Spark is a tool to generate scenarios based on a morphological box, a.k.a. Zwicky Box after its inventor. In the morphological box, key drivers of a scenario are identified, and for each key driver, a number of potential values are specified. By combining possible combinations, the basis of a scenario can be created, and, if desired, converted to a full-fledged scenario using large language models (LLMs).

For an overview, see the [5 minute introduction](https://www.youtube.com/watch?v=-jmsidX8yLM).

## Features

- Online morphological box tool, free to use and modify.
- All data is stored locally, in your browser.
- Supports one or more morphological boxes to define a scenario. For example, one for a dissaster scenario, and one for measures.
- Items can have a location on the map, optionally including radii.
- Supports modelling inconsistencies, e.g. a small research reactor can only produce modest radiation levels during an incident.
- Can integrate with LLM-service, or by using copy-paste.

## Development

```bash
pnpm i
npm start
```
