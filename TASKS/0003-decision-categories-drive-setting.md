# 0003 Decision categories drive the decision-support setting

Status: done
Priority: high
Subsystem: frontend
Depends on: 0002

## Context
Answer to question 1 from the review (see 0001): the scenario-level setting
`includeDecisionSupport` should control **decision categories** (`Category.decisionSupport`),
not every `manual` factor. Manual factors outside decision categories (e.g. a location the
user always chooses) stay visible regardless of the setting.

## Acceptance Criteria
- Settings page (`src/components/settings-page.ts`):
  - the category checkbox "Is decision category" is only shown when decision support is
    on (the `show` rule is currently commented out), or stays visible with a hint;
  - ticking it sets `manual: true` on the category's components (unticking leaves them).
- Create page (`src/components/create-scenario-page.ts`):
  - decision support **off**: decision categories are hidden and ignored by generation;
  - decision support **on**: decision categories render in a separate "Decisions /
    Response" section below the situation; values excluded by the current situation are
    greyed out (or hidden when `hideInconsistentValues`) with a tooltip naming the
    conflicting situation value;
  - "Generate narrative" never fills decision components (they are manual); the
    "all locked" check keeps excluding manual components.
- Decision-support page uses only decision categories (current behaviour) and shows an
  empty-state hint when a scenario has no decision categories.
- Show page and Word export list decisions in their own section when decision support is
  on, and omit them when off.
- New UI strings via `t(...)` in all six locale files.
- Tests for the visibility/generation rules where practical (e.g. a pure helper that
  splits components into situation vs. decision components).

## Implementation Notes
- Prefer one helper, e.g. `splitDecisionComponents(scenario)` in `src/utils`, reused by
  the create page, show page, LLM prompt (0005) and decision-support page.
- `generateNarrative` (`src/utils/index.ts`) already locks manual components to the user's
  selection before delegating to the package.

## Agent Notes
- 2026-10-14: Done. Pure helpers in `src/utils/decision.ts` (re-exported from
  `src/utils`): `splitDecisionComponents(box)` (situation/decision categories and
  components; a component in several categories belongs to the first, as in the package),
  `decisionSupportActive`, `getDecisionCategoryIds`, `generationLocks(box, selection,
  lockedComps)` (locked + manual situation values; decisions locked to the user's choice
  when on, to `[]` when off, so generation never fills them even if `manual: false`),
  `decisionExclusions(box, selection)` (decision value -> selected situation values that
  make it *impossible*; unlikely pairs do not exclude), `applyDecisionCategoryManual(box,
  previousIds)` (newly ticked categories set `manual: true`; unticking leaves it) and
  `narrativeDecisionRows(box, narrative)` (show/Word export). Settings: checkbox stays
  visible with an `md` hint (`DECISION_CATEGORY_HINT`); the nested `show` rule cannot see
  the scenario-level flag reliably, and keeping it visible lets users prepare categories
  before switching on. The form `onchange` applies `applyDecisionCategoryManual` against a
  snapshot of decision category ids. Create page: situation tables use only situation
  categories; when on, a `DECISIONS` section with `DECISIONS_HINT`; `CategoryTable` gets a
  `decision` attr (no lock icons; excluded values disabled with label suffix and `title`
  `EXCLUDED_BY`, hidden with `hideInconsistentValues`; selected excluded values stay
  enabled so they can be deselected). The mithril-materialized Select dropdown does not
  render option `title`, so the conflicting situation value is shown in the option label.
  Hiding of situation values (`hideInconsistentValues`) now only considers situation
  selections. "All locked" check ignores manual and decision components. Show page and
  `downloadAsDocx` (new optional `decisions` per narrative and `decisionsTitle` arg) list
  decisions in their own section when on. Decision-support page: `NO_DECISION_CATEGORIES`
  empty-state hint. Tests: `tests/decision.test.mjs`, `tests/create-page-decisions.test.mjs`;
  `tests/persona-feedback-page.test.mjs` mock of `../utils` now spreads the real decision
  helpers. Root README section "Manual measures and decision support" rewritten. Build
  output (`docs/`) not committed.
