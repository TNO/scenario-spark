# AGENTS.md

## Localization Rules

- Never hardcode user-facing localized strings in component or service code.
- Always use the translation service `t(...)` from `src/services/translations.ts`.
- Add new translation keys to `src/services/translations/en.ts` and all other locale files (`nl.ts`, `fr.ts`, `de.ts`, `es.ts`, `pl.ts`).
- For default text values shown in forms (for example LLM prompt defaults), read the text via `t(...)` at runtime.
- Keep translation keys stable and descriptive (for example `LLM_DEFAULT_NARRATIVE_PROMPT`).

## Mithril Key Usage

- In Mithril, only use `key` when you need to force re-creating an element, or when doing drag-and-drop operations on an array.
- Avoid adding keys by default to list items, fragments, or form elements, because mixed keyed/unkeyed vnodes can trigger runtime errors.

## PR Checklist (Localization)

- [ ] No hardcoded UI text in TypeScript components/services.
- [ ] New keys added in all supported language files.
- [ ] English source text present and consistent with other locales.
- [ ] Existing user-entered text is not overwritten by localization migrations.


<claude-mem-context>
# Memory Context

# [scenario-spark] recent context, 2026-05-22 10:45pm GMT+2

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision 🚨security_alert 🔐security_note
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 50 obs (21,579t read) | 3,023,352t work | 99% savings

### Apr 25, 2026
1645 11:45p 🔵 LLM integration supports Ollama and OpenAI with multi-provider architecture
1647 11:46p 🔵 Custom IndexedDB wrapper provides async storage with initialization retry pattern
1648 " 🔵 Typo in convertFromOld data migration function writes lastUpdata instead of lastUpdate
1649 " 🔵 Narrative generation algorithm uses constraint satisfaction with inconsistency filtering and retry mechanism
1650 11:49p 🔵 Routing service implements conditional page visibility with internationalized routes
1651 " 🔵 Decision support module implements weighted voting algorithm for multi-criteria scenario analysis
1652 " 🔵 Interactive Leaflet map with OpenStreetMap amenity integration and dynamic resizing
1653 11:51p 🔵 LLM-powered wizard generates morphological boxes for scenario planning via multi-step prompt engineering
1654 " 🔵 Settings page provides comprehensive scenario configuration with markdown-based morphological box editor
1655 11:53p 🔵 OSM amenity type definitions with potential regex bug in building levels filter
1656 11:54p 🔵 Bidirectional markdown conversion enables efficient morphological box text editing with ID preservation
1657 " 🔵 Home page provides scenario management with dual wizard modes and collection import/export
### Apr 28, 2026
1659 5:34p 🟣 Rspack build system migrated to Vite
S150 Migration of scenario-spark build system from Rspack 2.0.0 to Vite 7.3.2 (Apr 28 at 5:34 PM)
S149 Assess whether to replace Rspack with Vite in scenario-spark Mithril project (Apr 28 at 5:34 PM)
1660 5:55p ✅ Migrated build tooling from Rspack 2.0.0 to Vite 7.3
1661 " ✅ Updated package.json: project metadata, scripts, and repo URLs
1662 " 🔴 Fixed Vite build entry point configuration
1663 5:56p ✅ Vite HTML entry point follows project-root convention
1664 " 🔵 Vite production build outputs to docs/ with large unsplit chunks
1665 5:57p ✅ CLAUDE.md documentation updated for Vite migration
1666 " 🔵 Vite production HTML has hashed asset references and stripped body script
S151 Fixed GitHub Pages 404s after Vite migration by adding subdirectory base path (Apr 28 at 5:58 PM)
1667 6:15p 🔵 Root cause: Vite base path missing for GitHub Pages subdirectory deployment
1668 " 🔴 Fixed GitHub Pages 404s by adding subdirectory base path
1669 6:16p ✅ Verified built HTML uses correct subdirectory asset paths
S152 Fixed GitHub Pages deployment after Rspack→Vite migration: base path and Service Worker caching (Apr 28 at 6:16 PM)
1670 6:20p 🔴 Service Worker `addAll` failure caused by stale `main.js` reference
1672 " 🔵 Vite outputs hashed JS bundles in /assets/ with dual entry structure
1673 6:21p ✅ Switched Vite output to stable filenames for Service Worker compatibility
1674 " ✅ Service Worker precache list aligned with stable Vite filenames
1675 6:27p 🟣 Morphological box Excel import and wizard integration
1676 " 🔵 Serena project activation required before file search
1677 6:28p 🔵 Project structure for morphological box Excel import feature
1678 " 🟣 Morphological box format conversion infrastructure already exists
1679 6:30p 🔵 NewScenarioWizard uses manual step-by-step form with driver selection pattern
1682 6:32p 🔵 Exploring morphological box wizard architecture
1685 6:33p 🔵 Codebase exploration for Excel import feature
1686 6:37p 🔵 LLMWizard state structure and LLM settings architecture
1688 " 🟣 csv-to-markdown utility created for spreadsheet import
1689 7:12p 🟣 Started integrating CSV import into scenario wizard
1690 " ⚖️ Changed integration target from LLM wizard to New Scenario Wizard
1691 7:13p 🟣 Added import state and UI components to New Scenario Wizard
1693 " ✅ No additional changes — redundant state initialization
1694 " 🟣 Spreadsheet import UI added to Step 2 of New Scenario Wizard
1692 7:14p 🟣 Initialized import state fields in wizard lifecycle
1695 7:16p 🟣 Added importWarnings state field for parse result feedback
1696 7:17p 🔴 Fixed warnings reference in import modal and added proper modal cleanup
S162 Feature to convert spreadsheet tabular data (Excel/Google Sheets) into the app's morphological box markdown format, integrated into the new scenario wizard. (Apr 28 at 7:17 PM)
1713 11:23p 🔵 Wizard navigation blocked by name field validation, not Mithril events
**1714** " ✅ **Wizard name field selector confirmed for automation**
The new session is re-testing the wizard navigation issue. The wizard was opened and the Step 1 name field was successfully filled with "Test Import Box". This confirms the name field selector pattern and sets up testing whether the Volgende button now works with validation satisfied — validating the theory that the previous session's navigation failures were caused by missing name input, not Mithril events.
~194t 🛠️ 157,812

### Apr 29, 2026
**1715** 9:53a 🔵 **Wizard Volgende button works — previous failures were validation, not Mithril events**
The new session re-tested wizard navigation with the name field properly filled. After filling "Test Import Box" and clicking the Volgende button, the wizard correctly advanced to Step 2 ("Stuurfactoren"). This definitively proves that: (1) the Volgende button's native .click() DOES trigger Mithril's synthetic event handler — the event system works fine for programmatic clicks; (2) the real reason the previous session failed was that the name field was empty (after page reloads), causing validation to reject navigation; (3) the entire Mithril synthetic event investigation was a red herring. The mithril-materialized Wizard component validates steps via `validateStep()` which returns false when step fields are empty, silently blocking `goToStep()`.
~343t 🔍 160,847

### May 22, 2026
**2664** 10:42p 🔵 **Located generateNarrative function and inconsistency constraint system**
Investigation into whether generateNarrative correctly handles morphological box inconsistencies revealed the function is implemented in src/utils/index.ts (line 445), imported into create-scenario-page.ts. The codebase has an inconsistency constraint system that marks option pairs (e.g., A1 and B3) as feasible (undefined/missing value), infeasible (true), or unlikely (intermediate state). A GenerationDiagnostic type exists that includes totalConstraints tracking. The UI has dedicated components for editing and displaying these constraints with color-coded states (green for possible, red for impossible, orange for improbable). The actual implementation of generateNarrative has not yet been examined to verify whether it respects these constraints during narrative generation.
~383t 🔍 7,635

**2665** 10:43p 🔵 **Bug found in generateNarrative inconsistency handling**
Investigation of the generateNarrative function revealed a logical bug in how it handles morphological box inconsistency constraints. The data model supports three constraint states: missing/undefined for feasible combinations, true for infeasible/impossible combinations, and false for unlikely/improbable combinations. However, the exclusion logic in generateNarrative (lines 476-479) checks `inconsistencies[v][id] && excluded.push(id)`, which only excludes when the value is truthy. Since false is falsy in JavaScript, improbable combinations (false) are never excluded—they are treated the same as possible combinations (undefined). This means the narrative generator may produce scenarios containing improbable option combinations that the user has marked as unlikely. The bug is in src/utils/index.ts in the generateNarrative function and appears in two places where inconsistencies are checked.
~418t 🔍 40,343

**2666** 10:44p 🔴 **Fixed generateNarrative to handle improbable combinations and optimize narrative quality**
The generateNarrative function in src/utils/index.ts was completely refactored to fix the bug where improbable (false) combinations were ignored. The original implementation used a simple random-retry loop that only excluded impossible (true) combinations, treating improbable combinations the same as possible ones. The new implementation uses a depth-first search algorithm with backtracking that respects all three inconsistency states: undefined (possible), true (impossible - blocks selection), and false (improbable - penalizes but allows selection). The algorithm validates locked values first, then searches for the narrative with the minimum number of improbable combinations by tracking an unlikelyCount score and pruning paths that exceed the current best. Components are processed in order of constraint density (most constrained first) to fail fast on impossible scenarios. Five helper functions were added to support the new algorithm: getInconsistency for bidirectional constraint lookup, countConstraints to weight constraints, getScenarioComponents for deduplication, getSelectedValueIds for extracting IDs, and shuffle for randomization within constraint groups.
~532t 🛠️ 2,800


Access 3023k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>
