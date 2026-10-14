# 0009 Improve the decision comparison page

Status: open
Priority: low
Subsystem: frontend
Depends on: 0006

## Context
Follow-up from the review (question 3). `src/components/decision-support-page.ts` shows a
table of included narratives × decision components plus probability/impact/risk columns,
and a "suggested approach" row that picks the risk-weighted most-chosen value per factor.
That suggestion ignores inconsistencies and can be self-contradictory.

## Acceptance Criteria
- Two views:
  - COA comparison for one situation: COAs side by side, rows grouped by decision
    category, "show differences only" toggle;
  - robustness across scenarios: measures × scenarios grid (chosen / excluded / unused),
    to find measures that work in every scenario versus scenario-specific ones.
- Suggested approach respects inconsistencies (no excluded values) and explains each pick,
  e.g. "chosen in 3 of 4 scenarios, weight 11".
- Optional scoring: weighted criteria per COA (effect, speed, capacity, responder safety,
  legality, public acceptance) with weight sliders.
- Risk: risk before vs. after the COA; scenarios plotted on a 5×5 matrix.
- Decision log (rationale + timestamp per decision) and Word export of the comparison.
- Strings translated in six locales.

## Implementation Notes
- Split into smaller tasks before starting; do this after 0006 settles the COA model.

## Agent Notes
