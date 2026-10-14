# 0002 Library, CLI and skill: decision categories

Status: done
Priority: high
Subsystem: morphological-box
Depends on: none

## Context
Agents author boxes with the `morphological-box` CLI/skill. They must be able to mark a
category as a *decision category* (measures/decisions a person chooses). Turning it on
also makes the category's factors manual by default, so generation leaves them empty.
Parent task: 0001. See 0001 for the distinction between `manual` and decision categories.

## Acceptance Criteria
- `Category` in `packages/morphological-box/src/types.ts` has an optional
  `decisionSupport?: boolean` (same field name as the app's `Category`, so boxes
  round-trip between app and package without mapping).
- Builder: `CategoryInput.decision` (or `decisionSupport`) sets the flag; components of a
  decision category default to `manual: true` unless a component explicitly sets
  `manual: false`. New `setDecision(box, categoryIds, on = true)` that sets the flag and
  makes the category's components manual; `--off` clears the flag but leaves `manual`
  untouched (document this).
- CLI: `set-decision <file> <categoryId>[,<categoryId>...] [--off]`; `outline` and `stats`
  mark decision categories; `options` groups its output into situation vs. decisions.
- Validation: warn (not error) when a decision category contains non-manual components,
  and when a box has decision categories but no exclusion links situation values to any
  decision value.
- `generate` keeps decision components empty (they are manual) unless `--include-manual`.
- Tests in `packages/morphological-box/test/` cover builder, `setDecision`, CLI command and
  validation warnings.
- Package README, `skills/morphological-box/SKILL.md` and `REFERENCE.md` explain decision
  categories, when to use `manual` without a decision category, and the CLI command.
- Version bump (minor) in `packages/morphological-box/package.json`.

## Implementation Notes
- Existing manual support: `setManual` and `CategoryInput.manual` in
  `packages/morphological-box/src/builder.ts` (~L83–L147, L243+); CLI in `src/cli.ts`.
- Rebuild with `pnpm --filter morphological-box build`; app tests import the built `dist`.
- Publishing: tag `morphological-box-v<version>` on main after merge (Trusted Publishing,
  see package README).

## Agent Notes
- 2026-10-14: Done. `Category.decisionSupport?: boolean` (`src/types.ts`).
  Builder (`src/builder.ts`): `CategoryInput.decision` with alias `decisionSupport`;
  components default to manual via `ci.manual ?? input.manual ?? (decision || previous)`;
  replacing a category without the flag keeps it, `false` clears it. New
  `setDecision(box, categoryIds, on = true)` (category ids only; unknown id throws; off
  clears the flag only). `getDecisionComponentIds(box)` in `src/generate.ts` (first
  category wins, like `getBoxComponents`); `assessOptions` results gain `decision: boolean`.
  Validation (`src/validate.ts`): error `invalid-decision-support` (non-boolean flag);
  warnings `decision-component-not-manual` (path `$.components[i].manual`) and
  `decision-unlinked` (no *impossible* situation×decision pair; unlikely pairs do not
  count as exclusions). CLI (`src/cli.ts`): `set-decision <file> <ids> [--off]`; `outline`
  marks `(decision)`; `stats` adds `decisionCategories`; `options` text output groups into
  `## Situation` / `## Decisions` only when the box has decision categories (JSON order
  unchanged). Generation unchanged: decision components are empty because they are manual
  (an explicit `manual: false` is generated, and warned about). Tests in
  `test/decision.test.ts`. Docs: package README, skill SKILL.md/REFERENCE.md, root README
  CLI section. Version 0.4.0.
