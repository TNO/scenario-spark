# 0001 Decision support for crisis management

Status: open
Priority: high
Subsystem: frontend
Depends on: none

## Context
PR #16 added a crisis-management starter kit whose measure categories are *manual*
(not generated), so a CM professional can describe an incident first and then pick
measures, with inconsistencies excluding measures that do not fit. Review of the app
showed two concepts that are currently mixed up:

- `ScenarioComponent.manual` — "do not generate a value for this factor" (a
  generation rule; can apply to non-decisions such as a user-chosen location).
- `Category.decisionSupport` — "this category holds decisions/measures" (semantics),
  read by the decision-support (comparison) page.

The starter kit only sets `manual`; no category is marked `decisionSupport`, and
`includeDecisionSupport` is off, so the comparison page only shows probability /
impact / risk for the CM boxes. Also, alternative sets of decisions can only be made
by cloning a whole narrative, which duplicates the situation and lets copies drift.

User decisions (2026-10-14):
1. Tie the scenario-level *decision support* setting to **decision categories**, not to
   `manual`. When a category is marked as a decision category, its factors are manual by
   default.
2. Model alternative decision sets as **courses of action (COAs)** attached to one
   situation, instead of cloning narratives.
3. Starter-kit scenarios open with decision support off; when a scenario has decision
   categories, ask the user whether to turn it on (or say it can be done later in
   Settings).
4. The narrative LLM prompt describes the incident from non-decision categories and
   uses decision categories for suggested actions (several values per factor allowed).
5. Add a decision LLM prompt that reflects on a selected COA.
6. Skill and CLI must support all of the above so agents can author such boxes.

## Acceptance Criteria
- Subtasks 0002–0008 are done (0009 is a later follow-up).
- A CM user can open a starter-kit box, accept the decision-support dialog, describe the
  incident, compare two or more COAs for that incident, and ask an LLM to describe the
  incident and to reflect on a chosen COA.

## Implementation Notes
- Feature breakdown:
  - 0002 library/CLI/skill: decision categories
  - 0003 app: decision categories drive the decision-support setting
  - 0004 starter kit: mark decision categories + "turn on decision support?" dialog
  - 0005 narrative LLM prompt split into situation vs. suggested actions
  - 0006 courses of action (data model + UI)
  - 0007 decision-reflection LLM prompt (app)
  - 0008 library/CLI/skill: decision prompt type and COA support
  - 0009 comparison page improvements (later)
- Localization rules in `AGENTS.md` apply to every new UI string (en, nl, fr, de, es, pl).

## Agent Notes
- 2026-10-14: Created from the review of the decision-support page
  (`src/components/decision-support-page.ts`), settings (`src/components/settings-page.ts`)
  and create page (`src/components/create-scenario-page.ts`).
