# COSTER — Master Research & Implementation Plan

> **Universal Context Persistence Layer for AI Coding Assistants**
> Version: 1.0 | Date: August 2026

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Research Findings](#3-research-findings)
   - 3.1 AI Coding Tools Context Systems
   - 3.2 The AGENTS.md Standard
   - 3.3 MCP Protocol Deep Dive
   - 3.4 Git Hooks & Automation
   - 3.5 Context Capture Without AI APIs
   - 3.6 Storage Formats & Architecture
   - 3.7 Context Injection at Session Start
   - 3.8 Cross-Tool & Cross-Platform
   - 3.9 CLI Design Best Practices
   - 3.10 Existing Tools Analysis
   - 3.11 Community Pain Points
   - 3.12 Technical Implementation
4. [Enhanced Coster Architecture](#4-enhanced-coster-architecture)
5. [Feature Specification](#5-feature-specification)
6. [Implementation Roadmap](#6-implementation-roadmap)
7. [Risk Matrix](#7-risk-matrix)
8. [Appendix: Source Citations](#8-appendix-source-citations)

---

## 1. Executive Summary

**Coster** is an open-source, offline-first, zero-API-key context persistence layer for AI coding assistants. It captures, stores, and restores project context automatically across sessions and across tools.

### What Makes Coster Different

1. **Universal** — Works with Claude Code, Cursor, Copilot, Windsurf, OpenCode, Codex CLI, Aider, Gemini CLI, Cline, Continue.dev, Kiro, and any MCP-compatible tool
2. **Offline-first** — No cloud dependency, no API keys required for core functionality
3. **Quality-gated** — 7-rule quality gate prevents noise; only high-signal context is persisted
4. **Cross-tool** — One `.coster/` directory, all tools read from it
5. **Hook-driven** — Automatic capture via git hooks, shell integration, and tool-specific hooks
6. **MCP-native** — Exposes context as MCP tools/resources for runtime access
7. **Token-budget-aware** — Smart injection that respects each tool's context limits

### Target Metrics

| Metric | Target |
|--------|--------|
| Time to first context restore | < 30 seconds |
| Tool integrations | 12+ at launch |
| Memory quality score | > 85% relevance |
| Zero-config usage | Works with `coster init` |
| Offline operation | 100% core features |

---

## 2. Problem Statement

### The Core Problem

AI coding tools forget everything between sessions. Every new session starts from zero. Developers waste 10-20 minutes per session re-explaining:
- Project architecture and conventions
- Active bugs and workarounds
- Why certain decisions were made
- What files are important and why

### The Fragmentation Problem

The AI coding ecosystem has fractured into 12+ tools, each with its own context format:

| Format | Tool | Path |
|--------|------|------|
| CLAUDE.md | Claude Code | `./CLAUDE.md`, `~/.claude/` |
| .cursorrules | Cursor | `./.cursorrules` |
| .cursor/rules/*.mdc | Cursor | `./.cursor/rules/` |
| .github/copilot-instructions.md | Copilot | `./.github/` |
| AGENTS.md | Codex, Jules, OpenCode, 20+ tools | `./AGENTS.md` |
| .windsurf/rules/*.md | Windsurf | `./.windsurf/` |
| .codex/memory.md | Codex CLI | `./.codex/` |
| .aider.conf.yml | Aider | `./.aider.conf.yml` |
| GEMINI.md | Gemini CLI | `./GEMINI.md` |
| .clinerules | Cline | `./.clinerules` |
| .continue/rules/*.md | Continue.dev | `./.continue/` |
| .kiro/steering/*.md | Kiro | `./.kiro/` |

Teams end up with **12+ files** that drift out of sync, each with different formats and different capabilities.

### The Quality Problem

Most AI memory tools store everything, leading to:
- **Noise**: Low-quality memories dilute signal
- **Stale context**: Outdated information persists
- **No deduplication**: Same facts stored multiple times
- **No lifecycle management**: Everything is permanent

### Coster's Solution

Coster provides:
1. **Single source of truth** — One `.coster/` directory with structured storage
2. **Auto-sync** — Generates format-specific files for each tool
3. **Quality gate** — 7-rule filter prevents noise
4. **Lifecycle management** — Automatic cleanup and archiving
5. **MCP server** — Runtime context access for any compatible tool
6. **Hook system** — Automatic capture without manual intervention

---

## 3. Research Findings

### 3.1 AI Coding Tools Context Systems

#### Claude Code (Anthropic)

**File Structure:**
```
~/.claude/
├── CLAUDE.md              # User-level instructions
├── settings.json          # Global settings
├── commands/              # Custom slash commands
├── skills/                # Skill definitions
└── projects/
    └── <project-hash>/
        ├── memory.md      # Auto-memory
        └── rules/         # Project-specific rules
```

**CLAUDE.md Format:**
```markdown
# Project Instructions

## Build Commands
- `npm run build` — Build the project
- `npm test` — Run tests

## Code Style
- Use TypeScript strict mode
- Prefer functional components
```

**Token Budget:**
- CLAUDE.md: ~10,000 tokens (soft limit)
- Auto-memory: ~2,000 tokens
- Project rules: ~5,000 tokens
- Total context injection: ~17,000 tokens

**Hook System:**
```json
// .claude/settings.json
{
  "hooks": {
    "SessionStart": [{ "command": "coster session-start" }],
    "PreToolUse": [{ "command": "coster pre-tool" }],
    "PostToolUse": [{ "command": "coster post-tool" }]
  }
}
```

**Context Compaction:**
- CLAUDE.md is exempt from compaction (if marked with `<!-- persist -->`)
- Auto-memory gets compressed during compaction
- Workaround: Use `@import` to reference persistent files

#### Cursor

**File Structure:**
```
.cursor/
├── rules/
│   ├── *.mdc              # Glob-activated rules
│   └── global.mdc         # Always-active rules
├── hooks.json             # Hook definitions
├── hooks/*.sh             # Hook scripts
└── commands/*.md          # Custom commands
```

**MDC Frontmatter Format:**
```markdown
---
description: TypeScript coding conventions
globs: ["src/**/*.ts", "src/**/*.tsx"]
alwaysApply: false
---

# TypeScript Conventions

- Use strict mode
- Prefer `const` over `let`
- Use async/await over .then()
```

**Context Management:**
- Cursor indexes codebase automatically
- Rules are injected based on glob patterns
- Memories were removed in v2.1 (moved to rules)
- MCP integration available

#### GitHub Copilot

**File Structure:**
```
.github/
├── copilot-instructions.md
└── copilot/
    └── settings.json
```

**Multi-Level Override System:**
1. Organization level: `.github/copilot-instructions.md`
2. Repository level: `.github/copilot-instructions.md`
3. User level: Settings sync

**Copilot Memory (March 2026):**
- Stores user preferences and patterns
- Persists across sessions
- Auto-learns from accepted suggestions
- Currently in public preview

#### Windsurf (Codeium)

**File Structure:**
```
.windsurf/
├── rules/
│   └── *.md               # Rule files
└── memories/
    └── *.json             # Memory files

~/.codeium/windsurf/
└── memories/              # Global memories
```

**Cascade Memory:**
- Context persists across Cascade sessions
- Memories stored in `~/.codeium/windsurf/memories/`
- Format: JSON with metadata

#### OpenCode

**File Structure:**
```
.opencode/
├── opencode.json          # Configuration
├── agent/*.md             # Agent definitions
├── command/*.md           # Command definitions
├── skill/*/SKILL.md       # Skill definitions
└── plugin/                # Plugins

AGENTS.md                  # Project instructions
```

**Config Format:**
```json
{
  "$schema": "https://opencode.ai/config.json",
  "model": "anthropic/claude-sonnet-4-6",
  "permission": {
    "external_directory": { "*": "allow" }
  },
  "mcp": {
    "coster": {
      "type": "local",
      "command": ["coster", "mcp"],
      "enabled": true
    }
  }
}
```

#### Codex CLI (OpenAI)

**File Structure:**
```
.codex/
├── memory.md              # Persistent memory
├── config.toml            # Configuration
└── hooks.json             # Hook definitions
```

**Memory Format:**
```markdown
# Project Memory

## Architecture
- Monorepo with Turborepo
- Frontend: Next.js 15 + React 19
- Backend: Hono on Cloudflare Workers

## Conventions
- Use pnpm workspaces
- Prefer server components
- Use Drizzle ORM
```

#### Aider

**File Structure:**
```
.aider.conf.yml            # Configuration
.aider/
├── chat_history.md        # Chat history
└── conventions.md         # Coding conventions
```

**Config Format:**
```yaml
# .aider.conf.yml
model: gpt-4o
auto-commits: true
dirty-commits: true
editor: cursor
```

#### Gemini CLI (Google)

**File Structure:**
```
GEMINI.md                  # Project instructions
~/.gemini/
└── settings.json          # Global settings
```

#### Cline

**File Structure:**
```
.clinerules                # Project rules
~/.cline/
└── memory.md              # Persistent memory
```

#### Continue.dev

**File Structure:**
```
.continue/
├── config.json            # Configuration
└── rules/
    ├── always-on.md       # Always active
    ├── *.md               # Glob-triggered
    └── agent-requested.md # On-demand
```

#### Kiro (Amazon)

**File Structure:**
```
.kiro/
└── steering/
    ├── architecture.md    # Architecture decisions
    ├── conventions.md     # Coding conventions
    └── standards.md       # Quality standards
```

#### Other Tools

| Tool | File | Path |
|------|------|------|
| Sourcegraph Cody | `.cody/` | `~/.cody/` |
| Tabnine | `.tabnine/` | `~/.tabnine/` |
| JetBrains AI | `.idea/ai/` | Project-level |
| Amazon Q | `.amazonq/rules/` | `./.amazonq/` |

---

### 3.2 The AGENTS.md Standard

**Specification:**
- Format: Plain markdown
- Location: Repository root (or nested, nearest-file-wins)
- Extension: `.md`
- No frontmatter required

**Adoption:**
- 60,000+ open-source repositories
- Supported by: Codex, Jules, Factory, Aider, goose, opencode, Zed, Warp, Cursor (partial), Copilot (partial)

**Format:**
```markdown
# AGENTS.md

## Project Overview
Description of the project.

## Setup
- `npm install` — Install dependencies
- `npm run dev` — Start development server

## Testing
- `npm test` — Run unit tests
- `npm run test:e2e` — Run E2E tests

## Code Style
- Use TypeScript strict mode
- Prefer functional components
- Use Prettier for formatting

## Architecture
- Frontend: React 19 + Vite
- Backend: Express.js + PostgreSQL
```

**Key Differences from CLAUDE.md:**
1. AGENTS.md is tool-agnostic; CLAUDE.md is Claude-specific
2. AGENTS.md uses nearest-file-wins; CLAUDE.md uses layering
3. AGENTS.md has no auto-memory equivalent
4. AGENTS.md has no `@import` syntax

**Migration Paths:**
- Use RuleSync tools to generate all formats from one source
- Add `@AGENTS.md` import to CLAUDE.md for Claude Code compatibility
- Keep AGENTS.md as single source of truth

---

### 3.3 MCP Protocol Deep Dive

**Specification Version:** 2026-07-28

**Transport:**
- **stdio** — Subprocess communication (primary)
- **Streamable HTTP** — Replaced SSE transport

**Server Primitives:**

| Primitive | Control | Purpose | Example |
|-----------|---------|---------|---------|
| **Tools** | Model-controlled | Functions the AI can call | `search_code`, `get_context` |
| **Resources** | Application-controlled | Data the app provides | `project://memory`, `project://decisions` |
| **Prompts** | User-controlled | Reusable prompt templates | `summarize_session`, `review_code` |

**Official SDKs:**
- TypeScript: `@modelcontextprotocol/sdk`
- Python: `mcp`
- C#: `ModelContextProtocol`
- Go: `github.com/mark3labs/mcp-go`
- Java: `io.modelcontextprotocol:sdk`

**MCP Server for Coster:**
```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new McpServer({
  name: "coster",
  version: "1.0.0"
});

// Tool: Search memories
server.tool(
  "search_memories",
  { query: { type: "string" }, category: { type: "string", optional: true } },
  async ({ query, category }) => {
    const results = await searchMemories(query, category);
    return { content: [{ type: "text", text: JSON.stringify(results) }] };
  }
);

// Resource: Project context
server.resource(
  "project_context",
  "project://context",
  async (uri) => {
    const context = await loadProjectContext();
    return { contents: [{ uri: uri.href, text: context }] };
  }
);

// Prompt: Session start
server.prompt(
  "session_start",
  { project_path: { type: "string" } },
  async ({ project_path }) => {
    const context = await loadSessionContext(project_path);
    return { messages: [{ role: "user", content: { type: "text", text: context } }] };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
```

**Memory MCP Servers:**
- MemMachine — Graph-based memory
- Codified Context — Session-aware memory
- memory-bank — File-based memory with adapters

---

### 3.4 Git Hooks & Automation

**Available Hooks:**

| Hook | When | What to Capture |
|------|------|-----------------|
| `pre-commit` | Before commit | Changed files, diff stats |
| `post-commit` | After commit | Commit hash, message, files |
| `post-merge` | After merge | Merged branches, conflicts resolved |
| `post-checkout` | After checkout | Branch change, previous branch |
| `post-rewrite` | After rebase/amend | Rewritten commits |

**Installation:**
```bash
# Using Coster's built-in installer
coster hooks install

# Manual installation
git config core.hooksPath .coster/hooks
```

**Hook Script Example:**
```bash
#!/bin/bash
# .coster/hooks/post-commit
COMMIT_HASH=$(git rev-parse HEAD)
COMMIT_MSG=$(git log -1 --pretty=%B)
CHANGED_FILES=$(git diff-tree --no-commit-id --name-only -r HEAD)

coster capture commit \
  --hash "$COMMIT_HASH" \
  --message "$COMMIT_MSG" \
  --files "$CHANGED_FILES"
```

**Shell Integration:**
```bash
# Bash
trap 'coster capture command "$BASH_COMMAND"' DEBUG

# PowerShell
function prompt { $host.UI.RawUI.WindowTitle = coster capture command (Get-History -Count 1).CommandLine }
```

---

### 3.5 Context Capture Without AI APIs

**Project Detection:**

```typescript
// Detect project stack from files
function detectStack(projectPath: string): StackInfo {
  const files = readdirSync(projectPath);
  
  return {
    language: detectLanguage(files),
    framework: detectFramework(files),
    buildSystem: detectBuildSystem(files),
    packageManager: detectPackageManager(files),
    testFramework: detectTestFramework(files),
  };
}

function detectLanguage(files: string[]): string {
  if (files.includes('package.json')) return 'JavaScript/TypeScript';
  if (files.includes('Cargo.toml')) return 'Rust';
  if (files.includes('go.mod')) return 'Go';
  if (files.includes('requirements.txt') || files.includes('pyproject.toml')) return 'Python';
  // ...
}
```

**Git-Based Analysis:**

```typescript
// Analyze git history for patterns
function analyzeGitHistory(repoPath: string): GitAnalysis {
  const commits = execSync('git log --oneline -100', { cwd: repoPath }).toString();
  const blame = execSync('git blame --line-porcelain src/index.ts', { cwd: repoPath }).toString();
  
  return {
    commitFrequency: analyzeCommitFrequency(commits),
    contributors: extractContributors(blame),
    hotspots: findHotspotFiles(commits),
    conventions: detectConventions(commits),
  };
}
```

**Code Analysis:**

```typescript
// Detect conventions from code
function detectConventions(code: string): Conventions {
  return {
    naming: detectNamingConvention(code),     // camelCase, snake_case, etc.
    imports: detectImportStyle(code),          // relative, absolute, barrel
    exports: detectExportStyle(code),          // default, named
    testing: detectTestPatterns(code),          // describe/it, test/expect
  };
}
```

---

### 3.6 Storage Formats & Architecture

**Recommended `.coster/` Directory Structure:**
```
.coster/
├── schema.json             # Schema version and metadata
├── context.json            # Project-level context
├── memories/
│   ├── preferences.json    # User preferences (permanent)
│   ├── conventions.json    # Project conventions (long-lived)
│   ├── decisions.json      # Architectural decisions (permanent)
│   ├── investigations.json # Active investigations (until resolved)
│   ├── workarounds.json    # Bug workarounds (until fixed)
│   ├── recaps/             # Session recaps (30-day TTL)
│   │   ├── 2026-08-15.json
│   │   └── 2026-08-16.json
│   └── mistakes.json       # Mistake log (permanent)
├── sessions/
│   └── <session-id>.json   # Session snapshots
├── exports/                # Generated files for each tool
│   ├── CLAUDE.md
│   ├── .cursorrules
│   ├── AGENTS.md
│   └── copilot-instructions.md
├── hooks/                  # Git hooks
│   ├── pre-commit
│   ├── post-commit
│   └── post-checkout
└── cache/                  # Temporary data
    └── embeddings/
```

**Schema Versioning:**
```json
{
  "version": 2,
  "created_at": "2026-08-16T00:00:00Z",
  "migration_from": 1,
  "features": ["mcp", "hooks", "quality_gate"]
}
```

**SQLite Schema (for large projects):**
```sql
-- Memories table
CREATE TABLE memories (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  content TEXT NOT NULL,
  importance REAL DEFAULT 0.5,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  accessed_at TEXT NOT NULL,
  access_count INTEGER DEFAULT 0,
  tags TEXT,  -- JSON array
  source TEXT,  -- git hook, manual, auto
  UNIQUE(category, content)
);

-- Full-text search
CREATE VIRTUAL TABLE memories_fts USING fts5(content, category, tags);

-- Sessions table
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  summary TEXT,
  files_changed TEXT,  -- JSON array
  decisions_made TEXT  -- JSON array
);
```

**Memory Types & Lifecycles:**

| Type | TTL | Cleanup | Example |
|------|-----|---------|---------|
| Preferences | Permanent | Never | "Use 2-space indent" |
| Conventions | Long-lived | Manual | "Use functional components" |
| Decisions | Permanent | Never | "Chose PostgreSQL over MySQL" |
| Investigations | Until resolved | Auto | "Investigating memory leak" |
| Workarounds | Until fixed | Auto | "Patch for issue #123" |
| Recaps | 30 days | Auto | Session summaries |
| Mistakes | Permanent | Never | "Don't use var in TS" |

**Quality Gate (7 Rules):**

1. **Specificity**: Must be specific to this project, not generic advice
2. **Actionability**: Must be something the AI can act on
3. **Currency**: Must be current (not outdated)
4. **Uniqueness**: Not a duplicate of existing memory
5. **Evidence**: Must have evidence (git blame, file reference)
6. **Relevance**: Must be relevant to active work
7. **Conciseness**: Must be concise (< 200 tokens)

---

### 3.7 Context Injection at Session Start

**Token Budget by Tool:**

| Tool | Total Budget | Recommended Allocation |
|------|--------------|------------------------|
| Claude Code | ~17,000 tokens | Rules: 10K, Memory: 2K, Context: 5K |
| Cursor | ~12,000 tokens | Rules: 8K, Context: 4K |
| Copilot | ~8,000 tokens | Instructions: 5K, Context: 3K |
| OpenCode | ~15,000 tokens | AGENTS.md: 10K, Context: 5K |
| Codex CLI | ~10,000 tokens | Memory: 5K, Context: 5K |

**Injection Methods:**

```typescript
// Generate format-specific files
async function generateExports(context: ProjectContext): Promise<void> {
  const tokenBudget = getToolBudget(context.tool);
  const prioritized = prioritizeContext(context.memories, tokenBudget);
  
  switch (context.tool) {
    case 'claude-code':
      await writeFile('CLAUDE.md', formatAsClaudeMd(prioritized));
      break;
    case 'cursor':
      await writeFile('.cursorrules', formatAsCursorRules(prioritized));
      break;
    case 'copilot':
      await writeFile('.github/copilot-instructions.md', formatAsCopilotInstructions(prioritized));
      break;
    // ...
  }
}
```

**Context Prioritization Algorithm:**

```typescript
function prioritizeContext(memories: Memory[], budget: number): Memory[] {
  return memories
    .map(m => ({
      ...m,
      score: calculateScore(m, budget)
    }))
    .sort((a, b) => b.score - a.score)
    .reduce((acc, m) => {
      const tokens = estimateTokens(m.content);
      if (acc.totalTokens + tokens <= budget) {
        acc.memories.push(m);
        acc.totalTokens += tokens;
      }
      return acc;
    }, { memories: [], totalTokens: 0 })
    .memories;
}

function calculateScore(memory: Memory, budget: number): number {
  return (
    memory.importance * 0.4 +
    (memory.accessCount / 100) * 0.2 +
    (1 - daysSince(memory.lastAccessed) / 30) * 0.2 +
    (memory.category === 'decision' ? 0.2 : 0)
  );
}
```

---

### 3.8 Cross-Tool & Cross-Platform

**Windows-Specific:**
- PowerShell integration for hooks
- Windows path handling (use forward slashes internally)
- Windows scheduled tasks for background operation
- Windows terminal integration

**Cross-Platform CLI:**
- Node.js for cross-platform CLI
- Use `path` module for path handling
- Handle line endings (CRLF vs LF)
- Detect OS and adjust paths

**Browser Integration (Limited):**
- Chrome extension for extracting chat content
- Export from ChatGPT, Claude.ai, Gemini
- Import exported conversations
- Bookmarklet approach

---

### 3.9 CLI Design Best Practices

**Command Structure:**

| Pattern | Form | Use When |
|---------|------|----------|
| Noun-Verb (preferred) | `coster memory list` | Tools with many resource types |
| Verb-Noun | `list memories` | Small tools with few commands |

**CLI Spec for AI Agents:**

| # | Principle | Description |
|---|-----------|-------------|
| 1 | Structured Output | JSON when piped, human-friendly in terminal |
| 2 | Schema Introspection | Let consumers discover capabilities at runtime |
| 3 | Stderr/Stdout Separation | Data to stdout, everything else to stderr |
| 4 | Non-Interactive by Default | Never block on input without a TTY |
| 5 | Idempotent Operations | Re-running converges to same state |
| 6 | Bounded Output | Let consumers control volume |
| 7 | Strict Input Validation | Reject malformed data |
| 8 | NDJSON for Streaming | One JSON object per line |
| 9 | No ANSI When Piped | Respect `NO_COLOR` |
| 10 | Observable Long Operations | Report progress on stderr |

**Recommended Libraries (Node.js):**

| Library | Purpose | Why |
|---------|---------|-----|
| Commander.js | Arg parsing | Fast, simple, 0 dependencies |
| Inquirer.js | Interactive prompts | Rich UI, well-maintained |
| chalk | Terminal colors | Lightweight, fast |
| ora | Spinners | Smooth animations |
| cli-table3 | Tables | Formatted output |
| zod | Validation | Type-safe schemas |

---

### 3.10 Existing Tools Analysis

| Tool | Architecture | Unique Feature | Limitation |
|------|-------------|----------------|------------|
| **projectmem** | Event log (JSONL) | Judgment gate | No MCP tools |
| **kōdo** | SQLite | Git extraction | Single-tool focus |
| **devctx** | File-based | CLAUDE.md sync | Claude-only |
| **RelayContext** | Branch-scoped JSON | Save/resume | No quality gate |
| **context-mcp** | ContextGraph | Cross-agent sharing | No offline mode |
| **memory-bank** | File + adapters | Code graph | Complex setup |
| **Cortex** | 6-type memory | Quality gate | No CLI |
| **MemNexus** | Knowledge graph | Semantic search | Requires API |

**Coster's Differentiators:**
1. **Universal** — All tools, not just one
2. **Quality-gated** — 7-rule filter
3. **Hook-driven** — Automatic capture
4. **MCP-native** — Runtime access
5. **Offline-first** — No cloud dependency
6. **Token-budget-aware** — Smart injection

---

### 3.11 Community Pain Points

**Top Complaints:**

1. **"I have to re-explain everything every session"** — #1 complaint
2. **"CLAUDE.md keeps getting compacted"** — Important rules lost
3. **"I have 12 different files for 12 different tools"** — Fragmentation
4. **"My global CLAUDE.md applies to every repo"** — No per-project scoping
5. **"AGENTS.md doesn't work with Claude Code"** — Format incompatibility

**Feature Requests:**

1. **Auto-capture from git commits** — "Just learn from what I do"
2. **Cross-tool sync** — "Write once, use everywhere"
3. **Quality filtering** — "Don't store garbage"
4. **Token budget awareness** — "Don't overflow my context"
5. **Offline operation** — "No API keys required"

**What Would Make People Star a Repo:**

1. **Zero-config setup** — `coster init` and done
2. **Automatic context restoration** — "It just remembers"
3. **Works with all tools** — Universal compatibility
4. **Quality > Quantity** — Fewer, better memories
5. **Fast** — < 30 seconds to restore context

---

### 3.12 Technical Implementation

**Recommended Stack:**

| Component | Technology | Why |
|-----------|-----------|-----|
| Language | TypeScript 5.5+ | Type safety, Node.js ecosystem |
| Runtime | Node.js 18+ | Cross-platform, LTS |
| Build | tsup | Fast, generates ESM + CJS |
| CLI | Commander.js | Fast, simple, 0 deps |
| Storage | SQLite (better-sqlite3) | Fast, reliable, FTS5 |
| MCP | @modelcontextprotocol/sdk | Official SDK |
| Testing | Vitest | Fast, ESM-native |
| Distribution | npm + Bun compile | Universal + standalone |

**Project Structure:**
```
coster/
├── bin/
│   └── cli.js              # CLI entry point
├── src/
│   ├── index.ts            # Root exports
│   ├── cli/
│   │   ├── index.ts        # Commander program
│   │   ├── commands/
│   │   │   ├── init.ts     # `coster init`
│   │   │   ├── capture.ts  # `coster capture`
│   │   │   ├── restore.ts  # `coster restore`
│   │   │   ├── sync.ts     # `coster sync`
│   │   │   ├── search.ts   # `coster search`
│   │   │   ├── mcp.ts      # `coster mcp`
│   │   │   ├── hooks.ts    # `coster hooks`
│   │   │   └── config.ts   # `coster config`
│   │   └── utils/
│   │       ├── output.ts   # Formatted output
│   │       └── prompts.ts  # Interactive prompts
│   ├── core/
│   │   ├── storage.ts      # SQLite operations
│   │   ├── memory.ts       # Memory CRUD
│   │   ├── quality.ts      # Quality gate
│   │   ├── lifecycle.ts    # TTL and cleanup
│   │   ├── search.ts       # Full-text search
│   │   └── export.ts       # Format generation
│   ├── capture/
│   │   ├── git.ts          # Git hook capture
│   │   ├── shell.ts        # Shell integration
│   │   ├── detect.ts       # Project detection
│   │   └── analyze.ts      # Code analysis
│   ├── inject/
│   │   ├── claude.ts       # CLAUDE.md generation
│   │   ├── cursor.ts       # .cursorrules generation
│   │   ├── copilot.ts      # copilot-instructions.md
│   │   ├── agents.ts       # AGENTS.md generation
│   │   ├── windsurf.ts     # .windsurf/rules/
│   │   └── priority.ts     # Token budget management
│   ├── mcp/
│   │   ├── server.ts       # MCP server
│   │   ├── tools.ts        # MCP tools
│   │   ├── resources.ts    # MCP resources
│   │   └── prompts.ts      # MCP prompts
│   └── types/
│       ├── memory.ts       # Memory types
│       ├── context.ts      # Context types
│       └── config.ts       # Config types
├── tests/
│   ├── unit/
│   ├── integration/
│   └── fixtures/
├── package.json
├── tsconfig.json
├── tsup.config.ts
└── vitest.config.ts
```

**Distribution:**

```bash
# npm global install
npm install -g coster

# npx (no install)
npx coster init

# Standalone binary (Bun)
bun build --compile --target=bun-linux-x64 src/cli/index.ts
```

---

## 4. Enhanced Coster Architecture

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        COSTER ARCHITECTURE                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │   Capture     │    │   Storage    │    │   Injection  │      │
│  │   Layer       │───▶│   Layer      │───▶│   Layer      │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│         │                   │                   │                │
│         ▼                   ▼                   ▼                │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │ Git Hooks    │    │ SQLite       │    │ CLAUDE.md    │      │
│  │ Shell Hooks  │    │ FTS5 Search  │    │ .cursorrules │      │
│  │ Tool Hooks   │    │ Quality Gate │    │ AGENTS.md    │      │
│  │ Manual       │    │ Lifecycle    │    │ copilot.md   │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│         │                   │                   │                │
│         ▼                   ▼                   ▼                │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │   MCP        │    │   CLI        │    │   Web UI     │      │
│  │   Server     │    │   Interface  │    │   (Future)   │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
1. CAPTURE PHASE
   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
   │ Git Commit   │────▶│ Hook Script │────▶│ coster      │
   │ (post-commit)│     │             │     │ capture     │
   └─────────────┘     └─────────────┘     └─────────────┘
                                                   │
                                                   ▼
                                              ┌─────────────┐
                                              │ Quality Gate│
                                              │ (7 Rules)   │
                                              └─────────────┘
                                                   │
                                                   ▼
                                              ┌─────────────┐
                                              │ SQLite      │
                                              │ Storage     │
                                              └─────────────┘

2. INJECTION PHASE
   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
   │ AI Tool     │────▶│ coster      │────▶│ Token       │
   │ Session Start│     │ restore     │     │ Budget      │
   └─────────────┘     └─────────────┘     └─────────────┘
                                                   │
                                                   ▼
                                              ┌─────────────┐
                                              │ Format      │
                                              │ Generator   │
                                              └─────────────┘
                                                   │
                                                   ▼
                                              ┌─────────────┐
                                              │ Tool-Specific│
                                              │ Context File │
                                              └─────────────┘
```

### Quality Gate Detail

```
┌─────────────────────────────────────────────────────────────────┐
│                     QUALITY GATE (7 RULES)                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. SPECIFICITY        "Use 2-space indent" ✓                   │
│                        "Write good code" ✗                       │
│                                                                  │
│  2. ACTIONABILITY      "Run npm test before commit" ✓           │
│                        "The project uses React" ✗                │
│                                                                  │
│  3. CURRENCY           "Updated 2 days ago" ✓                   │
│                        "Last touched 6 months ago" ✗             │
│                                                                  │
│  4. UNIQUENESS         "New insight" ✓                           │
│                        "Duplicate of existing" ✗                 │
│                                                                  │
│  5. EVIDENCE           "git blame shows..." ✓                   │
│                        "I think maybe..." ✗                     │
│                                                                  │
│  6. RELEVANCE          "Related to current task" ✓               │
│                        "Unrelated tangential fact" ✗             │
│                                                                  │
│  7. CONCISENESS        "< 200 tokens" ✓                         │
│                        "> 500 tokens" ✗                          │
│                                                                  │
│  Score: (0-7) → PASS if ≥ 4, REJECT if < 3                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. Feature Specification

### Core Features (MVP)

| Feature | Priority | Effort | Description |
|---------|----------|--------|-------------|
| `coster init` | P0 | 1 day | Initialize .coster/ directory |
| `coster capture` | P0 | 2 days | Manual context capture |
| `coster restore` | P0 | 2 days | Generate tool-specific files |
| `coster search` | P0 | 1 day | Search memories |
| `coster sync` | P1 | 3 days | Auto-generate all exports |
| Git hooks | P1 | 2 days | Automatic capture |
| Quality gate | P1 | 2 days | 7-rule filter |
| SQLite storage | P0 | 2 days | Persistent storage |
| CLAUDE.md export | P0 | 1 day | Claude Code support |
| AGENTS.md export | P0 | 1 day | Universal support |
| .cursorrules export | P1 | 1 day | Cursor support |

### Enhanced Features (v1.1)

| Feature | Priority | Effort | Description |
|---------|----------|--------|-------------|
| MCP server | P1 | 3 days | Runtime context access |
| copilot-instructions.md | P1 | 1 day | Copilot support |
| .windsurf/rules/ | P2 | 1 day | Windsurf support |
| .codex/memory.md | P2 | 1 day | Codex CLI support |
| .clinerules | P2 | 1 day | Cline support |
| .continue/rules/ | P2 | 1 day | Continue.dev support |
| .kiro/steering/ | P2 | 1 day | Kiro support |
| Shell integration | P2 | 2 days | Bash/PowerShell hooks |
| Session recaps | P2 | 2 days | Auto-summarize sessions |
| Mistake logging | P2 | 1 day | Prevent repetition |

### Advanced Features (v2.0)

| Feature | Priority | Effort | Description |
|---------|----------|--------|-------------|
| Web dashboard | P3 | 5 days | Visual memory management |
| Team sharing | P3 | 5 days | Shared context |
| Browser extension | P3 | 10 days | Chat extraction |
| Embedding search | P3 | 3 days | Semantic search |
| Auto-learning | P3 | 5 days | Learn from accepted suggestions |
| VS Code extension | P3 | 10 days | IDE integration |

---

## 6. Implementation Roadmap

### Phase 1: Foundation (Week 1-2)

**Goal:** Core storage and CLI working

| Task | Days | Deliverable |
|------|------|-------------|
| Project setup (TypeScript, tsup, Vitest) | 1 | Working dev environment |
| SQLite storage layer | 2 | CRUD operations |
| Memory types and schemas | 1 | Type definitions |
| Quality gate (7 rules) | 2 | Quality filter |
| `coster init` command | 1 | .coster/ directory creation |
| `coster capture` command | 1 | Manual capture |
| `coster search` command | 1 | Full-text search |
| Unit tests | 1 | 80%+ coverage |

**Milestone:** `coster init` → `coster capture --text "..."` → `coster search "..."` works

### Phase 2: Export & Injection (Week 3-4)

**Goal:** Generate tool-specific files

| Task | Days | Deliverable |
|------|------|-------------|
| Token budget management | 1 | Priority algorithm |
| CLAUDE.md generator | 1 | Claude Code support |
| AGENTS.md generator | 1 | Universal support |
| .cursorrules generator | 1 | Cursor support |
| copilot-instructions.md generator | 1 | Copilot support |
| `coster restore` command | 1 | Auto-generate all |
| `coster sync` command | 1 | Watch mode |
| Integration tests | 1 | End-to-end tests |

**Milestone:** `coster sync` generates all format files

### Phase 3: Automation (Week 5-6)

**Goal:** Automatic capture and injection

| Task | Days | Deliverable |
|------|------|-------------|
| Git hooks installer | 1 | `coster hooks install` |
| Post-commit hook | 1 | Auto-capture commits |
| Post-checkout hook | 1 | Auto-capture context |
| Shell integration | 2 | Bash/PowerShell hooks |
| Session detection | 1 | Start/end detection |
| Auto-injection | 1 | Tool-specific injection |
| Error handling | 1 | Graceful failures |

**Milestone:** `coster hooks install` → automatic capture on git commits

### Phase 4: MCP & Polish (Week 7-8)

**Goal:** MCP server and production ready

| Task | Days | Deliverable |
|------|------|-------------|
| MCP server | 3 | Tools, resources, prompts |
| MCP testing | 1 | MCP test suite |
| CLI polish | 1 | Help, colors, tables |
| Documentation | 1 | README, examples |
| npm publish | 1 | Public release |
| Bug fixes | 1 | Edge cases |

**Milestone:** `coster mcp` starts MCP server, npm package published

### Phase 5: Advanced Features (Week 9-12)

**Goal:** Enhanced features and ecosystem

| Task | Days | Deliverable |
|------|------|-------------|
| Remaining tool exports | 3 | Windsurf, Codex, Cline, Continue, Kiro |
| Session recaps | 2 | Auto-summarize |
| Mistake logging | 1 | Prevent repetition |
| Web dashboard | 5 | Visual interface |
| Team sharing | 5 | Shared context |
| Browser extension | 10 | Chat extraction |

---

## 7. Risk Matrix

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Tool format changes | High | Medium | Modular export system, easy to update |
| SQLite corruption | Low | High | WAL mode, automatic backups |
| Token budget overflow | Medium | Medium | Conservative allocation, priority scoring |
| Git hook conflicts | Medium | Low | Non-invasive hooks, optional installation |
| MCP protocol changes | Low | Medium | Pin SDK version, follow spec closely |
| Platform compatibility | Medium | Medium | Test on Windows, macOS, Linux |
| Performance with large repos | Low | Medium | Lazy loading, caching, pagination |

---

## 8. Appendix: Source Citations

### Official Documentation
- Claude Code: https://docs.anthropic.com/en/docs/claude-code
- Cursor: https://docs.cursor.com
- Copilot: https://docs.github.com/copilot
- MCP: https://modelcontextprotocol.io
- AGENTS.md: https://agentsmd.dev

### Community Resources
- RuleSync: https://github.com/jpcaparas/rulesync
- memory-bank: https://github.com/ryoppippi/memory-bank
- projectmem: https://github.com/projectmem/projectmem
- kōdo: https://github.com/nicobailon/kodo
- devctx: https://github.com/devctx/devctx
- Cortex: https://github.com/TheProductionLine/cortex
- MemNexus: https://github.com/memnexus/memnexus

### Blog Posts & Articles
- "AGENTS.md vs CLAUDE.md vs Cursor Rules Comparison 2026" — codersera.com
- "AI Agent Codebase Memory Tools Comparison" — knightli.com
- "Building CLI Tools with Node.js 2026" — nazarboyko.com
- "CLI Spec for AI Agents" — clispec.dev
- "AI Agents Are Your New Users" — garbas.si

### GitHub Issues
- Skip global CLAUDE.md per-project: anthropics/claude-code#51024
- AGENTS.md native support: anthropics/claude-code#34235
- Exempt CLAUDE.md from compaction: anthropics/claude-code#44166

---

**Document Version:** 1.0
**Last Updated:** August 16, 2026
**Author:** Coster Research Team
