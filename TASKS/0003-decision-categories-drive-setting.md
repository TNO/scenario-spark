# 0003 Decision categories drive the decision-support setting

Status: open
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
