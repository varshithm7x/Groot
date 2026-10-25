# Settings

Settings control how GROOT behaves across editing, appearance, AI, plugins, sync, vault handling, and compatibility. Change settings deliberately and test them against a real note.

## Main setting areas

GROOT settings commonly affect:

- Appearance, themes, and wallpaper.
- Editor behavior and typography.
- Link style and link updating.
- AI provider configuration.
- Spaces and vault intelligence.
- Plugin installation and permissions.
- Sync configuration.
- Vault startup behavior.

## Change settings safely

For visual settings, open a long note, a code block, a link-heavy note, and a Forge panel before deciding. For vault or plugin settings, test in a copy if the setting can rename, move, or rewrite files.

## AI settings

OpenRouter is the default provider for new AI configurations. Add an API key in **AI & Models**, or choose OpenAI or Google Gemini with its own API key. GROOT remembers each provider's key and endpoint override separately.

AI settings, including keys and endpoint overrides, are saved locally in the current vault's `.openonyx/ai-settings.json`. GROOT's built-in note sync does not upload this file. If you share or sync the entire vault folder using another tool, exclude this file. Treat API keys as secrets and keep them out of notes, screenshots, and issues.

## Plugin settings

Plugin settings belong to the plugin that created them. If a plugin behaves unexpectedly, disable it, reopen the vault, and then re-enable it after checking permissions.

## Resetting a bad configuration

If a setting makes the interface hard to use, return to a built-in theme, disable wallpaper, collapse plugin panels, and restart the app. For plugin issues, disable the plugin before changing unrelated app settings.

## Continue learning

- [Themes](<Themes.md>)
- [Plugins](<Plugins.md>)
- [Sync](<Sync.md>)

