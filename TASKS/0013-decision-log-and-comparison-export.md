# 0013 Decision log and Word export of the comparison

Status: open
Priority: low
Subsystem: frontend
Depends on: 0010 (0011, 0012 when available; parent 0009)

## Context
Subtask of 0009. Decisions made on the decision-support page are not recorded: there is
no rationale, no timestamp and no way to share the comparison. Word export exists for
narratives (`downloadAsDocx` in `src/utils/index.ts`, called from
`src/components/show-scenario-page.ts`, with a heading per COA since 0006).

## Acceptance Criteria
- Decision log per scenario (e.g. `Scenario.decisionLog?: DecisionLogEntry[]`,
  `DecisionLogEntry = { id; timestamp; narrativeId?; coaId?; decision; rationale?;
  author? }`), optional, no migration needed.
- UI on the decision-support page: "Record decision" (choose situation/COA, decision
  text, rationale), list of entries newest first with formatted date/time (locale-aware),
  edit and delete (confirm). Deleting a narrative/COA keeps its log entries (show the
  stored label, mark as removed).
- Word export of the comparison (button on the decision-support page): the overview
  table, the COA comparison for the selected situation (0010), robustness grid (0010),
  suggested approach with explanations (0011) and risk before/after + scores (0012) when
  those exist, and the decision log.
- Strings via `t(...)`, keys in all six locales; export headings translated.
- Stored user text is never overwritten.

## Implementation Notes
- TDD in `tests/*.test.mjs`: log helpers (add/update/remove, sort, orphaned references)
  and a pure builder for the export content (plain data/sections), separate from the docx
  rendering; reuse `downloadAsDocx` patterns (tables via the existing docx tooling).
- Reuse the pure data functions from 0010–0012; do not duplicate their logic.
- Run `pnpm test` and `pnpm typecheck`; after `pnpm build`, revert `docs/`.

## Agent Notes
