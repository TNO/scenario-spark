# 0007 Decision-reflection LLM prompt

Status: done
Priority: medium
Subsystem: frontend
Depends on: 0005, 0006

## Context
The user asked whether a separate decision prompt should reflect on the selected decisions
as part of the COA route. Recommendation (2026-10-14): yes, as a separate prompt type,
because describing an incident and critiquing a response are different tasks with
different audiences and output formats. The narrative prompt (0005) may *mention*
suggested actions; the decision prompt *assesses* one COA.

## Acceptance Criteria
- New `PromptType` `'decision'` in `src/components/ui/llm.ts`, with a translated default
  `LLM_DEFAULT_DECISION_PROMPT` (all six locales), created by `ensureDefaultLLMConfig`
  when decision support is on.
  - The default asks the model to assess suitability, timing, dependencies, side effects,
    gaps and safeguards, and to stay grounded in the given situation.
- LLM input: situation (non-decision values plus the current narrative text) and the
  selected COA's decisions, factor by factor with all selected values; optionally the
  other COAs' labels for contrast.
- Button "Reflect on decisions" in the COA section; the result is stored on the COA
  (`CourseOfAction.reflection`) and is editable; clipboard mode copies the prompt.
- Prompt-type select in the LLM settings includes "decision".
- Unit test for the decision-prompt builder.

## Implementation Notes
- Reuse the prompt builder and section helpers from 0005.
- Library/CLI counterpart (prompt type + rendering): 0008.

## Agent Notes
- 2026-10-14: Done. Pure builder `buildDecisionInput({ box, narrative, coaId?,
  includedCategories?, narrativeText?, tr })` in `src/utils/decision.ts` (same file as
  0005 for the Node test loader), reusing `factorLines`/`splitDecisionComponents`/
  `effectiveSelection`. Sections: `LLM_DECISION_SITUATION` (non-decision values of
  `narrative.components`; the prompt's included categories filter only the situation, the
  COA's decisions are always listed), `LLM_SCENARIO_TEXT` (narrative text, omitted when
  empty), `LLM_COA_DECISIONS {coa}` (all selected values per factor) or
  `LLM_COA_NO_DECISIONS {coa}`, and `LLM_OTHER_COAS` (labels + desc of the other COAs,
  omitted when none). Without COAs (unmigrated) the label is "A", as in the UI.
  `llm.ts`: `PromptType` `'decision'`; `ensureDefaultLLMConfig` adds
  `{ type: 'decision', categories: all, prompt: t('LLM_DEFAULT_DECISION_PROMPT') }` only
  when `includeDecisionSupport` is on (also for new configs); an empty text/categories is
  filled, custom text kept. `generateStory(config, narrative, box, 'decision', undefined,
  { coaId, narrativeText })` returns the prompt in clipboard mode, else the trimmed
  `LLMClient.chatRaw` answer (errors throw). Settings prompt-type select lists *Decision-
  reflection prompt* when that prompt exists (falls back to narrative otherwise).
  `CourseOfAction.reflection?: string`; create page: editable *Reflection* text area plus
  *Reflect on decisions* button (only when a decision prompt has text) under the active
  COA notes; clipboard mode copies and toasts. Keys in six locales (`PROMPT_TYPE.DECISION`,
  `LLM_DEFAULT_DECISION_PROMPT`, `LLM_DECISION_SITUATION`, `LLM_COA_DECISIONS`,
  `LLM_COA_NO_DECISIONS`, `LLM_OTHER_COAS`, `REFLECT_ON_DECISIONS`, `COA_REFLECTION`,
  `DECISION_PROMPT_COPIED`, `DECISION_REFLECTION_ERROR`). Tests:
  `tests/decision-reflection.test.mjs` (9), 2 new in `tests/create-page-decisions.test.mjs`;
  `pnpm test` 97 app + 28 package tests pass. Open: the reflection is not yet shown on the
  show page or in the Word export; turning decision support off leaves the decision prompt
  in the config (still editable in settings; unused). Root README updated; `docs/` not
  committed.
