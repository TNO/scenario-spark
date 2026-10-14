# 0005 Narrative LLM prompt: situation versus suggested actions

Status: done
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
- 2026-10-14: Done. Pure builder `buildStoryInput({ box, narrative, includedCategories,
  storyType, tr })` in `src/utils/decision.ts` (not a separate file: tests import TS
  sources directly with Node type stripping, which cannot resolve extensionless relative
  imports). It uses `splitDecisionComponents`/`decisionSupportActive`; only components of
  the prompt's included categories are listed, each factor with all selected values
  (comma-separated, `label (desc)` as before). Narrative **and persona** prompts (the
  default persona prompt already asks about proposed measures) get a `LLM_SITUATION`
  section and a `LLM_SUGGESTED_ACTIONS` section; when decision support is off, or no
  included decision values are selected (also when the prompt excludes the decision
  categories), the actions section is replaced by `LLM_NO_MEASURES_SELECTED`. Boxes
  without decision categories keep the previous plain list (no headings, no
  no-measures line) so ordinary boxes are unchanged. Effect/communications prompts (no UI
  callers) keep the plain list, minus decision values when decision support is off.
  `generateStory(config, narrative, box, storyType, personaContext)` now takes the
  scenario (categories, components, includeDecisionSupport) instead of
  categories+components; callers in `create-scenario-page.ts` pass `model.scenario`.
  Clipboard mode returns the same input. Keys in all six locales. Tests:
  `tests/story-input.test.mjs` (8); `tests/persona-feedback.test.mjs` and
  `tests/persona-feedback-page.test.mjs` updated to the new signature. Root README
  (decision support section) updated. Box prompt texts unchanged; `docs/` not committed.
