# 0011 Suggested approach respects inconsistencies and explains picks

Status: done
Priority: medium
Subsystem: frontend
Depends on: 0006, 0010 (parent 0009)

## Context
Subtask of 0009. The "suggested approach" row in
`src/components/decision-support-page.ts` (inline reduce in `view`) picks, per factor, the
values with the highest risk-weighted count over the included narratives' active COAs
(weight = risk level 1–5 from `narrative.risk`, `risk_0`..`risk_4`). It ignores the
box inconsistencies, so the result can contain values that are excluded by each other or
by a shared situation, and it does not explain why a value was picked.

Inconsistencies: `scenario.inconsistencies[a][b]` is `true` (impossible) or `false`
(unlikely), symmetric lookup; see `decisionExclusions` and `coaConflicts` in
`src/utils/decision.ts` and the morphological-box package (`assessOptions`).

## Acceptance Criteria
- A pure function, e.g. `suggestApproach(box, narratives, { weights? })` in
  `src/utils/decision.ts` (or `src/utils/comparison.ts`), returning per decision
  component the picked value ids plus an explanation record
  `{ valueId, chosenIn, total, weight }`.
- The suggestion never contains:
  - a value that is impossible together with another picked value
    (mutually impossible pairs);
  - a value excluded in every included situation (and, when only one situation is
    compared, any value excluded by that situation).
  When the top-scoring values conflict, the next best consistent value is chosen
  (deterministic tie-break, e.g. score desc, then value order in the box). Unlikely pairs
  do not block but may lower priority (document the choice).
- Each pick is explained in the UI, e.g. "chosen in 3 of 4 scenarios, weight 11"
  (tooltip or a small caption under the value); factors with no pick show why.
- The page uses the new function instead of the inline reduce; behaviour for boxes
  without inconsistencies stays the same (same picks as today).
- Strings via `t(...)` with placeholders, keys in all six locales.

## Implementation Notes
- TDD: write `tests/suggested-approach.test.mjs` first (no inconsistencies = same as
  current algorithm; mutually impossible top picks; excluded by situation; ties;
  explanation counts/weights; narratives without COAs).
- Weights: keep the existing risk weighting (risk level + 1) as default; accept an
  override so 0012 can plug in residual risk or criteria scores later.
- Run `pnpm test` and `pnpm typecheck`; after `pnpm build`, revert `docs/`.

## Agent Notes
- 2026-10-14: Done. Pure `suggestApproach(box, narratives, { weights? })` in
  `src/utils/decision.ts` (Node test loader; spread into the `../utils` mock of
  `tests/persona-feedback-page.test.mjs` automatically) plus `riskWeight(narrative)`
  (default weight: risk level + 1, `risk_0`..`risk_4` → 1..5, missing → 1). `weights`
  accepts an array (same order as the narratives) or a function `(narrative, index)`, for
  0012. Returns `{ total, selection, components }`; per decision component (from
  `splitDecisionComponents`) `valueIds`, `explanations` (`{ valueId, label, chosenIn, total,
  weight }`), `skipped` (`{ valueId, label, reason: 'excluded' | 'conflict', causes }`,
  only values scoring at least as high as the pick, or all when nothing was picked) and
  `reason` when nothing was picked (`none` | `excluded` | `conflict`). Algorithm: global
  greedy over all candidates sorted by weight desc, then component order, then value order
  in the box; a component takes every value of its highest weight tier that is not
  excluded in every compared situation (`decisionExclusions`; with one situation that is
  "excluded by that situation") and not impossible together with an already picked value
  (also tied values within the same component); otherwise it falls to the next tier. So
  the stronger value wins a conflict across factors. Unlikely pairs (`false`) neither block
  nor change the order (a judgement call left to the user; stated in the UI hint). Without
  inconsistencies the picks equal the old inline reduce (all values tied at the top
  weight), except that value ids not in the box are now ignored. UI: the overview's
  suggested row uses `selection`; `TableView` got an optional `cellTitles` attr (tooltip
  per narrative/component, also on the empty-cell icon); below the table
  `SuggestedApproachExplanation` (in `decision-comparison.ts`) lists per factor each pick
  with "chosen in N of M scenarios, weight W", skipped values with reason/causes and the
  no-pick reason. Keys `SUGGESTED_WHY`, `SUGGESTED_HINT`, `SUGGESTED_PICK`,
  `SUGGESTED_SKIPPED_EXCLUDED`, `SUGGESTED_SKIPPED_CONFLICT`, `SUGGESTED_NONE`,
  `SUGGESTED_NONE_EXCLUDED`, `SUGGESTED_NONE_CONFLICT` in six locales. Tests:
  `tests/suggested-approach.test.mjs` (12); `pnpm test` 116 app + 36 package pass;
  typecheck and build pass. Not checked in a browser this time. README updated; `docs/`
  not committed.
