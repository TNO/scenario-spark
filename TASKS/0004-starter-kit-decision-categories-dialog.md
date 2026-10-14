# 0004 Starter kit: decision categories and opt-in dialog

Status: done
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
- 2026-10-14: Done. Kit spec: category-level `decision: true` (written after `manual`)
  on all 96 manual measure categories of the 40 hazard boxes in all six locales (added by
  a node script; only `"decision": true` lines added). The five continuity/event boxes
  (evenementenveiligheid, publieke-gebouwen, religieuze-centra, havencontinuiteit,
  luchthavencontinuiteit) have no manual categories and are unchanged. Loader
  (`src/models/starter-kit.ts`): `decision` -> `Category.decisionSupport`, its factors
  `manual: true`; `includeDecisionSupport` stays false. `scripts/starter-kit-tools.mjs`:
  `to-box` sets `decisionSupport` (and manual), `to-spec`/`check-box` emit `decision: true`,
  `merge` copies it from en.json, `check` prints a warning (not counted as a problem) for
  manual categories without `decision`. Round-trip verified (to-box/to-spec and empty merge
  reproduce the files byte for byte). Dialog: `Scenario.decisionSupportPrompted?: boolean`;
  pure helpers `shouldPromptDecisionSupport` / `answerDecisionSupportPrompt` in
  `src/utils/decision.ts`; `src/components/ui/decision-support-prompt.ts` (ModalPanel)
  rendered by `Layout`, so it triggers for any current scenario (starter kit, imports,
  switching boxes) on every page except Home (avoids clashing with Home's import/kit
  modals; the kit is added on Home). "Turn on" sets `includeDecisionSupport`; "Not now"
  and closing the dialog only remember the answer; both persist via `saveModel`. New keys
  `DECISION_PROMPT_*` in all six locales. Tests: `tests/decision-prompt.test.mjs`,
  loader-mapping and decision-category tests in `tests/starter-kit-nl.test.mjs`, locale
  consistency of `decision` in `tests/starter-kit-locales.test.mjs`. Root README updated.
  Build output (`docs/`) not committed.
