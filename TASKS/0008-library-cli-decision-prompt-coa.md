# 0008 Library, CLI and skill: decision prompt and courses of action

Status: open
Priority: medium
Subsystem: morphological-box
Depends on: 0002, 0006

## Context
Keep the package, CLI and agent skill in line with the app features from 0005–0007, so an
agent can author a decision-support box end to end and evaluate COAs from the terminal.

## Acceptance Criteria
- `set-llm-prompt --type decision` is accepted; `validate` checks decision prompts only
  reference existing categories (preferably decision categories).
- Narrative/prompt rendering in `packages/morphological-box/src/narrative.ts`
  (`template-prompt` and related helpers) splits situation vs. decision values, listing
  multiple selected values per factor, matching the app (0005).
- COA support:
  - `options --select <situation values> --coa <decision values>` reports which COA
    values are excluded by the situation;
  - optionally `compare-coas <file> --select … --coa A=… --coa B=…` prints a side-by-side
    table with conflicts.
- Types export `CourseOfAction` (same shape as the app's, see 0006).
- Tests, package README, `SKILL.md` and `REFERENCE.md` updated (decision prompt guidance:
  ground in the situation, assess, do not invent missing facts).
- Version bump and publish after merge (tag `morphological-box-v<version>`).

## Implementation Notes
- Existing `assessOptions` (`packages/morphological-box/src/generate.ts`) already reports
  possible/excluded options; extend rather than duplicate.

## Agent Notes
