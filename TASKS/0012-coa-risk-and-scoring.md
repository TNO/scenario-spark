# 0012 Risk before vs. after a COA, risk matrix and criteria scoring

Status: done
Priority: medium
Subsystem: frontend
Depends on: 0006, 0010 (parent 0009)

## Context
Subtask of 0009. A narrative has `probability`/`impact`/`risk` (risk = situation risk,
computed by `calculateRisk` in `src/components/create-scenario-page.ts` from a 5×5
matrix; ids `probability_0..4`, `impact_0..4`, `risk_0..4`, labels `PROB5`/`IMP5`/
`RISK5`). `CourseOfAction` (0006, `src/models/data-model.ts`) already has optional
`risk`, `probability`, `impact` for the residual risk after the COA, but there is no UI
for them and the comparison does not use them.

## Acceptance Criteria
- Create page, COA section: probability and impact selectors per COA (same options as the
  narrative), residual risk computed with the same matrix. Move `calculateRisk`'s matrix
  into a shared pure helper (e.g. `riskLevel(probability, impact)` in
  `src/utils/decision.ts`) used by both narrative and COA.
- Show page and Word export list the residual risk per COA next to the situation risk
  (only when set).
- Comparison (0010 views): risk before (situation) vs. after (COA) per COA, with the
  difference (e.g. "high → medium").
- A 5×5 risk matrix (probability × impact, coloured by risk level) plotting included
  scenarios (situation risk) and, for the selected situation, its COAs (residual risk);
  markers labelled, accessible (text list/table fallback, not colour only).
- Optional weighted criteria scoring per COA:
  - criteria: effect, speed, capacity, responder safety, legality, public acceptance;
  - score per COA per criterion (e.g. 1–5), stored on the COA (add optional
    `scores?: { [criterion]: number }` to `CourseOfAction`, mirrored in the
    `morphological-box` package type);
  - weight sliders per criterion (stored per scenario, e.g. `Scenario.criteriaWeights`),
    total weighted score per COA shown and ranked in the COA comparison;
  - fully optional: hidden/collapsed until used, no effect on existing data.
- Strings via `t(...)`, keys in all six locales; no migration needed (fields optional).

## Implementation Notes
- TDD in `tests/*.test.mjs` on pure seams: `riskLevel`, risk before/after rows,
  matrix cell placement, weighted score (zero/missing weights, missing scores, ranking).
- Keep `calculateRisk` behaviour identical for narratives (tests guard it).
- If the package type changes, add a package test and update its README/REFERENCE.
- Run `pnpm test` and `pnpm typecheck`; after `pnpm build`, revert `docs/`.

## Agent Notes
- Pure helpers in `src/utils/decision.ts`: `RISK_MATRIX`, `levelIndex`, `riskLevel`,
  `updateRisk` (replaces `calculateRisk` in the create page with identical behaviour:
  risk only set when both probability and impact are valid), `coaRiskRows`,
  `riskMatrix(narratives, selectedId)` (cells[p][i] with numbered scenario markers,
  lettered COA markers of the selected scenario, `unplaced` list), `COA_CRITERIA`,
  `MAX_CRITERION_SCORE` (5) and `coaScores(coas, weights)` (weighted totals, missing
  weight = 1, weight ≤ 0 ignores the criterion, missing scores counted, competition
  ranking, `used` flag). `narrativeCoaRows` adds `risk: { before, after }` only when a
  COA has a residual risk (keeps existing row shape).
- Model: `CourseOfAction.scores?` (app + package type, package test added, package
  README/REFERENCE updated), `Scenario.criteriaWeights?`. No migration needed.
- UI: create page has residual probability/impact/risk selectors per active COA;
  show page and Word export print "Residual risk: X (situation: Y)" per COA; COA
  comparison has a risk before→after row (arrow when lower/higher) and a collapsible
  *Criteria scoring* section (`details`, open once used) with 0–5 weight sliders and
  1–5 score selects (empty = not scored), weighted total and rank in the footer; new 4th decision view
  *Risk matrix* (5×5 grid coloured with `trafficLight`, sr-only cell text, marker
  chips, list-table fallback, unplaced note). Scenario selection is shared between
  the comparison and risk views. Keys in all six locales.
- Tests: `tests/coa-risk.test.mjs` (7 tests) + 1 package test; `pnpm test` 123 app +
  37 package pass; typecheck and build pass; docs/ reverted. Browser-checked the
  comparison (risk row, scoring, weights), risk matrix, show and create pages.
- Deviations/open points: weights are 0–5 (default 1); scores and
  weights are edited only in the COA comparison view; the risk view is available
  even when the box has no decision categories (situation risks only); scores never
  influence `suggestApproach`. Pre-existing (also without these changes): navigating
  from the show page to the create page can raise a Mithril `removeChild` /
  mixed-keys error until reload.
