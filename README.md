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
- **Zero API keys** — `coster init` detects your tool, installs hooks, syncs, and
  backfills memories from your git history.
- **Tool-agnostic** — one source of truth, exported to 9+ assistant formats.
- **No native build** — storage uses `sql.js` (WASM SQLite), so there is no `node-gyp` step.

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
coster init
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

Any other Coster command also auto-initializes the project if `.coster/` is missing, so you
can run a single command and have everything set up for you.

## Commands

| Command | Description |
|---------|-------------|
| `coster init [--auto] [--tool <id>] [--minimal]` | Initialize a project. Plain `init` runs the full bootstrap, always keeps a portable `COSTER.md`, and auto-registers the MCP server. Any other command auto-initializes if `.coster/` is missing. |
| `coster setup` | Interactive setup wizard. |
| `coster note "<text>"` | Quick-capture a memory from plain text (auto-categorizes). |
| `coster capture --text "..." --category <c>` | Manually capture a memory. |
| `coster capture commit` / `coster capture checkout` | Called automatically by git hooks. `commit` also auto-captures signal-rich commits (rule/config files, large/fix diffs) even without a `cost:` directive. |
| `coster capture import <path> [--tool claude\|opencode\|auto]` | Import memories from an exported agent conversation (Claude jsonl / OpenCode json / text). |
| `coster capture pr [--limit N]` | Capture memories from recently merged PRs (via your `gh` CLI). Enable with `coster config set capture.pr.enabled true`. |
| `coster capture shell` | Capture memories from the shell command log. Enable with `coster hooks install --shell`. |
| `coster daemon start \| stop \| status [--project <path>]` | File-watch daemon that auto-discovers tools, re-syncs context files on change, and runs scheduled maintenance. |
| `coster daemon install-service \| uninstall-service` | **Opt-in.** Install an OS service (Windows task on login; launchd/systemd template elsewhere) so the daemon runs unattended. Off by default — nothing auto-starts on login. |
| `coster lifecycle run [--dry-run] [--step archive\|decay\|consolidate]` | Run memory maintenance: archive expired, decay stale importance, merge duplicates. |
| `coster lifecycle status` | Show active/archived counts, pending TTL expirations and near-duplicates. |
| `coster lifecycle decay \| consolidate [--dry-run]` | Run a single lifecycle step. |
| `coster lifecycle duplicates` | List detected near-duplicate memory pairs (no writes). |
| `coster lifecycle merge <a> <b>` | Manually merge memory `b` into `a`. |
| `coster archive list \| restore <id> \| purge <id> \| purge-all` | Inspect and manage soft-archived memories (restorable; purge is permanent). |
| `coster embeddings fetch` | Download the local embedding model once (requires network; runtime stays offline). |
| `coster embeddings build` | Build/update the semantic index for all memories (auto-fetches the model if missing). |
| `coster embeddings status` | Show embedding/model/index state. |
| `coster embeddings clear` | Delete all vectors (revert to keyword-only search). |
| `coster search <query>` | Search memories with hybrid keyword + semantic ranking (records access for `stats`). |
| `coster list [--category <c>]` | List memories. |
| `coster show [tool]` | Print the generated memory file for a tool (default: `COSTER.md`). |
| `coster sync [--tool <id>] [--dry-run] [--no-discover]` | Regenerate tool-specific memory files. Auto-detects and enables newly added assistant tools (pass `--no-discover` to disable). |
| `coster memory add \| list \| show \| edit \| delete` | CRUD on individual memories. |
| `coster recall [<query>] [-f <file>] [-l <n>] [--json] [--no-semantic]` | Recall the most relevant memories for a topic or file, ranked by decayed importance (+ optional semantic). |
| `coster config get \| set \| list` | Read/modify configuration. |
| `coster status` | Health summary (detected tools, memory count, unconfigured tools). |
| `coster doctor` | Full health & environment check (Node, config, DB, git hooks, MCP, discovered tools). |
| `coster stats` | Memory statistics by category and access. |
| `coster hooks install \| uninstall \| list` | Manage git/shell hooks. Use `--shell` for shell-command capture and `--prepare-msg` to append `cost:` trailers to signal-rich commits. |
| `coster session start \| end \| list` | Manage capture sessions (inject context on start, archive expired memories on end). |
| `coster restore [-t <tool>]` | Print memories grouped by category for a tool. |
| `coster cleanup [--dry-run]` | Archive memories expired per lifecycle TTL. |
| `coster mcp` | Start the MCP server (stdio). |
| `coster mcp-install` | Register Coster as an MCP server for detected assistants (idempotent, cross-tool). |
| `coster mcp-remove` | Remove the Coster MCP server registration. |
| `coster completion <bash\|zsh\|fish\|pwsh>` | Print a shell completion script. |
| `coster byebro [--yes] [--purge-global]` | Remove Coster entirely from this project (`.coster/`, hooks, MCP, OS service, daemon) while leaving generated tool files (AGENTS.md, CLAUDE.md, …) untouched. |

### Examples

```bash
# Add a memory
coster memory add -c convention -t "Use 2-space indentation" --tags style

# Search
coster search "indentation"

# Recall the most relevant memories for a topic
coster recall "how do we cache sessions" --limit 5

# Tune config
coster config set quality.minScore 6
coster config set tools.opencode.enabled false

# See what's going on
coster status
coster stats --json
```

### Semantic search

Search is **hybrid**: keyword (BM25) fused with local embeddings (Reciprocal Rank
Fusion), so it matches by *meaning*, not just substrings. Setup is one extra command
after `init`:

```bash
coster embeddings build   # downloads a ~100MB local model once, then indexes all memories
coster search "how do we cache sessions"   # now understands "Redis", "cache", etc.
```

- The default model (`Xenova/bge-base-en-v1.5`, 768-d, runs on ONNX/WASM) is fetched
  **once** and stored under `~/.coster/models`. Runtime search never touches the network.
- If the index isn't built yet, `search` silently falls back to keyword-only, so search
  always works out of the box.
- From then on, the file-watch daemon keeps the index fresh automatically (toggle with
  `embeddings.autoBuild`).
- Want a smaller/faster model? `coster config set embeddings.model Xenova/all-MiniLM-L6-v2`
  and `coster config set embeddings.dim 384`. Want the largest? `Xenova/bge-large-en-v1.5`
  with `embeddings.dim 1024`. Then `coster embeddings build`.

### Memory lifecycle

Coster keeps itself tidy so it never rots into stale, contradictory noise. Three
automatic maintenance steps run on a schedule (inside the daemon) and on demand:

1. **Archive** — memories past their per-category TTL (`recap` 30d, `investigation` 90d,
   `workaround` 90d) are *soft*-archived: moved to a restorable `archive` table, not
   deleted. `coster archive list` / `restore` / `purge` manage them.
2. **Decay** — importance fades with age (exponential half-life, default 180d, floored at
   `decayMinImportance` 0.2) so fresh memories rank above ancient ones without vanishing.
3. **Consolidate** — near-duplicate memories (cosine ≥ `consolidateSimilarity`, default
   0.92, same category among `preference|convention|decision|workaround|mistake`) are merged
   into one. Needs the semantic index (`embeddings build`).

```bash
coster lifecycle status        # what's pending?
coster lifecycle run --dry-run # preview counts, no writes
coster lifecycle run           # do it
```

**Nothing starts itself on OS login.** The daemon, its scheduled maintenance, and the
OS boot service are all *off by default* and strictly opt-in:

- The in-daemon scheduler is gated by `scheduler.enabled` (default `false`). A manually
  started daemon only does file-watch sync until you opt in.
- `coster daemon install-service` is the only way to make Coster launch on login — you have
  to type it yourself. If you don't want that, you never get it.

```bash
coster daemon install-service  # opt in: run the daemon (archive+decay daily, consolidate weekly) on login
coster config set scheduler.enabled true   # opt in: let a running daemon schedule maintenance
```

Every step is safe to re-run and skips what's disabled in config (`lifecycle.autoArchive`,
`scheduler.enabled`, `embeddings.enabled`).

### Smart context injection

Instead of dumping every memory into your tool files, injection is relevance-curated by
default (`injection.mode: 'curated'`):

- **Decayed importance** — every injected memory is scored with its *age-decayed* importance
  (see Memory lifecycle), so fresh, frequently-used memories surface and ancient ones fade
  rather than bloating the context window.
- **Optional semantic focus** — when an embedding model is present locally, `coster recall`,
  the MCP `recall` tool, and `get_context --focus` blend the decayed ranking with semantic
  similarity to the topic/file so the most topically relevant memories float up. No model?
  Curation silently falls back to decayed importance — still fully offline, no network, no
  download.
- **Budget-fit** — curated memories are trimmed to each tool's `tokenBudget` so they always
  fit. Legacy `injection.mode: 'all'` restores the old "fit-all-then-truncate" behavior.

The daemon also prints a one-line 💡 recall hint when you edit a file (proactive recall),
pointing you at the most relevant existing memory — it never rewrites your tool files on its
own.

```bash
coster recall "configure the build cache" --limit 5   # focused recall
coster recall -f src/build.ts                          # recall by file path
coster config set injection.semanticWeight 0.5
coster config set injection.mode all                   # legacy behavior
```

### Removing Coster (`byebro`)

`coster byebro` fully decommission Coster from a project: it stops the daemon, removes the
OS service, uninstalls git/shell hooks and the MCP registration, and deletes `.coster/`
(including the memory DB and vectors). The generated assistant tool files (AGENTS.md,
CLAUDE.md, `.cursorrules`, `COSTER.md`, …) are **left exactly as they were** — your project
keeps working with the context already written. Add `--purge-global` to also delete the
globally cached embedding model (`~/.coster/models`).

```bash
coster byebro --yes          # remove Coster, keep your tool files
coster byebro --yes --purge-global
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
| Coster (portable) | `COSTER.md` |

### Enabling the MCP server (recommended)

The MCP server lets an assistant read and write memories directly. The easiest way is to let
Coster register itself — `coster init` does this automatically, or run it any time with:

```bash
coster mcp-install
```

This writes an idempotent `coster` entry into the standard `.mcp.json` (Claude Code, Cursor,
VS Code, Cline, Windsurf, Codex) and, if present, merges into `opencode.jsonc`. Run
`coster mcp-remove` to clean up. The registered server uses `npx -y coster mcp`.

To register manually instead, add the entry yourself:

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
cost:<category>: <content>
```

- `category` — one of `preference`, `convention`, `decision`, `investigation`,
  `workaround`, `recap`, `mistake`.

Examples:

```
cost:decision: We standardized on feature flags for all new endpoints
cost:convention: All dates are stored as UTC ISO-8601 strings
cost:workaround: The staging API requires a trailing slash or it 500s
```

Every commit that includes a directive is captured by the post-commit hook (stored with importance `0.8`).

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
- `lifecycle.*` — TTLs and auto-archive behavior: `recapTTL`, `investigationTTL`,
  `workaroundTTL`, `autoArchive`, `decayHalfLifeDays`, `decayMinImportance`,
  `consolidateSimilarity`.
- `scheduler.*` — in-daemon maintenance cadence (off by default; opt in with
  `config set scheduler.enabled true`): `enabled`, `decayEveryHours`,
  `archiveEveryHours`, `consolidateEveryHours`.
- `injection.*` — smart context injection: `mode` (`curated` default, or `all`),
  `useSemantic` (blend semantic ranking when a model is present), `semanticWeight`
  (0–1 blend factor, default 0.4), `maxMemories` (curate cap per file, default 200),
  `proactive` (print a 💡 recall hint on file edits via the daemon, default true).

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
