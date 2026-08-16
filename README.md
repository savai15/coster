# Coster

> Universal, offline-first context persistence layer for AI coding assistants.

[![npm version](https://img.shields.io/npm/v/coster.svg)](https://www.npmjs.com/package/coster)
[![CI](https://github.com/savai15/coster/actions/workflows/ci.yml/badge.svg)](https://github.com/savai15/coster/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Node](https://img.shields.io/badge/node-18%2B-green.svg)](https://nodejs.org)

Coster captures the **why** of your codebase — decisions, conventions, workarounds, and
investigations — into a local SQLite database, then regenerates tool-specific memory files
(`CLAUDE.md`, `AGENTS.md`, `.cursorrules`, …) so every AI assistant you use shares the same
brain. No API keys, no cloud, no telemetry.

## Why

AI assistants forget everything between sessions. Coster gives them durable, structured
memory that follows your project instead of living inside one vendor's context window.

- **Offline & private** — everything is stored in `.coster/` inside your project.
- **Zero API keys** — `coster init --auto` detects your tool, installs hooks, syncs, and
  backfills memories from your git history.
- **Tool-agnostic** — one source of truth, exported to 9+ assistant formats.
- **Native-free** — storage uses `sql.js` (WASM SQLite), so there is no `node-gyp` build step.

## Install

```bash
npm install -g coster
# or run without installing:
npx coster@latest <command>
```

Requires Node.js 18+.

## Quick start

From the root of your project:

```bash
coster init --auto
```

This will:

1. **Detect** which AI assistant you use (`.claude`/`CLAUDE.md` → Claude Code, `AGENTS.md`
   → OpenCode, `.cursorrules` → Cursor, etc.).
2. **Install git hooks** (post-commit / post-checkout) that capture context automatically.
3. **Sync** a tool-specific memory file (e.g. `AGENTS.md`).
4. **Backfill** — scan git history for `cost:<category>:` directives and import them as
   memories.

Then just work. Git commits that include a directive like:

```
cost:decision: We standardized on feature flags for all new endpoints
```

…are automatically captured into Coster on every commit.

## Commands

| Command | Description |
|---------|-------------|
| `coster init [--auto] [--shell] [--tool <id>]` | Initialize a project. `--auto` runs the full bootstrap. |
| `coster capture --text "..." --category <c>` | Manually capture a memory. |
| `coster capture commit` / `coster capture checkout` | Called automatically by git hooks. |
| `coster search <query>` | Search memories (records access for `stats`). |
| `coster list [--category <c>]` | List memories. |
| `coster sync [--tool <id>] [--dry-run]` | Regenerate tool-specific memory files. |
| `coster memory add \| list \| show \| edit \| delete` | CRUD on individual memories. |
| `coster config get \| set \| list` | Read/modify configuration. |
| `coster status` | Health check ("doctor"). |
| `coster stats` | Memory statistics by category and access. |
| `coster hooks install \| uninstall \| list` | Manage git/shell hooks. |
| `coster mcp` | Start the MCP server. |

### Examples

```bash
# Add a memory
coster memory add -c convention -t "Use 2-space indentation" --tags style

# Search
coster search "indentation"

# Tune config
coster config set quality.minScore 6
coster config set tools.opencode.enabled false

# See what's going on
coster status
coster stats --json
```

## Supported tools & setup

Coster exports a managed block into each tool's memory file. Your own content in those files
is **preserved** — Coster only owns the region between `<!-- COSTER:START -->` and
`<!-- COSTER:END -->` markers, and re-writes only that region on every `sync`.

| Tool | File written |
|------|-------------|
| Claude Code | `CLAUDE.md` |
| OpenCode | `AGENTS.md` |
| Cursor | `.cursorrules` |
| GitHub Copilot | `.github/copilot-instructions.md` |
| Windsurf | `.windsurf/rules/coster.md` |
| Codex | `.codex/memory.md` |
| Cline | `.clinerules` |
| Continue | `.continue/rules/coster.md` |
| Kiro | `.kiro/steering/coster.md` |

### Enabling the MCP server (recommended)

The MCP server lets an assistant read and write memories directly. Add Coster to your
assistant's MCP configuration with the command `coster mcp`:

**Claude Code** — `.mcp.json` (project) or `~/.claude.json`:
```json
{
  "mcpServers": {
    "coster": {
      "command": "coster",
      "args": ["mcp", "--project", "."]
    }
  }
}
```

**OpenCode** — `~/.config/opencode/opencode.json`:
```json
{
  "mcp": {
    "coster": {
      "command": "coster",
      "args": ["mcp", "--project", "."]
    }
  }
}
```

**Cursor / VS Code / Cline / Continue / Windsurf / Codex / Kiro** — use the same shape in
their respective `mcp.json` / MCP settings file:
```json
{
  "mcpServers": {
    "coster": { "command": "coster", "args": ["mcp", "--project", "."] }
  }
}
```

> Requires Coster on your `PATH` (`npm install -g coster`). The `--project` flag defaults to
> the current directory when omitted.

## The `cost:` directive

Capture structured memory from commit messages without leaving your editor. The format is:

```
cost:<category>:[importance] <content>
```

- `category` — one of `preference`, `convention`, `decision`, `investigation`,
  `workaround`, `recap`, `mistake`.
- `importance` — optional `0..1` score; defaults to `0.8`.

Examples:

```
cost:decision: We standardized on feature flags for all new endpoints
cost:convention:0.6: All dates are stored as UTC ISO-8601 strings
cost:workaround: The staging API requires a trailing slash or it 500s
```

Every commit that includes a directive is captured by the post-commit hook.

## Memory categories

`preference` · `convention` · `decision` · `investigation` · `workaround` · `recap` · `mistake`

Memories carry an importance (0–1), tags, a source (`manual`, `git-hook`, `shell-hook`,
`auto`), and access counters used by `coster stats`.

## How it works

```
git commit ─▶ post-commit hook ─▶ coster capture commit
                                       │
         coster capture (manual) ──────┤
                                       ▼
                             ┌──────────────────────┐
                             │  .coster/coster.db   │  (sql.js / WASM SQLite)
                             └──────────────────────┘
                                       │
                             coster sync ─▶ AGENTS.md / CLAUDE.md / .cursorrules …
                                       │
                             injected into your assistant's context
```

## Configuration

Configuration lives in `.coster/config.json`. Key paths:

- `quality.minScore` — minimum quality-gate score to keep a memory.
- `tools.<name>.enabled` — toggle export for a specific assistant.
- `tools.<name>.exportPath` — where the generated file is written.
- `lifecycle.*` — TTLs and auto-archive behavior.

## FAQ

**Does Coster send my code anywhere?**
No. All storage is local (`sql.js` WASM SQLite inside `.coster/`). There is no network
call unless you explicitly connect the MCP server to an assistant.

**Will `sync` overwrite my `AGENTS.md`?**
No. Coster only writes the region between its `<!-- COSTER:START -->` / `<!-- COSTER:END -->`
markers. Anything you write outside that block is preserved.

**Do I need to be on a specific OS?**
No. Coster runs on Windows, macOS, and Linux. The git hooks are POSIX `sh` scripts that Git
runs natively on all three.

**Why do I need a global install for hooks?**
Git hooks invoke `coster` by name, so it must be on your `PATH`. Use `npm install -g coster`,
or run `npx coster@latest` for one-off commands.

**How do I disable a tool's export?**
`coster config set tools.<name>.enabled false`, then `coster sync`.

## Development

```bash
npm install
npm run build      # tsup → dist/
npm test           # vitest
npx tsc --noEmit   # typecheck
```

## License

MIT — see [LICENSE](./LICENSE).
