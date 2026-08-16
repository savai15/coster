# Changelog

All notable changes to Coster are documented here. This project adheres to
[Semantic Versioning](https://semver.org/).

## [1.0.0] - 2026-08-16

Initial stable release.

### Added

- Offline-first memory store backed by `sql.js` (WASM SQLite) in `.coster/`.
- One-command bootstrap: `coster init --auto` detects your AI tool, installs git
  hooks, syncs, and backfills memories from `cost:<category>:` git directives.
- Export to 9+ assistant formats (Claude Code, OpenCode, Cursor, Copilot, Windsurf,
  Codex, Cline, Continue, Kiro) using a non-destructive managed block
  (`<!-- COSTER:START -->` / `<!-- COSTER:END -->`).
- MCP server (`coster mcp`) with `capture_memory`, `search_memories`,
  `list_memories`, `get_context`, `update_memory`, `delete_memory` tools and
  `memory://{id}` / `context://{tool}` resources.
- Quality gate, lifecycle/TTL auto-archive, stats, and per-tool configuration.
- Git post-commit / post-checkout hooks plus optional shell integration.
