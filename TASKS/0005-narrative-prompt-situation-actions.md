# 0005 Narrative LLM prompt: situation versus suggested actions

Status: open
Priority: medium
Subsystem: frontend
Depends on: 0003

## Context
The narrative prompt (`generateStory` in `src/components/ui/llm.ts` ~L286) sends one flat
list of selected values from the prompt's included categories. With decision categories
(0003), the LLM input should separate:

- **Situation**: values from non-decision categories — used to describe the incident.
- **Suggested actions**: values from decision categories — used to suggest what to do.
  A factor may have several selected values; list them all under that factor.

Several starter-kit box prompts already say "If measures are listed, assess them …; if
no measures are listed, describe only the incident and do not invent a solution".

## Acceptance Criteria
- The generated LLM input has two labelled sections (situation, suggested actions); each
  factor lists all its selected values (comma-separated or bulleted).
- When decision support is off, or no decision values are selected, the actions section
  is omitted and the input says no measures were selected (so the LLM does not invent
  them).
- Works for all providers, including the clipboard mode.
- Section headings and the "no measures selected" line are translated (all six locales).
- Unit test for the prompt builder (pure function extracted from `generateStory`).

## Implementation Notes
- Reuse the situation/decision split helper from 0003.
- Keep box-specific prompt texts unchanged; only the structured input changes.

## Agent Notes
