# Scenario Spark — Bug Fixes & Feature Backlog

Generated: 2026-04-26

## Bugs

| # | File | Description | Status |
|---|------|-------------|--------|
| 1 | `src/utils/local-ldb.ts` | **Infinite retry loop in IndexedDB** — All methods retry recursively with `setTimeout(50ms)` when `db` is null, no max retries. Add retry cap (20 retries = 1s timeout) and reject with clear error. | ✅ Done |
| 2 | `src/components/ui/llm.ts` | **chatWithLLM retries don't actually retry** — `throw` on `!response.ok` exits loop; exponential backoff is commented out. Restructure so errors are caught and loop continues. | ✅ Done |
| 3 | `src/components/ui/llm.ts` | **Ollama parse errors silently swallowed** — catch returns `''` with no user feedback. Return error or re-throw for toast/alert. | ✅ Done |
| 4 | `src/utils/index.ts` | **Typo `lastUpdata` → `lastUpdate`** — Migrated models lose their timestamp. | ✅ Done |
| 5 | `src/components/ui/llm.ts` | **Duplicate 'prompt' field in LLMSelector** — `id:'prompt'` appears twice (`textare8` typo + `textarea`). Remove duplicate. | ✅ Done |
| 6 | `src/models/osm.ts` | **Regex bug: `d{2,}` should be `\d{2,}`** — Flats OSM type matches literal "ddd" instead of digits. | ✅ Done |
| 7 | `src/components/ui/map-view.ts` | **Map resize event listener leak** — mousemove/mouseup on `window` never cleaned if component unmounts mid-drag. Store refs, clean in `onremove`. | ✅ Done |
| 8 | `src/utils/morp-box-to-markdown.ts` | **Markdown parser strips `**` before parsing** — Corrupts labels containing `*`. Strip only from final label/desc. | ✅ Done |
| 9 | `src/services/state-mgmt.ts` | **Redundant `localStorage.setItem(SAVED, 'false')`** — Called twice in `saveModel`. Remove first occurrence. | ✅ Done |

## Features

| # | File(s) | Description | Status |
|---|---------|-------------|--------|
| 10 | `src/utils/index.ts` | **Proper Word export with docx library** — Replace HTML-to-Word `downloadAsWord()` with `docx` library for real .docx: tables, headers, persona images, styled formatting. | ✅ Done |
| 11 | `src/utils/index.ts` | **Dead-end detection for morphological box generation** — When `generateNarrative()` fails after 100 tries, diagnose which components conflict and report to user. | ✅ Done |
| 12 | `src/components/ui/llm.ts` + `src/components/llm-scenario-wizard.ts` | **LLM provider consolidation** — Extract shared `LLMClient` class. Depends on #2, #3. | ✅ Done |
| 13 | `src/app.ts` + `sw.js` | **Service worker error handling + offline fallback** — Toast on SW registration failure; add `offline.html` fallback page. | ✅ Done |
| 14 | `src/components/home-page.ts` | **Narrative search/filter in TableView** — Text input filtering narratives by label, debounced, reactive. | ✅ Done |
| 15 | `src/components/home-page.ts` | **Import validation feedback with overwrite option** — Dialog on duplicate upload: "overwrite" or "add as copy". | ✅ Done |
| 16 | `src/utils/index.ts` | **Quill-to-markdown: code blocks and tables** — Add inline code, fenced code blocks, table support to `quillToMarkdown()`. | Pending |

## Dependencies

- Feature #12 (LLM consolidation) → blocked by Bug #2, Bug #3
