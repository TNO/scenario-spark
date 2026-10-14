# 0009 Improve the decision comparison page

Status: done
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

## Subtasks
Implement in order; each is self-contained.
- 0010 COA comparison and robustness views (view switcher)
- 0011 Suggested approach respects inconsistencies and explains picks
- 0012 Risk before vs. after a COA, risk matrix and criteria scoring
- 0013 Decision log and Word export of the comparison

## Implementation Notes
- Split into 0010–0013 after 0006 settled the COA model. Close this task when all
  subtasks are done.

## Agent Notes
- 2026-10-14: Split into 0010 (comparison + robustness views), 0011 (suggested approach),
  0012 (risk before/after, matrix, scoring) and 0013 (decision log, Word export).
- 2026-10-14: All subtasks 0010–0013 done; closed.
