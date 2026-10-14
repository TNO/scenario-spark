# 0007 Decision-reflection LLM prompt

Status: open
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
