# 0008 Library, CLI and skill: decision prompt and courses of action

Status: done
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
- 2026-10-14: Done (package 0.5.0, not published; publish via tag
  `morphological-box-v0.5.0` after merge). Types: `CourseOfAction` (same shape as the app,
  incl. `reflection`). New `src/coa.ts`: `nextCoaLabel`, `activeCoa`, `effectiveSelection`
  (mirror the app), `assessCoa(box, situation, coa)` built on `assessOptions` (COA values
  with status `available|unlikely|excluded` given the situation only, `conflicts` =
  situation value ids, `excluded`, `unlikely`, `internalConflicts` = impossible pairs within
  the COA, `consistent`) and `compareCoas(box, situation, coas)` (decision components plus
  other components a COA uses, one assessment per COA). `src/narrative.ts`: prompt type
  `decision`; `createLlmInput(box, { type, narrative, coaId?, categories?, narrativeText?,
  decisionSupport?, labels? })` reproduces the app's `buildStoryInput`/`buildDecisionInput`
  (English headings = app `en.ts` texts in `DEFAULT_LLM_INPUT_LABELS`, overridable),
  `createLlmPrompt` prepends the box prompt, `renderFactorLines`. Categories default to the
  box prompt's categories, else all; decision values count by default when the box has
  decision categories (the package has no decision-support switch; `decisionSupport: false`
  mimics the app's off state). Validation: warning `decision-prompt-without-decisions`
  (decision prompt, no decision categories); unknown prompt categories were already warned.
  CLI: `set-llm-prompt --type decision`; `options --coa [<label>=]<ids>` (repeatable; a
  `## Course of action` section per COA, JSON `{ options, coas }` only with `--coa`);
  `compare-coas` (markdown table + conflicts, `--json`); `llm-prompt` (prints the prompt as
  the app builds it; `--active`, `--text`, `--categories`). `--coa` values must belong to
  decision categories. The template prompt (`template-prompt`) is unchanged: it numbers key
  drivers for template writing and has no selected values to split. The app was not
  refactored to use the package helpers (its builders take translated keys); behaviour is
  the same and covered by tests on both sides. Tests `test/coa.test.ts` (8); `pnpm test`
  97 app + 36 package tests pass. Docs: package README, SKILL.md, REFERENCE.md, root README
  CLI section; no CHANGELOG exists. `docs/` not committed.
