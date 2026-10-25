# GROOT

GROOT is a local-first desktop knowledge workspace for Markdown notes, canvas boards, search, AI assistance, and collaboration. Forge turns notes into mind maps, flashcards, quizzes, and learning reports.

## Features

- Write and organize plain Markdown files in a folder you choose.
- Search notes and follow links and backlinks.
- Work with canvas boards, plugins, and optional AI tools.
- Use Forge to generate study material from a selected note. AI generation requires a configured provider; manual mind maps work without one.

GROOT keeps existing vault data in the `.openonyx` folder for compatibility with earlier versions. The application name and package identity are GROOT.

## Development

Use Node.js 22 or newer.

```bash
npm install
npm run dev
```

The development command starts Electron. For validation without launching the app:

```bash
npm run lint
npm test
npm run build
```

Renderer code is in `src/`, Electron code is in `electron/`, tests are in `tests/`, and packaging resources are in `build/` and `packaging/`. See [AGENTS.md](AGENTS.md) for repository conventions.

## Packaging

`npm run package:linux`, `npm run package:win`, and `npm run package:mac` build platform packages in `release/`. Packaging may require platform tools and application credentials. No GROOT release download URL is configured in this repository.

## License

Apache-2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
