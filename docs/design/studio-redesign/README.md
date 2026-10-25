# OpenOnyx writing studio redesign

Implemented in the existing React/Electron application. The CodeMirror editor, pane tree, tab movement, graph renderer, canvas, native filesystem API, and plugin registration system remain in use.

## Where actions live

| Action | Location |
| --- | --- |
| Open, create, rename, move, delete, and organize files | Library floating panel and existing file context menus |
| Pin navigation or tools | Pin button in the panel header; pin state is device-local |
| Search | Dock, title bar, or existing keyboard shortcuts |
| Outline | Automatic heading outline in the right margin of the focused note on wide panes; More for the complete outline |
| Backlinks and outgoing links | More; both can be pinned |
| Manual graph and AI graph | Graph in the dock; existing Manual / AI View switch |
| Canvas | Canvas in the dock; existing canvas tabs and file commands |
| AI question, suggestions, and insights | Floating Ask Onyx panel; existing provider and retrieval implementation |
| Selected-text AI operations | Selection toolbar → Ask Onyx; original review/accept flow for rewrites |
| Formatting | Selection toolbar; additional controls in Formatting options; optional pinned toolbar through More |
| Reading/editing mode | Dedicated icon in the title bar for the focused Markdown note |
| Document actions | Title-bar three-dot menu, anchored to its trigger |
| Block insertion | Slash completion for headings, lists, quote, table, image, and fenced code; existing commands and native image picker |
| Split editor | Drag tabs to pane edges, or Note actions → Split right / Split down |
| Plugin ribbon tools, views, and commands | Searchable More menu for tools outside the visible dock; Customize dock for pinning, reordering, and reset |
| Settings, daily notes, spaces, bookmarks, command search | More and existing shortcuts |

The existing split placement preview component and its geometry were left untouched. Its original neutral accent (`#c6c6c6`) is retained. No embedding model, indexing implementation, AI graph scoring, relationship extraction, or cache schema was changed.

## Verification

Final automated results:

- `npm run lint`: passed.
- `npm test -- --maxWorkers=2`: 94 files passed, one file skipped; 584 tests passed, four skipped.
- `npm run build`: passed, with the existing large-chunk advisory.
- `git diff --check`: passed.

Automated checks cover dock order/overflow, plugin callback variants, panel bounds after window shrink, automatic outline changes and active section, unavailable editor commands, selection popup placement, slash insertion, formatting overflow, and keyboard navigation/closing of document tabs. The default Vitest suite includes the existing plugin-runtime tests.

Earlier interactive checks in a disposable vault verified floating/pinned Library, AI draft retention, selected-text context, selection formatting and overflow, context-menu splits, nested splits, and autosave. Those checks preceded the final refinements.

The user instructed the agent not to run the application. The review Electron instance and Vite server remain stopped. The latest floating-panel, outline, selection-toolbar, dock, title-bar, and heading zoom changes received tests, type checking, and a production build; no application launch or fresh screenshot capture was performed after that instruction.

Final visual comparison at 1672 × 941, native pointer dragging and resizing of the new floating panels, pane resizing, and graph/canvas interactions still need a user-run review. Provider-generated AI answers were not exercised with a configured external provider; unavailable-provider and existing error/review paths remain in place. Inline AI uses its existing rewrite/expand/simplify/explain/custom capabilities. No new AI backend or invented citation capability was added.

## Earlier captures

These are intermediate implementation captures, **not screenshots of the final revision**. They are retained as progress evidence and may differ in toolbar placement, header controls, panel width, or dock clearance.

- [Floating Library](screenshots/library-earlier.png)
- [Floating AI](screenshots/ai-earlier.png)
- [Tools menu](screenshots/tools-earlier.png)
- [Nested splits](screenshots/nested-splits-earlier.png)
