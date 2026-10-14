# Tasks

Task files are the source of truth; this is a rollup index.

## Decision support for crisis management (0001)

Library first (0002), then the app setting (0003); the starter kit (0004), narrative
prompt (0005) and courses of action (0006) can run in parallel after 0003.

- [ ] 0001 Decision support for crisis management
- [x] 0002 Library, CLI and skill: decision categories
- [ ] 0003 Decision categories drive the decision-support setting *(needs 0002)*
- [ ] 0004 Starter kit: decision categories and opt-in dialog *(needs 0002, 0003)*
- [ ] 0005 Narrative LLM prompt: situation versus suggested actions *(needs 0003)*
- [ ] 0006 Courses of action for one situation *(needs 0003)*
- [ ] 0007 Decision-reflection LLM prompt *(needs 0005, 0006)*
- [ ] 0008 Library, CLI and skill: decision prompt and courses of action *(needs 0002, 0006)*

## Later

- [ ] 0009 Improve the decision comparison page *(needs 0006)*
