# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is **Scenario Spark**, a TypeScript web application for generating threat scenarios from morphological analysis. The application allows users to create structured scenario components, generate narratives, and export scenarios to Word documents. It uses a Mithril.js frontend with Meiosis state management pattern.

## Build Commands

- `pnpm dev` - Start development server on port 8339
- `pnpm build` - Build for production (outputs to ./docs directory)
- `pnpm start` - Alias for dev command
- `pnpm clean` - Clean build artifacts and cache directories

## Architecture

### Frontend Framework
- **Mithril.js** with TypeScript
- **Meiosis state pattern** for state management using `meiosis-setup`
- **Material Design** styling via `mithril-materialized`
- **Rspack** bundler (not Webpack) configured in `rspack.config.ts`

### State Management
- Central state in `src/services/state-mgmt.ts` using Meiosis pattern
- State type defined with `page`, `model`, `title`, `language`, etc.
- Actions like `setPage`, `changePage`, `saveModel`, `saveNarrative`
- Data persisted to browser localStorage via `ldb` utility

### Data Models (`src/models/data-model.ts`)
- **DataModel**: Contains scenarios, current scenario, and personas
- **Scenario**: Contains components, categories, narratives, and inconsistencies
- **ScenarioComponent**: Key factors with configurable values
- **Narrative**: Stories combining scenario components with rich text content
- **ContextualItem**: Component values with optional location/OSM context

### Core Components
- **Layout** (`src/components/layout.ts`): Main app structure with navigation
- **Page Components**: `home-page`, `create-box-page`, `create-scenario-page`, `show-scenario-page`, `settings-page`
- **UI Components**: Rich text editing with Quill, drag-n-drop, inconsistency editor

### Key Features
- Morphological analysis for scenario generation
- Multi-language support (Dutch/English) via `translate.js`
- Word document export using `quill-to-word`
- Persona integration with visual representation
- LLM integration for automated scenario generation
- Location context using OpenStreetMap data

### File Structure
```
src/
├── app.ts                    # Application entry point
├── components/               # UI components
├── models/                   # TypeScript data models
├── services/                 # State management and routing
├── utils/                    # Local storage, helpers
└── assets/                   # Images, personas, icons
```

## Development Notes

### Component Patterns
- Use `FactoryComponent` or `MeiosisViewComponent` patterns
- Components receive `MeiosisCell<State>` for state access
- Prefer const functions for TypeScript functions

### State Updates
- Use Meiosis `cell.update()` for state changes
- Call `saveModel()` to persist data to localStorage
- No manual `m.redraw()` needed after user interactions

### Data Persistence
- Models auto-saved to localStorage with key `SG_MODEL`
- Export/import functionality for scenario sharing
- Version tracking for data model migrations

### Internationalization
- Translation keys in `src/services/translations.ts`
- Use `t('KEY')` function for translated text
- Language switching persisted to localStorage