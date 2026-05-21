# AGENTS.md

## Localization Rules

- Never hardcode user-facing localized strings in component or service code.
- Always use the translation service `t(...)` from `src/services/translations.ts`.
- Add new translation keys to `src/services/translations/en.ts` and all other locale files (`nl.ts`, `fr.ts`, `de.ts`, `es.ts`, `pl.ts`).
- For default text values shown in forms (for example LLM prompt defaults), read the text via `t(...)` at runtime.
- Keep translation keys stable and descriptive (for example `LLM_DEFAULT_NARRATIVE_PROMPT`).

## PR Checklist (Localization)

- [ ] No hardcoded UI text in TypeScript components/services.
- [ ] New keys added in all supported language files.
- [ ] English source text present and consistent with other locales.
- [ ] Existing user-entered text is not overwritten by localization migrations.
