# 0006 Courses of action for one situation

Status: done
Priority: high
Subsystem: frontend
Depends on: 0003

## Context
Answer to question 2 from the review (see 0001). Today decisions live in
`Narrative.components` next to the situation values, so alternatives require cloning the
whole narrative ("Clone narrative" on the create page); the clones' situations drift apart
and comparison mixes situation and decision differences.

Chosen design: one narrative (situation) has several **courses of action (COAs)**. A COA
holds only decision-component selections plus metadata.

## Acceptance Criteria
- Data model (`src/models/data-model.ts`):
  `Narrative.coas?: CourseOfAction[]` and `Narrative.activeCoaId?: ID`, with
  `CourseOfAction = { id; label; desc?; components: { [componentId]: ID[] }; notes?;
  risk?; probability?; impact? }` (risk fields optional, for residual risk later).
- Migration (on load, versioned like other migrations): decision-component selections in
  existing narratives move into a COA "A"; situation selections stay in
  `Narrative.components`. User text is never overwritten.
- Create page, decision section (0003): tabs/chips per COA plus "+ Add" and "Duplicate";
  rename/delete a COA; values excluded by the situation are disabled.
  - When the situation changes, COA values that became inconsistent are flagged (not
    silently removed).
- Show page and Word export list each COA under the situation.
- Decision-support page compares COAs (the active COA per narrative, until 0009).
- All new strings translated in six locales.
- Tests for the migration and for the inconsistency flagging helper.

## Implementation Notes
- Keep `Narrative.components` as the situation so generation, inconsistency handling and
  existing exports keep working; add a helper `effectiveSelection(narrative, coaId?)`
  that merges situation + COA for code needing both (LLM prompts, inconsistency checks).
- Library counterpart: 0008.
- Alternative considered: clone with `parentId` and read-only situation — rejected,
  because comparison and editing still operate on duplicated situations.

## Agent Notes
- 2026-10-14: Done. Model (`src/models/data-model.ts`): `CourseOfAction` type,
  `Narrative.coas`/`activeCoaId`, `Scenario.dataVersion` (missing = 1). Pure helpers in
  `src/utils/decision.ts` (not a new file, see 0005): `SCENARIO_DATA_VERSION = 2`,
  `nextCoaLabel` (A..Z, AA..), `activeCoa(narrative, coaId?)` (given id, else active, else
  first), `effectiveSelection(narrative, coaId?)` (situation + COA, COA wins),
  `addCoa`/`ensureActiveCoa`/`duplicateCoa`/`removeCoa`, `moveDecisionsToCoas(box,
  narrative)` (decision selections leave `components`; into a new COA "A", or into the
  active COA when it has nothing for those factors, otherwise into a new COA, so nothing
  is overwritten), `migrateModel(model)` (all scenarios with `dataVersion < 2`, regardless
  of `includeDecisionSupport`; text fields untouched), `coaConflicts(box, narrative, coa)`
  (COA values impossible given the situation; flagged, never removed; unlikely pairs do not
  count, as in 0003) and `narrativeCoaRows` (show page/Word; COAs without decisions and
  notes are skipped; unmigrated narratives give one unnamed row). `narrativeDecisionRows`
  and `buildStoryInput` now use `effectiveSelection`, so LLM prompts use the active COA.
  Migration runs on load (`initialize`, persisted only for stored models) and in
  `saveModel` (imports, collections); the settings form also moves selections of newly
  ticked decision categories. `validateNarrative` also cleans COA selections. Create page:
  chips per COA (virtual "A" until the first decision), *Add*, *Duplicate*, rename (inline
  text input), delete (confirm), per-COA notes, conflict list and warning icon on chips;
  decision `CategoryTable` gets `selection`/`onchange` for the active COA (keys include the
  COA id to re-create the selects on switching). Generating a new situation copies the
  COAs to the new narrative (decisions no longer constrain generation; conflicts are
  flagged instead). Show page lists every COA (active marked) with conflicts; Word export
  (`downloadAsDocx` narrative `coas` replaces `decisions`) adds a heading per COA, notes,
  decisions and italic warnings. Decision-support page and Home tables use the active COA
  (`effectiveSelection`); the row link in `TableView` now selects the stored narrative,
  not the display copy. Template paragraph and map use the effective selection. Keys
  `COURSES_OF_ACTION`, `COURSE_OF_ACTION`, `COA_*`, `ADD_COA`, `DUPLICATE_COA`,
  `RENAME_COA`, `DELETE_COA` in six locales. Tests: `tests/coa.test.mjs` (11),
  3 new in `tests/create-page-decisions.test.mjs`; `pnpm test` 86 app + 28 package tests
  pass. Open: unmarking a decision category does not move COA values back into the
  situation (they stay in the COAs and still count in `effectiveSelection`); COA risk
  fields have no UI yet. Root README updated; `docs/` not committed.
