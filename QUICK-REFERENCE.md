# COSTER — Quick Reference

> **Implementation Phases at a Glance**

---

## Phase 1: Foundation (Week 1-2)
**Goal:** Core storage and CLI working

| Sub-Phase | Task | Days | Status |
|-----------|------|------|--------|
| 1.1 | Project scaffolding | 1 | ✅ |
| 1.2 | Type definitions | 1-2 | ✅ |
| 1.3 | SQLite storage layer | 2-3 | ✅ |
| 1.4 | Quality gate (7 rules) | 3-4 | ✅ |
| 1.5 | CLI foundation | 4-5 | ✅ |
| 1.6 | Unit tests | 5-6 | ✅ |

**Commands:** `coster init`, `coster capture`, `coster search`, `coster list`

---

## Phase 2: Export & Injection (Week 3-4)
**Goal:** Generate tool-specific files

| Sub-Phase | Task | Days | Status |
|-----------|------|------|--------|
| 2.1 | Token budget management | 1 | ✅ |
| 2.2 | Format generators (4+) | 2-4 | ✅ |
| 2.3 | Export commands | 5 | ✅ |
| 2.4 | Integration tests | 6 | ✅ |

**Commands:** `coster sync`, `coster restore`

---

## Phase 3: Automation (Week 5-6)
**Goal:** Automatic capture via git hooks

| Sub-Phase | Task | Days | Status |
|-----------|------|------|--------|
| 3.1 | Git hooks installer | 1 | ✅ |
| 3.2 | Git hook capture | 2 | ✅ |
| 3.3 | Shell integration | 3-4 | ✅ |
| 3.4 | Session detection | 5 | ✅ |
| 3.5 | Auto-injection | 6 | ✅ |

**Commands:** `coster hooks install/uninstall/status`

---

## Phase 4: MCP & Polish (Week 7-8)
**Goal:** MCP server and production ready

| Sub-Phase | Task | Days | Status |
|-----------|------|------|--------|
| 4.1 | MCP server | 1-3 | ✅ |
| 4.2 | MCP testing | 4 | ✅ |
| 4.3 | One-command bootstrap (`init --auto`) | 5 | ✅ |
| 4.4 | CLI polish & QoL commands | 6 | ✅ |
| 4.5 | Documentation | 6 | ✅ |
| 4.6 | Tests & final gate | 6 | ✅ |

**Commands:** `coster mcp`, `coster init --auto`, `coster config`, `coster status`, `coster stats`, `coster memory`

---

## Phase 5: Advanced Features (Week 9-12)
**Goal:** Ecosystem expansion

| Sub-Phase | Task | Days | Status |
|-----------|------|------|--------|
| 5.1 | Remaining tool exports | 1-3 | ⏳ |
| 5.2 | Session recaps | 4-5 | ⏳ |
| 5.3 | Mistake logging | 6 | ⏳ |
| 5.4 | Web dashboard | 7-11 | ⏳ |
| 5.5 | Team sharing | 12-16 | ⏳ |

---

## Supported Tools (12+)

| Tool | Export File | Priority |
|------|-------------|----------|
| Claude Code | CLAUDE.md | P0 |
| Cursor | .cursorrules | P1 |
| Copilot | .github/copilot-instructions.md | P1 |
| OpenCode | AGENTS.md | P0 |
| Windsurf | .windsurf/rules/ | P2 |
| Codex CLI | .codex/memory.md | P2 |
| Cline | .clinerules | P2 |
| Continue.dev | .continue/rules/ | P2 |
| Kiro | .kiro/steering/ | P2 |
| Gemini CLI | GEMINI.md | P2 |
| Sourcegraph Cody | .cody/ | P3 |
| Amazon Q | .amazonq/rules/ | P3 |

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| Language | TypeScript 5.5+ |
| Runtime | Node.js 18+ |
| Build | tsup (CJS + ESM, no node-gyp) |
| CLI | Commander.js |
| Storage | SQLite (sql.js, in-process WASM — zero native deps) |
| MCP | @modelcontextprotocol/sdk |
| Testing | Vitest |
| Distribution | npm (local install) + docs |

---

## Key Metrics

| Metric | Target |
|--------|--------|
| Time to first context restore | < 30 seconds |
| Tool integrations | 12+ at launch |
| Memory quality score | > 85% relevance |
| Zero-config usage | Works with `coster init` |
| Offline operation | 100% core features |
| Test coverage | > 80% |
| Bundle size | < 500KB |
| CLI startup time | < 100ms |

---

## Quality Gate (7 Rules)

| # | Rule | Description |
|---|------|-------------|
| 1 | Specificity | Must be specific to this project |
| 2 | Actionability | Must be actionable |
| 3 | Currency | Must be current |
| 4 | Uniqueness | Not a duplicate |
| 5 | Evidence | Must have evidence |
| 6 | Relevance | Must be relevant |
| 7 | Conciseness | Must be < 200 tokens |

**Score:** ≥ 4/7 → PASS | < 3/7 → REJECT

---

## Memory Categories & TTL

| Category | TTL | Cleanup |
|----------|-----|---------|
| Preference | Permanent | Never |
| Convention | Long-lived | Manual |
| Decision | Permanent | Never |
| Investigation | 90 days | Auto |
| Workaround | 90 days | Auto |
| Recap | 30 days | Auto |
| Mistake | Permanent | Never |

---

## Quick Commands

```bash
# One-command bootstrap (detect tool, install hooks, sync, backfill from git)
coster init --auto

# Initialize
coster init

# Capture
coster capture --text "Use 2-space indent" --category convention

# Search (records access, powers stats)
coster search "indentation"

# List
coster list --category convention

# Sync
coster sync --tool claude

# Restore
coster restore --tool cursor

# Manage memories
coster memory add -c decision -t "Use feature flags" --tags release
coster memory list --json
coster memory show <id>
coster memory edit <id> -t "updated"
coster memory delete <id>

# Inspect
coster status
coster stats
coster config get quality.minScore
coster config set quality.minScore 6

# Hooks
coster hooks install

# MCP
coster mcp
```

---

**Full Plan:** See `IMPLEMENTATION-PLAN.md`
**Masterplan:** See `COSTER-MASTERPLAN.md`
