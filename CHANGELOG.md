# Changelog

All notable changes to Coster are documented here. This project adheres to
[Semantic Versioning](https://semver.org/).

## [1.0.4] - 2026-08-16

### Fixed

- Dev toolchain: bumped `vitest` and `@vitest/coverage-v8` to `^4.1.10` and pinned
  `esbuild` via `overrides` to `0.25.4`, clearing the repository's own `npm audit`
  (esbuild dev-server advisories). `npm audit` on the repo now reports 0 vulnerabilities.
- CI: dropped Node 18 from the test matrix (vitest 4 requires Node 20+).

## [1.0.3] - 2026-08-16

### Fixed

- Security: bumped `@modelcontextprotocol/sdk` to `^1.30.0` (resolves high-severity
  advisories GHSA-345p-7cg4-v4c7, GHSA-w48q-cv73-mx4w, GHSA-8r9q-7v3j-jr4g).
- Security: bumped `uuid` to `^11.1.1` (resolves moderate advisory GHSA-w5hq-g745-h8pq).
- Consumer `npm i coster` now installs with zero `npm audit` findings.

## [1.0.2] - 2026-08-16

### Added

- `coster note "<text>"` — quick-capture a memory from plain text with automatic
  category detection (decision / workaround / investigation / mistake / convention).
- `coster setup` — interactive setup wizard.
- `coster show [tool]` — print the generated memory file for a tool.
- `coster completion <bash|zsh|fish|pwsh>` — shell completion scripts.
- Portable `COSTER.md` fallback generated on every `init` and `sync` so any assistant
  can read Coster memory even when no specific tool is detected.
- Auto-sync on capture/edit/delete when `autoInject` is enabled (default).
- Plain `coster init` now runs the full bootstrap (was previously a no-op without
  `--auto`); `--tool` and an interactive picker select the target assistant.
- Broader stack detection (PHP/Laravel/Symfony, C#/ASP.NET, Ruby/Rails, Java/Spring,
  Go/Gin, plus more JS frameworks and build systems).

### Changed

- Backfill now imports only commits carrying an explicit `cost:<category>:` directive.

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
