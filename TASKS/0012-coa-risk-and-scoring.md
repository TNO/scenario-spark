# 0012 Risk before vs. after a COA, risk matrix and criteria scoring

Status: open
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
