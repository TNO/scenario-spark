# 0006 Courses of action for one situation

Status: open
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
