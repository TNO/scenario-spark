# 0004 Starter kit: decision categories and opt-in dialog

Status: open
Priority: high
Subsystem: frontend
Depends on: 0002, 0003

## Context
The crisis-management starter-kit boxes have manual measure categories, but none is marked
as a decision category and `includeDecisionSupport` is false (`src/models/starter-kit.ts`
~L125). Starter-kit scenarios should keep opening with decision support **off**, so users
can explore incidents first, but they should be told the option exists.

## Acceptance Criteria
- Kit spec supports a category-level `decision: true` (or `decisionSupport`); the loader
  (`createScenario` in `src/models/starter-kit.ts`) maps it to `Category.decisionSupport`
  and makes its components manual.
- All measure/solution-space categories in the 45 boxes in
  `src/models/starter-kits/{en,nl,fr,de,es,pl}.json` are marked as decision categories;
  `includeDecisionSupport` stays false. Ids and translations are unchanged.
- `scripts/starter-kit-tools.mjs` (`to-box`, `to-spec`, `check`, `merge`) round-trips the
  flag; `check` warns when manual categories are not decision categories.
- When the user opens a scenario that has decision categories while decision support is
  off, a dialog asks: turn decision support on now, or not now (with a note that it can be
  changed later in Settings). The answer is remembered per scenario (e.g.
  `decisionSupportPrompted: true` on `Scenario`) so the dialog appears once.
- Dialog strings in all six locale files.
- Tests: `tests/starter-kit-nl.test.mjs` / `tests/starter-kit-locales.test.mjs` assert
  that every hazard box has at least one decision category and that decision categories
  are consistent across locales.

## Implementation Notes
- Starter kits are added in `src/components/home-page.ts` (~L405 `loadStarterKit`); the
  dialog belongs where a scenario becomes current (consider the create page `oninit`), so
  it also triggers for imported boxes with decision categories.
- Existing user data must not be overwritten (AGENTS.md checklist).

## Agent Notes
