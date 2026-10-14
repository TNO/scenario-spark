# 0010 COA comparison and robustness views

Status: open
Priority: medium
Subsystem: frontend
Depends on: 0006 (parent 0009)

## Context
Subtask of 0009. `src/components/decision-support-page.ts` currently shows one table
(`TableView`) of included narratives × components, using the active COA of each narrative
(`activeCoa`/`effectiveSelection` from `src/utils/decision.ts`) plus probability/impact/
risk columns and a "suggested approach" row. There is no way to compare the COAs of one
situation, nor to see which measures hold up across scenarios.

COA model (0006): `Narrative.coas?: CourseOfAction[]`, `Narrative.activeCoaId?: ID`,
`CourseOfAction = { id; label; desc?; components: { [componentId]: ID[] }; notes?; risk?;
probability?; impact?; reflection? }`. Situation values stay in `Narrative.components`;
decision components are those in categories with `decisionSupport` (see
`getDecisionCategoryIds`/`splitDecisionComponents`). Conflicts: `coaConflicts(box,
narrative, coa)`.

## Acceptance Criteria
- A view switcher at the top of the decision-support page with three views:
  current overview table (default, unchanged), *COA comparison* and *Robustness*.
  The chosen view is kept in page/UI state (not persisted in the model).
- COA comparison (one situation):
  - a narrative selector (included narratives; default: the current narrative if
    included, else the first);
  - COAs as columns side by side; rows are decision components grouped under their
    decision category headings; each cell lists the selected value labels;
  - cells with values that conflict with the situation (`coaConflicts`) are marked;
  - "Show differences only" toggle hides rows where all COAs select the same values;
  - empty states: no decision categories (existing `NO_DECISION_CATEGORIES`), narrative
    without COAs.
- Robustness (across scenarios):
  - rows = decision values (measures) grouped by decision component/category; columns =
    included narratives (using each narrative's active COA);
  - each cell is one of *chosen* (selected in the active COA), *excluded* (impossible
    given that narrative's situation, see `decisionExclusions`) or *unused*; distinct
    icon + colour + text/tooltip, not colour alone;
  - a summary column counts in how many scenarios a measure is chosen; measures chosen in
    every scenario are highlighted as robust, measures chosen in one scenario only as
    scenario-specific.
- All new strings via `t(...)`, keys added to all six locales (`en`, `nl`, `fr`, `de`,
  `es`, `pl` in `src/services/translations/`).

## Implementation Notes
- TDD on pure seams first, in `tests/*.test.mjs` (see `tests/coa.test.mjs` for the
  import style): put the data shaping in `src/utils/decision.ts` (or a new
  `src/utils/comparison.ts`), e.g. `coaComparisonRows(box, narrative, { differencesOnly })`
  and `robustnessGrid(box, narratives)` returning plain data; the components only render.
- Keep the page components small; split views into separate components in
  `src/components/` if `decision-support-page.ts` grows.
- Mithril: no `key` on rows unless re-creation is needed (see AGENTS.md).
- Run `pnpm test` and `pnpm typecheck`; after `pnpm build`, revert `docs/`
  (`git checkout -- docs/` / remove untracked build output) — it is not committed.

## Agent Notes
