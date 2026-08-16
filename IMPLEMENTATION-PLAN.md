# COSTER — Detailed Implementation Plan

> **Phase-Wise Breakdown with Sub-Planning**
> Version: 1.0 | Date: August 16, 2026

---

## Table of Contents

1. [Implementation Overview](#1-implementation-overview)
2. [Phase 1: Foundation (Week 1-2)](#2-phase-1-foundation-week-1-2)
3. [Phase 2: Export & Injection (Week 3-4)](#3-phase-2-export--injection-week-3-4)
4. [Phase 3: Automation (Week 5-6)](#4-phase-3-automation-week-5-6)
5. [Phase 4: MCP & Polish (Week 7-8)](#5-phase-4-mcp--polish-week-7-8)
6. [Phase 5: Advanced Features (Week 9-12)](#6-phase-5-advanced-features-week-9-12)
7. [Dependency Matrix](#7-dependency-matrix)
8. [Success Criteria](#8-success-criteria)

---

> **Note — Deviations from this plan (as implemented):**
> - **Package manager:** `npm` is used (not `pnpm`).
> - **Storage:** `sql.js` (in-process WASM SQLite) instead of `better-sqlite3`. This avoids
>   any native/`node-gyp` build step and keeps the project dependency-light.
> - **Search:** simple substring/`LIKE` matching over memory content (no FTS5 virtual table).
> - **Phase 4 status:** MCP server (`coster mcp`), one-command bootstrap (`coster init --auto`),
>   and QoL commands (`config`, `status`, `stats`, `memory`) are implemented. All phases 1–4
>   are complete. See `QUICK-REFERENCE.md` for current status.

## 1. Implementation Overview

### Development Environment Setup

**Prerequisites:**
- Node.js 18+ (LTS)
- npm 9+ (package manager)
- Git 2.30+
- TypeScript 5.5+

**Project Initialization:**
```bash
# Create project directory
mkdir coster && cd coster

# Initialize with npm
npm init -y

# Install core dependencies
npm add commander.js sql.js @modelcontextprotocol/sdk zod

# Install dev dependencies
npm add -D typescript tsup vitest @types/node

# Initialize TypeScript
tsc --init

# Configure tsup
echo 'import { defineConfig } from "tsup";
export default defineConfig({
  entry: ["src/cli/index.ts"],
  format: ["cjs", "esm"],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
});' > tsup.config.ts
```

**Directory Structure:**
```
coster/
├── bin/
│   └── cli.js              # CLI entry point (hashbang)
├── src/
│   ├── index.ts            # Root exports
│   ├── cli/                # CLI layer
│   ├── core/               # Business logic
│   ├── capture/            # Context capture
│   ├── inject/             # Format generators
│   ├── mcp/                # MCP server
│   └── types/              # Type definitions
├── tests/
│   ├── unit/
│   ├── integration/
│   └── fixtures/
├── package.json
├── tsconfig.json
├── tsup.config.ts
└── vitest.config.ts
```

---

## 2. Phase 1: Foundation (Week 1-2)

### Goal
Core storage and CLI working with basic capture, search, and quality gate.

### Sub-Phase 1.1: Project Scaffolding (Day 1)

**Tasks:**
1. Initialize project with pnpm
2. Configure TypeScript (`tsconfig.json`)
3. Configure tsup (`tsup.config.ts`)
4. Configure Vitest (`vitest.config.ts`)
5. Set up ESLint + Prettier
6. Create directory structure
7. Set up Git hooks (husky + lint-staged)
8. Create `.gitignore`

**Deliverables:**
- Working dev environment
- `pnpm dev` runs CLI in watch mode
- `pnpm test` runs test suite
- `pnpm build` generates dist/

**Success Criteria:**
- [ ] `pnpm dev -- --help` shows CLI help
- [ ] `pnpm test` passes with 0 failures
- [ ] `pnpm build` generates both CJS and ESM outputs

---

### Sub-Phase 1.2: Type Definitions (Day 1-2)

**Tasks:**
1. Define core types in `src/types/`

```typescript
// src/types/memory.ts
export interface Memory {
  id: string;
  category: MemoryCategory;
  content: string;
  importance: number; // 0-1
  createdAt: string;
  updatedAt: string;
  accessedAt: string;
  accessCount: number;
  tags: string[];
  source: 'git-hook' | 'shell-hook' | 'manual' | 'auto';
  metadata?: Record<string, unknown>;
}

export type MemoryCategory = 
  | 'preference'      // User preferences (permanent)
  | 'convention'      // Project conventions (long-lived)
  | 'decision'        // Architectural decisions (permanent)
  | 'investigation'   // Active investigations (until resolved)
  | 'workaround'      // Bug workarounds (until fixed)
  | 'recap'           // Session summaries (30-day TTL)
  | 'mistake';        // Mistake log (permanent)

// src/types/context.ts
export interface ProjectContext {
  path: string;
  name: string;
  stack: StackInfo;
  memories: Memory[];
  sessions: Session[];
  lastUpdated: string;
}

export interface StackInfo {
  language: string;
  framework: string;
  buildSystem: string;
  packageManager: string;
  testFramework: string;
}

export interface Session {
  id: string;
  startedAt: string;
  endedAt?: string;
  summary?: string;
  filesChanged: string[];
  decisionsMade: string[];
}

// src/types/config.ts
export interface CosterConfig {
  version: number;
  project: {
    name: string;
    path: string;
  };
  tools: ToolConfig[];
  quality: QualityConfig;
  lifecycle: LifecycleConfig;
}

export interface ToolConfig {
  name: string;
  enabled: boolean;
  exportPath: string;
  tokenBudget: number;
}

export interface QualityConfig {
  minScore: number; // 0-7
  maxTokens: number;
  autoCleanup: boolean;
}

export interface LifecycleConfig {
  recapTTL: number; // days
  investigationTTL: number; // days
  workaroundTTL: number; // days
  autoArchive: boolean;
}
```

**Deliverables:**
- Complete type definitions
- Type guards and utility types
- Zod schemas for validation

**Success Criteria:**
- [ ] All types compile without errors
- [ ] Zod schemas validate test data
- [ ] No `any` types in core modules

---

### Sub-Phase 1.3: SQLite Storage Layer (Day 2-3)

**Tasks:**
1. Create `src/core/storage.ts`
2. Implement SQLite schema creation
3. Implement CRUD operations
4. Implement FTS5 search
5. Add WAL mode for performance
6. Add automatic backups

```typescript
// src/core/storage.ts
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

export class Storage {
  private db: Database.Database;
  private dbPath: string;

  constructor(projectPath: string) {
    this.dbPath = path.join(projectPath, '.coster', 'coster.db');
    this.ensureDirectory();
    this.db = new Database(this.dbPath);
    this.initialize();
  }

  private ensureDirectory(): void {
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private initialize(): void {
    // Enable WAL mode
    this.db.pragma('journal_mode = WAL');
    
    // Create tables
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        category TEXT NOT NULL,
        content TEXT NOT NULL,
        importance REAL DEFAULT 0.5,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        accessed_at TEXT NOT NULL,
        access_count INTEGER DEFAULT 0,
        tags TEXT DEFAULT '[]',
        source TEXT NOT NULL,
        metadata TEXT DEFAULT '{}'
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        started_at TEXT NOT NULL,
        ended_at TEXT,
        summary TEXT,
        files_changed TEXT DEFAULT '[]',
        decisions_made TEXT DEFAULT '[]'
      );

      CREATE TABLE IF NOT EXISTS config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      -- Full-text search
      CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
        content,
        category,
        tags,
        content=memories,
        content_rowid=rowid
      );

      -- Triggers for FTS sync
      CREATE TRIGGER IF NOT EXISTS memories_ai AFTER INSERT ON memories BEGIN
        INSERT INTO memories_fts(rowid, content, category, tags)
        VALUES (new.rowid, new.content, new.category, new.tags);
      END;

      CREATE TRIGGER IF NOT EXISTS memories_ad AFTER DELETE ON memories BEGIN
        INSERT INTO memories_fts(memories_fts, rowid, content, category, tags)
        VALUES('delete', old.rowid, old.content, old.category, old.tags);
      END;

      CREATE TRIGGER IF NOT EXISTS memories_au AFTER UPDATE ON memories BEGIN
        INSERT INTO memories_fts(memories_fts, rowid, content, category, tags)
        VALUES('delete', old.rowid, old.content, old.category, old.tags);
        INSERT INTO memories_fts(rowid, content, category, tags)
        VALUES (new.rowid, new.content, new.category, new.tags);
      END;
    `);
  }

  // CRUD operations
  createMemory(memory: Omit<Memory, 'id'>): Memory { ... }
  getMemory(id: string): Memory | null { ... }
  updateMemory(id: string, updates: Partial<Memory>): Memory { ... }
  deleteMemory(id: string): boolean { ... }
  
  // Search
  searchMemories(query: string, category?: MemoryCategory): Memory[] { ... }
  
  // Lifecycle
  getExpiredMemories(): Memory[] { ... }
  archiveMemories(ids: string[]): void { ... }
  
  // Backup
  backup(): string { ... }
  
  // Close
  close(): void { ... }
}
```

**Deliverables:**
- SQLite storage class
- CRUD operations for memories and sessions
- FTS5 search functionality
- WAL mode enabled
- Automatic backup on schema migration

**Success Criteria:**
- [ ] Can create, read, update, delete memories
- [ ] FTS5 search returns relevant results
- [ ] WAL mode improves write performance
- [ ] Backup creates valid SQLite file

---

### Sub-Phase 1.4: Quality Gate (Day 3-4)

**Tasks:**
1. Create `src/core/quality.ts`
2. Implement 7-rule quality gate
3. Implement scoring algorithm
4. Add deduplication check

```typescript
// src/core/quality.ts
import { Memory } from '../types';

export interface QualityResult {
  score: number; // 0-7
  passed: boolean;
  reasons: string[];
}

export class QualityGate {
  private minScore: number;

  constructor(minScore: number = 4) {
    this.minScore = minScore;
  }

  evaluate(memory: Memory, existingMemories: Memory[]): QualityResult {
    const reasons: string[] = [];
    let score = 0;

    // Rule 1: Specificity (0-1)
    if (this.checkSpecificity(memory.content)) {
      score += 1;
      reasons.push('Specific to project');
    } else {
      reasons.push('Too generic');
    }

    // Rule 2: Actionability (0-1)
    if (this.checkActionability(memory.content)) {
      score += 1;
      reasons.push('Actionable');
    } else {
      reasons.push('Not actionable');
    }

    // Rule 3: Currency (0-1)
    if (this.checkCurrency(memory.updatedAt)) {
      score += 1;
      reasons.push('Current');
    } else {
      reasons.push('Outdated');
    }

    // Rule 4: Uniqueness (0-1)
    if (this.checkUniqueness(memory, existingMemories)) {
      score += 1;
      reasons.push('Unique');
    } else {
      reasons.push('Duplicate');
    }

    // Rule 5: Evidence (0-1)
    if (this.checkEvidence(memory)) {
      score += 1;
      reasons.push('Has evidence');
    } else {
      reasons.push('No evidence');
    }

    // Rule 6: Relevance (0-1)
    if (this.checkRelevance(memory)) {
      score += 1;
      reasons.push('Relevant');
    } else {
      reasons.push('Not relevant');
    }

    // Rule 7: Conciseness (0-1)
    if (this.checkConciseness(memory.content)) {
      score += 1;
      reasons.push('Concise');
    } else {
      reasons.push('Too verbose');
    }

    return {
      score,
      passed: score >= this.minScore,
      reasons,
    };
  }

  private checkSpecificity(content: string): boolean {
    // Check for project-specific terms, file paths, etc.
    const genericPhrases = ['good code', 'best practices', 'write better'];
    return !genericPhrases.some(phrase => 
      content.toLowerCase().includes(phrase)
    );
  }

  private checkActionability(content: string): boolean {
    // Check for actionable language
    const actionVerbs = ['run', 'use', 'prefer', 'avoid', 'check', 'update'];
    return actionVerbs.some(verb => 
      content.toLowerCase().includes(verb)
    );
  }

  private checkCurrency(updatedAt: string): boolean {
    // Check if updated within last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return new Date(updatedAt) > thirtyDaysAgo;
  }

  private checkUniqueness(memory: Memory, existing: Memory[]): boolean {
    // Simple similarity check
    return !existing.some(e => 
      this.calculateSimilarity(memory.content, e.content) > 0.8
    );
  }

  private checkEvidence(memory: Memory): boolean {
    // Check for evidence markers
    const evidenceMarkers = ['git blame', 'file:', 'commit', 'issue #'];
    return evidenceMarkers.some(marker => 
      memory.content.toLowerCase().includes(marker)
    ) || memory.source === 'git-hook';
  }

  private checkRelevance(memory: Memory): boolean {
    // For now, check category relevance
    const relevantCategories = ['decision', 'workaround', 'investigation'];
    return relevantCategories.includes(memory.category);
  }

  private checkConciseness(content: string): boolean {
    // Check token count (approximate)
    const tokenCount = content.split(/\s+/).length;
    return tokenCount <= 200;
  }

  private calculateSimilarity(a: string, b: string): number {
    // Simple Jaccard similarity
    const setA = new Set(a.toLowerCase().split(/\s+/));
    const setB = new Set(b.toLowerCase().split(/\s+/));
    const intersection = new Set([...setA].filter(x => setB.has(x)));
    const union = new Set([...setA, ...setB]);
    return intersection.size / union.size;
  }
}
```

**Deliverables:**
- Quality gate class
- 7-rule evaluation system
- Scoring algorithm (0-7)
- Deduplication check

**Success Criteria:**
- [ ] Quality gate evaluates all 7 rules
- [ ] Scoring is consistent and deterministic
- [ ] Deduplication prevents duplicate memories
- [ ] Pass/fail threshold is configurable

---

### Sub-Phase 1.5: CLI Foundation (Day 4-5)

**Tasks:**
1. Create `src/cli/index.ts`
2. Implement Commander.js setup
3. Add `init` command
4. Add `capture` command
5. Add `search` command
6. Add `list` command

```typescript
// src/cli/index.ts
#!/usr/bin/env node
import { Command } from 'commander';
import { initCommand } from './commands/init';
import { captureCommand } from './commands/capture';
import { searchCommand } from './commands/search';
import { listCommand } from './commands/list';

const program = new Command();

program
  .name('coster')
  .description('Universal context persistence layer for AI coding assistants')
  .version('1.0.0');

// Add commands
initCommand(program);
captureCommand(program);
searchCommand(program);
listCommand(program);

program.parse();
```

```typescript
// src/cli/commands/init.ts
import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';

export function initCommand(program: Command): void {
  program
    .command('init')
    .description('Initialize Coster in the current project')
    .option('-f, --force', 'Force initialization (overwrite existing)')
    .action(async (options) => {
      const spinner = ora('Initializing Coster...').start();

      try {
        const projectPath = process.cwd();
        const costerDir = path.join(projectPath, '.coster');

        // Check if already initialized
        if (fs.existsSync(costerDir) && !options.force) {
          spinner.fail('Coster already initialized. Use --force to overwrite.');
          return;
        }

        // Create directory structure
        fs.mkdirSync(path.join(costerDir, 'memories'), { recursive: true });
        fs.mkdirSync(path.join(costerDir, 'sessions'), { recursive: true });
        fs.mkdirSync(path.join(costerDir, 'exports'), { recursive: true });
        fs.mkdirSync(path.join(costerDir, 'hooks'), { recursive: true });
        fs.mkdirSync(path.join(costerDir, 'cache'), { recursive: true });

        // Create config file
        const config = {
          version: 1,
          created_at: new Date().toISOString(),
          project: {
            name: path.basename(projectPath),
            path: projectPath,
          },
          tools: [
            { name: 'claude-code', enabled: true, exportPath: 'CLAUDE.md', tokenBudget: 17000 },
            { name: 'cursor', enabled: true, exportPath: '.cursorrules', tokenBudget: 12000 },
            { name: 'copilot', enabled: true, exportPath: '.github/copilot-instructions.md', tokenBudget: 8000 },
            { name: 'opencode', enabled: true, exportPath: 'AGENTS.md', tokenBudget: 15000 },
          ],
          quality: {
            minScore: 4,
            maxTokens: 200,
            autoCleanup: true,
          },
          lifecycle: {
            recapTTL: 30,
            investigationTTL: 90,
            workaroundTTL: 90,
            autoArchive: true,
          },
        };

        fs.writeFileSync(
          path.join(costerDir, 'config.json'),
          JSON.stringify(config, null, 2)
        );

        // Create schema file
        const schema = {
          version: 1,
          created_at: new Date().toISOString(),
          features: ['mcp', 'hooks', 'quality_gate'],
        };

        fs.writeFileSync(
          path.join(costerDir, 'schema.json'),
          JSON.stringify(schema, null, 2)
        );

        spinner.succeed(chalk.green('Coster initialized successfully!'));
        console.log(chalk.cyan('\nNext steps:'));
        console.log('  1. Run `coster capture --text "Your first memory"`');
        console.log('  2. Run `coster search "query"` to search memories');
        console.log('  3. Run `coster sync` to generate tool-specific files');

      } catch (error) {
        spinner.fail(chalk.red('Failed to initialize Coster'));
        console.error(error);
      }
    });
}
```

```typescript
// src/cli/commands/capture.ts
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { Storage } from '../../core/storage';
import { QualityGate } from '../../core/quality';
import { Memory, MemoryCategory } from '../../types';

export function captureCommand(program: Command): void {
  program
    .command('capture')
    .description('Capture a new memory/context')
    .requiredOption('-t, --text <text>', 'Memory content')
    .option('-c, --category <category>', 'Memory category', 'convention')
    .option('-i, --importance <importance>', 'Importance score (0-1)', '0.5')
    .option('-s, --source <source>', 'Memory source', 'manual')
    .option('--tags <tags>', 'Comma-separated tags', '')
    .action(async (options) => {
      const spinner = ora('Capturing memory...').start();

      try {
        const storage = new Storage(process.cwd());
        const qualityGate = new QualityGate();

        // Create memory object
        const memory: Omit<Memory, 'id'> = {
          category: options.category as MemoryCategory,
          content: options.text,
          importance: parseFloat(options.importance),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          accessedAt: new Date().toISOString(),
          accessCount: 0,
          tags: options.tags ? options.tags.split(',').map((t: string) => t.trim()) : [],
          source: options.source as Memory['source'],
        };

        // Evaluate quality
        const existingMemories = storage.getAllMemories();
        const qualityResult = qualityGate.evaluate(
          { ...memory, id: 'temp' } as Memory,
          existingMemories
        );

        if (!qualityResult.passed) {
          spinner.fail(chalk.red('Memory rejected by quality gate'));
          console.log(chalk.yellow('Score:', qualityResult.score, '/ 7'));
          console.log(chalk.gray('Reasons:', qualityResult.reasons.join(', ')));
          storage.close();
          return;
        }

        // Store memory
        const stored = storage.createMemory(memory);
        spinner.succeed(chalk.green('Memory captured successfully!'));
        console.log(chalk.cyan('ID:', stored.id));
        console.log(chalk.cyan('Score:', qualityResult.score, '/ 7'));

        storage.close();

      } catch (error) {
        spinner.fail(chalk.red('Failed to capture memory'));
        console.error(error);
      }
    });
}
```

```typescript
// src/cli/commands/search.ts
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import cliTable from 'cli-table3';
import { Storage } from '../../core/storage';

export function searchCommand(program: Command): void {
  program
    .command('search')
    .description('Search memories')
    .requiredArgument('query', 'Search query')
    .option('-c, --category <category>', 'Filter by category')
    .option('-l, --limit <limit>', 'Max results', '10')
    .action(async (query, options) => {
      const spinner = ora('Searching memories...').start();

      try {
        const storage = new Storage(process.cwd());
        const results = storage.searchMemories(query, options.category);

        spinner.stop();

        if (results.length === 0) {
          console.log(chalk.yellow('No memories found.'));
          storage.close();
          return;
        }

        // Display results
        const table = new cliTable({
          head: ['ID', 'Category', 'Content', 'Score', 'Updated'],
          colWidths: [8, 12, 40, 6, 12],
        });

        results.slice(0, parseInt(options.limit)).forEach(memory => {
          table.push([
            memory.id.substring(0, 8),
            memory.category,
            memory.content.substring(0, 37) + '...',
            memory.importance.toFixed(1),
            memory.updatedAt.substring(0, 10),
          ]);
        });

        console.log(table.toString());
        console.log(chalk.gray(`\n${results.length} results found.`));

        storage.close();

      } catch (error) {
        spinner.fail(chalk.red('Failed to search memories'));
        console.error(error);
      }
    });
}
```

```typescript
// src/cli/commands/list.ts
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import cliTable from 'cli-table3';
import { Storage } from '../../core/storage';

export function listCommand(program: Command): void {
  program
    .command('list')
    .description('List all memories')
    .option('-c, --category <category>', 'Filter by category')
    .option('-l, --limit <limit>', 'Max results', '20')
    .action(async (options) => {
      const spinner = ora('Listing memories...').start();

      try {
        const storage = new Storage(process.cwd());
        const memories = storage.getAllMemories(options.category);

        spinner.stop();

        if (memories.length === 0) {
          console.log(chalk.yellow('No memories found.'));
          storage.close();
          return;
        }

        // Display results
        const table = new cliTable({
          head: ['ID', 'Category', 'Content', 'Score', 'Source', 'Updated'],
          colWidths: [8, 12, 35, 6, 10, 12],
        });

        memories.slice(0, parseInt(options.limit)).forEach(memory => {
          table.push([
            memory.id.substring(0, 8),
            memory.category,
            memory.content.substring(0, 32) + '...',
            memory.importance.toFixed(1),
            memory.source,
            memory.updatedAt.substring(0, 10),
          ]);
        });

        console.log(table.toString());
        console.log(chalk.gray(`\n${memories.length} total memories.`));

        storage.close();

      } catch (error) {
        spinner.fail(chalk.red('Failed to list memories'));
        console.error(error);
      }
    });
}
```

**Deliverables:**
- CLI entry point with Commander.js
- `init` command with directory creation
- `capture` command with quality gate
- `search` command with FTS5
- `list` command with filtering

**Success Criteria:**
- [ ] `coster init` creates .coster/ directory
- [ ] `coster capture --text "..."` stores memory
- [ ] `coster search "query"` returns results
- [ ] `coster list` shows all memories
- [ ] Quality gate rejects low-quality memories

---

### Sub-Phase 1.6: Unit Tests (Day 5-6)

**Tasks:**
1. Create test fixtures
2. Write storage tests
3. Write quality gate tests
4. Write CLI command tests

```typescript
// tests/unit/storage.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Storage } from '../../src/core/storage';
import fs from 'fs';
import path from 'path';

describe('Storage', () => {
  let storage: Storage;
  const testDir = path.join(__dirname, '../fixtures/test-project');

  beforeEach(() => {
    // Create test directory
    fs.mkdirSync(testDir, { recursive: true });
    fs.mkdirSync(path.join(testDir, '.coster'), { recursive: true });
    storage = new Storage(testDir);
  });

  afterEach(() => {
    storage.close();
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('should create a memory', () => {
    const memory = storage.createMemory({
      category: 'convention',
      content: 'Use 2-space indentation',
      importance: 0.8,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      accessedAt: new Date().toISOString(),
      accessCount: 0,
      tags: ['style', 'indentation'],
      source: 'manual',
    });

    expect(memory).toBeDefined();
    expect(memory.id).toBeDefined();
    expect(memory.content).toBe('Use 2-space indentation');
  });

  it('should search memories', () => {
    storage.createMemory({
      category: 'convention',
      content: 'Use TypeScript strict mode',
      importance: 0.9,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      accessedAt: new Date().toISOString(),
      accessCount: 0,
      tags: ['typescript'],
      source: 'manual',
    });

    const results = storage.searchMemories('TypeScript');
    expect(results).toHaveLength(1);
    expect(results[0].content).toContain('TypeScript');
  });
});
```

```typescript
// tests/unit/quality.test.ts
import { describe, it, expect } from 'vitest';
import { QualityGate } from '../../src/core/quality';
import { Memory } from '../../src/types';

describe('QualityGate', () => {
  const qualityGate = new QualityGate(4);

  it('should pass high-quality memory', () => {
    const memory: Memory = {
      id: '1',
      category: 'decision',
      content: 'Chose PostgreSQL over MySQL for better JSON support. git blame shows commit abc123.',
      importance: 0.9,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      accessedAt: new Date().toISOString(),
      accessCount: 10,
      tags: ['database', 'decision'],
      source: 'git-hook',
    };

    const result = qualityGate.evaluate(memory, []);
    expect(result.passed).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(4);
  });

  it('should reject low-quality memory', () => {
    const memory: Memory = {
      id: '2',
      category: 'preference',
      content: 'Write good code',
      importance: 0.1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      accessedAt: new Date().toISOString(),
      accessCount: 0,
      tags: [],
      source: 'manual',
    };

    const result = qualityGate.evaluate(memory, []);
    expect(result.passed).toBe(false);
    expect(result.score).toBeLessThan(4);
  });
});
```

**Deliverables:**
- Test fixtures for storage
- Storage unit tests
- Quality gate unit tests
- CLI command tests

**Success Criteria:**
- [ ] All unit tests pass
- [ ] Test coverage > 80%
- [ ] No flaky tests
- [ ] Tests run in < 5 seconds

---

### Phase 1 Milestone

**Deliverables:**
- [x] Project scaffolding complete
- [x] Type definitions in place
- [x] SQLite storage with FTS5
- [x] Quality gate (7 rules)
- [x] CLI with init, capture, search, list
- [x] Unit tests passing

**Verification:**
```bash
# Initialize
coster init

# Capture memory
coster capture --text "Use 2-space indentation" --category convention --importance 0.8

# Search
coster search "indentation"

# List
coster list

# Run tests
pnpm test
```

---

## 3. Phase 2: Export & Injection (Week 3-4)

### Goal
Generate tool-specific files for all supported AI coding tools.

### Sub-Phase 2.1: Token Budget Management (Day 1)

**Tasks:**
1. Create `src/inject/priority.ts`
2. Implement token estimation
3. Implement prioritization algorithm
4. Add budget constraints

```typescript
// src/inject/priority.ts
import { Memory } from '../types';

export interface PrioritizedMemory {
  memory: Memory;
  score: number;
  tokens: number;
}

export class TokenBudget {
  private budget: number;

  constructor(budget: number) {
    this.budget = budget;
  }

  estimateTokens(content: string): number {
    // Rough estimation: 1 token ≈ 4 characters
    return Math.ceil(content.length / 4);
  }

  prioritize(memories: Memory[]): PrioritizedMemory[] {
    const prioritized = memories
      .map(memory => ({
        memory,
        score: this.calculateScore(memory),
        tokens: this.estimateTokens(memory.content),
      }))
      .sort((a, b) => b.score - a.score);

    // Apply budget constraint
    let totalTokens = 0;
    const result: PrioritizedMemory[] = [];

    for (const item of prioritized) {
      if (totalTokens + item.tokens <= this.budget) {
        result.push(item);
        totalTokens += item.tokens;
      }
    }

    return result;
  }

  private calculateScore(memory: Memory): number {
    // Weighted scoring algorithm
    const importanceWeight = 0.4;
    const accessWeight = 0.2;
    const recencyWeight = 0.2;
    const categoryWeight = 0.2;

    // Importance score (0-1)
    const importanceScore = memory.importance;

    // Access count score (0-1, normalized)
    const accessScore = Math.min(memory.accessCount / 100, 1);

    // Recency score (0-1, based on last 30 days)
    const daysSinceUpdate = Math.floor(
      (Date.now() - new Date(memory.updatedAt).getTime()) / (1000 * 60 * 60 * 24)
    );
    const recencyScore = Math.max(0, 1 - daysSinceUpdate / 30);

    // Category score (0-1)
    const categoryScores: Record<string, number> = {
      decision: 1.0,
      workaround: 0.9,
      investigation: 0.8,
      convention: 0.7,
      preference: 0.6,
      recap: 0.5,
      mistake: 0.4,
    };
    const categoryScore = categoryScores[memory.category] || 0.5;

    // Calculate final score
    return (
      importanceScore * importanceWeight +
      accessScore * accessWeight +
      recencyScore * recencyWeight +
      categoryScore * categoryWeight
    );
  }
}
```

**Deliverables:**
- Token budget class
- Token estimation function
- Prioritization algorithm
- Budget constraint logic

**Success Criteria:**
- [ ] Token estimation is within 20% accuracy
- [ ] Prioritization respects budget limits
- [ ] Higher-scoring memories are included first

---

### Sub-Phase 2.2: Format Generators (Day 2-4)

**Tasks:**
1. Create `src/inject/claude.ts` - CLAUDE.md generator
2. Create `src/inject/agents.ts` - AGENTS.md generator
3. Create `src/inject/cursor.ts` - .cursorrules generator
4. Create `src/inject/copilot.ts` - copilot-instructions.md generator
5. Create `src/inject/windsurf.ts` - .windsurf/rules/ generator
6. Create `src/inject/codex.ts` - .codex/memory.md generator
7. Create `src/inject/cline.ts` - .clinerules generator
8. Create `src/inject/continue.ts` - .continue/rules/ generator
9. Create `src/inject/kiro.ts` - .kiro/steering/ generator

```typescript
// src/inject/claude.ts
import { Memory, ProjectContext } from '../types';
import { TokenBudget, PrioritizedMemory } from './priority';

export class ClaudeGenerator {
  private budget: TokenBudget;

  constructor(tokenBudget: number = 17000) {
    this.budget = new TokenBudget(tokenBudget);
  }

  generate(context: ProjectContext): string {
    const prioritized = this.budget.prioritize(context.memories);
    
    let content = `# ${context.name}\n\n`;
    
    // Project overview
    content += `## Project Overview\n`;
    content += `- Language: ${context.stack.language}\n`;
    content += `- Framework: ${context.stack.framework}\n`;
    content += `- Build System: ${context.stack.buildSystem}\n`;
    content += `- Package Manager: ${context.stack.packageManager}\n\n`;

    // Group memories by category
    const grouped = this.groupByCategory(prioritized);

    // Decisions
    if (grouped.decision && grouped.decision.length > 0) {
      content += `## Architecture Decisions\n`;
      grouped.decision.forEach(m => {
        content += `- ${m.memory.content}\n`;
      });
      content += '\n';
    }

    // Conventions
    if (grouped.convention && grouped.convention.length > 0) {
      content += `## Coding Conventions\n`;
      grouped.convention.forEach(m => {
        content += `- ${m.memory.content}\n`;
      });
      content += '\n';
    }

    // Workarounds
    if (grouped.workaround && grouped.workaround.length > 0) {
      content += `## Known Workarounds\n`;
      grouped.workaround.forEach(m => {
        content += `- ${m.memory.content}\n`;
      });
      content += '\n';
    }

    // Investigations
    if (grouped.investigation && grouped.investigation.length > 0) {
      content += `## Active Investigations\n`;
      grouped.investigation.forEach(m => {
        content += `- ${m.memory.content}\n`;
      });
      content += '\n';
    }

    // Preferences
    if (grouped.preference && grouped.preference.length > 0) {
      content += `## Preferences\n`;
      grouped.preference.forEach(m => {
        content += `- ${m.memory.content}\n`;
      });
      content += '\n';
    }

    // Mistakes
    if (grouped.mistake && grouped.mistake.length > 0) {
      content += `## Known Mistakes to Avoid\n`;
      grouped.mistake.forEach(m => {
        content += `- ${m.memory.content}\n`;
      });
      content += '\n';
    }

    return content;
  }

  private groupByCategory(memories: PrioritizedMemory[]): Record<string, PrioritizedMemory[]> {
    return memories.reduce((acc, m) => {
      if (!acc[m.memory.category]) {
        acc[m.memory.category] = [];
      }
      acc[m.memory.category].push(m);
      return acc;
    }, {} as Record<string, PrioritizedMemory[]>);
  }
}
```

```typescript
// src/inject/agents.ts
import { Memory, ProjectContext } from '../types';
import { TokenBudget, PrioritizedMemory } from './priority';

export class AgentsGenerator {
  private budget: TokenBudget;

  constructor(tokenBudget: number = 15000) {
    this.budget = new TokenBudget(tokenBudget);
  }

  generate(context: ProjectContext): string {
    const prioritized = this.budget.prioritize(context.memories);
    
    let content = `# AGENTS.md\n\n`;
    
    // Project overview
    content += `## Project Overview\n`;
    content += `This is a ${context.stack.language} project using ${context.stack.framework}.\n\n`;

    // Setup instructions
    content += `## Setup\n`;
    content += `- Install dependencies: \`${this.getInstallCommand(context.stack.packageManager)}\`\n`;
    content += `- Run dev server: \`${this.getDevCommand(context.stack.packageManager)}\`\n`;
    content += `- Run tests: \`${this.getTestCommand(context.stack.packageManager)}\`\n\n`;

    // Code style
    content += `## Code Style\n`;
    const conventions = prioritized.filter(m => m.memory.category === 'convention');
    conventions.forEach(m => {
      content += `- ${m.memory.content}\n`;
    });
    content += '\n';

    // Architecture
    content += `## Architecture\n`;
    const decisions = prioritized.filter(m => m.memory.category === 'decision');
    decisions.forEach(m => {
      content += `- ${m.memory.content}\n`;
    });
    content += '\n';

    // Important notes
    content += `## Important Notes\n`;
    const workarounds = prioritized.filter(m => m.memory.category === 'workaround');
    workarounds.forEach(m => {
      content += `- ⚠️ ${m.memory.content}\n`;
    });
    content += '\n';

    return content;
  }

  private getInstallCommand(packageManager: string): string {
    const commands: Record<string, string> = {
      npm: 'npm install',
      pnpm: 'pnpm install',
      yarn: 'yarn install',
      bun: 'bun install',
    };
    return commands[packageManager] || 'npm install';
  }

  private getDevCommand(packageManager: string): string {
    const commands: Record<string, string> = {
      npm: 'npm run dev',
      pnpm: 'pnpm dev',
      yarn: 'yarn dev',
      bun: 'bun dev',
    };
    return commands[packageManager] || 'npm run dev';
  }

  private getTestCommand(packageManager: string): string {
    const commands: Record<string, string> = {
      npm: 'npm test',
      pnpm: 'pnpm test',
      yarn: 'yarn test',
      bun: 'bun test',
    };
    return commands[packageManager] || 'npm test';
  }
}
```

```typescript
// src/inject/cursor.ts
import { Memory, ProjectContext } from '../types';
import { TokenBudget, PrioritizedMemory } from './priority';

export class CursorGenerator {
  private budget: TokenBudget;

  constructor(tokenBudget: number = 12000) {
    this.budget = new TokenBudget(tokenBudget);
  }

  generate(context: ProjectContext): string {
    const prioritized = this.budget.prioritize(context.memories);
    
    let content = '';
    
    // Generate MDC files for each category
    const grouped = this.groupByCategory(prioritized);

    // Always-apply rules
    content += this.generateMDC('global', 'Global rules that always apply', 
      ['*'], true, this.getGlobalRules(context));

    // Category-specific rules
    Object.entries(grouped).forEach(([category, memories]) => {
      const globPattern = this.getGlobPattern(category, context.stack.language);
      const rules = memories.map(m => `- ${m.memory.content}`).join('\n');
      content += this.generateMDC(category, `${category} rules`, 
        [globPattern], false, rules);
    });

    return content;
  }

  private generateMDC(
    name: string,
    description: string,
    globs: string[],
    alwaysApply: boolean,
    content: string
  ): string {
    return `---
description: ${description}
globs: ${JSON.stringify(globs)}
alwaysApply: ${alwaysApply}
---

${content}

`;
  }

  private getGlobalRules(context: ProjectContext): string {
    return `- Project uses ${context.stack.language} with ${context.stack.framework}
- Build system: ${context.stack.buildSystem}
- Package manager: ${context.stack.packageManager}`;
  }

  private getGlobPattern(category: string, language: string): string {
    const extensions: Record<string, string> = {
      typescript: 'ts,tsx',
      javascript: 'js,jsx',
      python: 'py',
      rust: 'rs',
      go: 'go',
    };
    const ext = extensions[language] || 'ts,tsx';
    return `src/**/*.${ext}`;
  }

  private groupByCategory(memories: PrioritizedMemory[]): Record<string, PrioritizedMemory[]> {
    return memories.reduce((acc, m) => {
      if (!acc[m.memory.category]) {
        acc[m.memory.category] = [];
      }
      acc[m.memory.category].push(m);
      return acc;
    }, {} as Record<string, PrioritizedMemory[]>);
  }
}
```

```typescript
// src/inject/copilot.ts
import { Memory, ProjectContext } from '../types';
import { TokenBudget, PrioritizedMemory } from './priority';

export class CopilotGenerator {
  private budget: TokenBudget;

  constructor(tokenBudget: number = 8000) {
    this.budget = new TokenBudget(tokenBudget);
  }

  generate(context: ProjectContext): string {
    const prioritized = this.budget.prioritize(context.memories);
    
    let content = `# GitHub Copilot Instructions\n\n`;
    
    // Project context
    content += `## Project Context\n`;
    content += `This is a ${context.stack.language} project using ${context.stack.framework}.\n\n`;

    // Coding guidelines
    content += `## Coding Guidelines\n`;
    const conventions = prioritized.filter(m => m.memory.category === 'convention');
    conventions.forEach(m => {
      content += `- ${m.memory.content}\n`;
    });
    content += '\n';

    // Architecture decisions
    content += `## Architecture\n`;
    const decisions = prioritized.filter(m => m.memory.category === 'decision');
    decisions.forEach(m => {
      content += `- ${m.memory.content}\n`;
    });
    content += '\n';

    // Important notes
    content += `## Important Notes\n`;
    const workarounds = prioritized.filter(m => m.memory.category === 'workaround');
    workarounds.forEach(m => {
      content += `- ⚠️ ${m.memory.content}\n`;
    });
    content += '\n';

    return content;
  }
}
```

**Deliverables:**
- CLAUDE.md generator
- AGENTS.md generator
- .cursorrules generator
- copilot-instructions.md generator
- Additional format generators (Windsurf, Codex, Cline, Continue, Kiro)

**Success Criteria:**
- [ ] Each generator produces valid format
- [ ] Token budget is respected
- [ ] Memories are properly categorized
- [ ] Output is human-readable

---

### Sub-Phase 2.3: Export Command (Day 5)

**Tasks:**
1. Create `src/cli/commands/sync.ts`
2. Create `src/cli/commands/restore.ts`
3. Implement export logic

```typescript
// src/cli/commands/sync.ts
import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { Storage } from '../../core/storage';
import { ClaudeGenerator } from '../../inject/claude';
import { AgentsGenerator } from '../../inject/agents';
import { CursorGenerator } from '../../inject/cursor';
import { CopilotGenerator } from '../../inject/copilot';
import { detectStack } from '../../capture/detect';

export function syncCommand(program: Command): void {
  program
    .command('sync')
    .description('Sync memories to tool-specific files')
    .option('-t, --tool <tool>', 'Specific tool to sync (claude, agents, cursor, copilot, all)', 'all')
    .option('-w, --watch', 'Watch for changes and auto-sync')
    .action(async (options) => {
      const spinner = ora('Syncing memories...').start();

      try {
        const projectPath = process.cwd();
        const storage = new Storage(projectPath);
        const memories = storage.getAllMemories();
        const stack = detectStack(projectPath);

        const context = {
          path: projectPath,
          name: path.basename(projectPath),
          stack,
          memories,
          sessions: [],
          lastUpdated: new Date().toISOString(),
        };

        const tools = options.tool === 'all' 
          ? ['claude', 'agents', 'cursor', 'copilot']
          : [options.tool];

        for (const tool of tools) {
          spinner.text = `Generating ${tool} file...`;

          let content: string;
          let outputPath: string;

          switch (tool) {
            case 'claude':
              content = new ClaudeGenerator().generate(context);
              outputPath = 'CLAUDE.md';
              break;
            case 'agents':
              content = new AgentsGenerator().generate(context);
              outputPath = 'AGENTS.md';
              break;
            case 'cursor':
              content = new CursorGenerator().generate(context);
              outputPath = '.cursorrules';
              break;
            case 'copilot':
              content = new CopilotGenerator().generate(context);
              outputPath = '.github/copilot-instructions.md';
              break;
            default:
              spinner.fail(chalk.red(`Unknown tool: ${tool}`));
              continue;
          }

          // Ensure directory exists
          const dir = path.dirname(outputPath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }

          // Write file
          fs.writeFileSync(path.join(projectPath, outputPath), content);
          spinner.succeed(chalk.green(`${tool} file generated: ${outputPath}`));
        }

        storage.close();

      } catch (error) {
        spinner.fail(chalk.red('Failed to sync memories'));
        console.error(error);
      }
    });
}
```

```typescript
// src/cli/commands/restore.ts
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { Storage } from '../../core/storage';
import { detectStack } from '../../capture/detect';

export function restoreCommand(program: Command): void {
  program
    .command('restore')
    .description('Restore context for a specific tool')
    .requiredOption('-t, --tool <tool>', 'Tool to restore context for')
    .action(async (options) => {
      const spinner = ora('Restoring context...').start();

      try {
        const projectPath = process.cwd();
        const storage = new Storage(projectPath);
        const memories = storage.getAllMemories();
        const stack = detectStack(projectPath);

        // Filter memories relevant to the tool
        const relevantMemories = memories.filter(m => {
          // All categories are relevant for restore
          return true;
        });

        spinner.stop();

        console.log(chalk.cyan(`\nContext for ${options.tool}:\n`));
        console.log(chalk.white('Project:', projectPath));
        console.log(chalk.white('Language:', stack.language));
        console.log(chalk.white('Framework:', stack.framework));
        console.log(chalk.white('Memories:', relevantMemories.length));

        // Display memories by category
        const grouped = relevantMemories.reduce((acc, m) => {
          if (!acc[m.category]) {
            acc[m.category] = [];
          }
          acc[m.category].push(m);
          return acc;
        }, {} as Record<string, typeof relevantMemories>);

        Object.entries(grouped).forEach(([category, memories]) => {
          console.log(chalk.yellow(`\n${category.toUpperCase()}:`));
          memories.forEach(m => {
            console.log(chalk.white(`  - ${m.content}`));
          });
        });

        storage.close();

      } catch (error) {
        spinner.fail(chalk.red('Failed to restore context'));
        console.error(error);
      }
    });
}
```

**Deliverables:**
- `sync` command for all tools
- `restore` command for specific tools
- File generation logic
- Directory creation

**Success Criteria:**
- [ ] `coster sync` generates all format files
- [ ] `coster sync --tool claude` generates only CLAUDE.md
- [ ] `coster restore --tool cursor` shows relevant context
- [ ] Generated files are valid

---

### Sub-Phase 2.4: Integration Tests (Day 6)

**Tasks:**
1. Create end-to-end tests
2. Test file generation
3. Test token budget compliance

```typescript
// tests/integration/sync.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { Storage } from '../../src/core/storage';
import { ClaudeGenerator } from '../../src/inject/claude';
import { AgentsGenerator } from '../../src/inject/agents';

describe('Sync Integration', () => {
  const testDir = path.join(__dirname, '../fixtures/sync-test');

  beforeEach(() => {
    fs.mkdirSync(testDir, { recursive: true });
    fs.mkdirSync(path.join(testDir, '.coster'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('should generate valid CLAUDE.md', () => {
    const storage = new Storage(testDir);
    
    // Add test memories
    storage.createMemory({
      category: 'decision',
      content: 'Use PostgreSQL for database',
      importance: 0.9,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      accessedAt: new Date().toISOString(),
      accessCount: 10,
      tags: ['database'],
      source: 'manual',
    });

    const memories = storage.getAllMemories();
    const context = {
      path: testDir,
      name: 'test-project',
      stack: {
        language: 'typescript',
        framework: 'react',
        buildSystem: 'vite',
        packageManager: 'pnpm',
        testFramework: 'vitest',
      },
      memories,
      sessions: [],
      lastUpdated: new Date().toISOString(),
    };

    const generator = new ClaudeGenerator();
    const content = generator.generate(context);

    expect(content).toContain('# test-project');
    expect(content).toContain('PostgreSQL');
    expect(content).toContain('## Architecture Decisions');

    storage.close();
  });

  it('should respect token budget', () => {
    const storage = new Storage(testDir);
    
    // Add many memories
    for (let i = 0; i < 100; i++) {
      storage.createMemory({
        category: 'convention',
        content: `Convention ${i}: ${'x'.repeat(200)}`,
        importance: 0.5,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        accessedAt: new Date().toISOString(),
        accessCount: i,
        tags: [],
        source: 'manual',
      });
    }

    const memories = storage.getAllMemories();
    const context = {
      path: testDir,
      name: 'test-project',
      stack: {
        language: 'typescript',
        framework: 'react',
        buildSystem: 'vite',
        packageManager: 'pnpm',
        testFramework: 'vitest',
      },
      memories,
      sessions: [],
      lastUpdated: new Date().toISOString(),
    };

    const generator = new ClaudeGenerator(5000); // 5000 token budget
    const content = generator.generate(context);
    const tokenEstimate = Math.ceil(content.length / 4);

    expect(tokenEstimate).toBeLessThanOrEqual(5500); // Allow 10% margin

    storage.close();
  });
});
```

**Deliverables:**
- Integration tests for sync
- File generation tests
- Token budget tests

**Success Criteria:**
- [ ] All integration tests pass
- [ ] Generated files are valid
- [ ] Token budgets are respected

---

### Phase 2 Milestone

**Deliverables:**
- [x] Token budget management
- [x] CLAUDE.md generator
- [x] AGENTS.md generator
- [x] .cursorrules generator
- [x] copilot-instructions.md generator
- [x] Additional format generators
- [x] sync command
- [x] restore command
- [x] Integration tests

**Verification:**
```bash
# Add memories
coster capture --text "Use PostgreSQL" --category decision
coster capture --text "2-space indentation" --category convention

# Sync to all tools
coster sync

# Check generated files
cat CLAUDE.md
cat AGENTS.md
cat .cursorrules
cat .github/copilot-instructions.md

# Run tests
pnpm test
```

---

## 4. Phase 3: Automation (Week 5-6)

### Goal
Automatic capture via git hooks and shell integration.

### Sub-Phase 3.1: Git Hooks Installer (Day 1)

**Tasks:**
1. Create `src/cli/commands/hooks.ts`
2. Implement hook installation
3. Create hook scripts

```typescript
// src/cli/commands/hooks.ts
import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import chalk from 'chalk';
import ora from 'ora';

export function hooksCommand(program: Command): void {
  program
    .command('hooks')
    .description('Manage git hooks')
    .argument('<action>', 'Action to perform (install, uninstall, status)')
    .action(async (action) => {
      switch (action) {
        case 'install':
          await installHooks();
          break;
        case 'uninstall':
          await uninstallHooks();
          break;
        case 'status':
          await showStatus();
          break;
        default:
          console.log(chalk.red(`Unknown action: ${action}`));
      }
    });
}

async function installHooks(): Promise<void> {
  const spinner = ora('Installing git hooks...').start();

  try {
    const projectPath = process.cwd();
    const hooksDir = path.join(projectPath, '.coster', 'hooks');
    const gitHooksDir = path.join(projectPath, '.git', 'hooks');

    // Ensure hooks directory exists
    if (!fs.existsSync(hooksDir)) {
      fs.mkdirSync(hooksDir, { recursive: true });
    }

    // Create hook scripts
    const hooks = ['pre-commit', 'post-commit', 'post-checkout'];

    for (const hook of hooks) {
      const hookScript = generateHookScript(hook);
      fs.writeFileSync(path.join(hooksDir, hook), hookScript, { mode: 0o755 });
    }

    // Configure git to use our hooks directory
    execSync(`git config core.hooksPath .coster/hooks`, { cwd: projectPath });

    spinner.succeed(chalk.green('Git hooks installed successfully!'));
    console.log(chalk.cyan('\nInstalled hooks:'));
    hooks.forEach(hook => console.log(`  - ${hook}`));

  } catch (error) {
    spinner.fail(chalk.red('Failed to install git hooks'));
    console.error(error);
  }
}

async function uninstallHooks(): Promise<void> {
  const spinner = ora('Uninstalling git hooks...').start();

  try {
    const projectPath = process.cwd();
    
    // Reset git hooks path
    execSync('git config --unset core.hooksPath', { cwd: projectPath });

    spinner.succeed(chalk.green('Git hooks uninstalled successfully!'));

  } catch (error) {
    spinner.fail(chalk.red('Failed to uninstall git hooks'));
    console.error(error);
  }
}

async function showStatus(): Promise<void> {
  const projectPath = process.cwd();
  const hooksDir = path.join(projectPath, '.coster', 'hooks');

  console.log(chalk.cyan('\nGit Hooks Status:\n'));

  if (!fs.existsSync(hooksDir)) {
    console.log(chalk.yellow('No hooks installed.'));
    return;
  }

  const hooks = fs.readdirSync(hooksDir);
  hooks.forEach(hook => {
    const hookPath = path.join(hooksDir, hook);
    const stats = fs.statSync(hookPath);
    const isExecutable = (stats.mode & 0o111) !== 0;
    console.log(`  ${hook}: ${isExecutable ? chalk.green('installed') : chalk.red('not executable')}`);
  });
}

function generateHookScript(hookName: string): string {
  const scripts: Record<string, string> = {
    'pre-commit': `#!/bin/bash
# Coster pre-commit hook
echo "Running Coster pre-commit hook..."

# Capture staged files
STAGED_FILES=$(git diff --cached --name-only)
echo "Staged files: $STAGED_FILES"

# Run coster capture
coster capture --text "Pre-commit: $STAGED_FILES" --category recap --source git-hook
`,
    'post-commit': `#!/bin/bash
# Coster post-commit hook
COMMIT_HASH=$(git rev-parse HEAD)
COMMIT_MSG=$(git log -1 --pretty=%B)
CHANGED_FILES=$(git diff-tree --no-commit-id --name-only -r HEAD)

echo "Capturing commit: $COMMIT_HASH"
coster capture --text "Commit $COMMIT_HASH: $COMMIT_MSG" --category recap --source git-hook
`,
    'post-checkout': `#!/bin/bash
# Coster post-checkout hook
PREV_HEAD=$1
NEW_HEAD=$2
BRANCH_CHECKOUT=$3

if [ "$BRANCH_CHECKOUT" = "1" ]; then
  echo "Branch checkout detected"
  BRANCH_NAME=$(git rev-parse --abbrev-ref HEAD)
  coster capture --text "Checked out branch: $BRANCH_NAME" --category recap --source git-hook
fi
`,
  };

  return scripts[hookName] || '#!/bin/bash\necho "Unknown hook"';
}
```

**Deliverables:**
- hooks command (install, uninstall, status)
- Hook script generation
- Git configuration

**Success Criteria:**
- [ ] `coster hooks install` installs all hooks
- [ ] `coster hooks status` shows installed hooks
- [ ] `coster hooks uninstall` removes hooks
- [ ] Git is configured to use .coster/hooks

---

### Sub-Phase 3.2: Git Hook Capture (Day 2)

**Tasks:**
1. Create `src/capture/git.ts`
2. Implement git analysis
3. Add commit capture

```typescript
// src/capture/git.ts
import { execSync } from 'child_process';
import { Memory } from '../types';

export interface GitCommit {
  hash: string;
  message: string;
  author: string;
  date: string;
  files: string[];
}

export interface GitAnalysis {
  commits: GitCommit[];
  contributors: string[];
  hotspots: string[];
  conventions: string[];
}

export class GitCapture {
  private repoPath: string;

  constructor(repoPath: string) {
    this.repoPath = repoPath;
  }

  isGitRepo(): boolean {
    try {
      execSync('git rev-parse --git-dir', { cwd: this.repoPath });
      return true;
    } catch {
      return false;
    }
  }

  getRecentCommits(count: number = 10): GitCommit[] {
    try {
      const format = '%H|%s|%an|%ai';
      const output = execSync(
        `git log --pretty=format:"${format}" -${count}`,
        { cwd: this.repoPath, encoding: 'utf-8' }
      );

      return output.split('\n').map(line => {
        const [hash, message, author, date] = line.split('|');
        const files = this.getCommitFiles(hash);
        return { hash, message, author, date, files };
      });
    } catch {
      return [];
    }
  }

  getCommitFiles(hash: string): string[] {
    try {
      const output = execSync(
        `git diff-tree --no-commit-id --name-only -r ${hash}`,
        { cwd: this.repoPath, encoding: 'utf-8' }
      );
      return output.split('\n').filter(Boolean);
    } catch {
      return [];
    }
  }

  analyzeRepository(): GitAnalysis {
    const commits = this.getRecentCommits(100);
    const contributors = this.getContributors();
    const hotspots = this.findHotspots(commits);
    const conventions = this.detectConventions();

    return { commits, contributors, hotspots, conventions };
  }

  private getContributors(): string[] {
    try {
      const output = execSync(
        'git shortlog -sn --all',
        { cwd: this.repoPath, encoding: 'utf-8' }
      );
      return output.split('\n')
        .map(line => line.trim().split('\t')[1])
        .filter(Boolean);
    } catch {
      return [];
    }
  }

  private findHotspots(commits: GitCommit[]): string[] {
    const fileCounts: Record<string, number> = {};
    
    commits.forEach(commit => {
      commit.files.forEach(file => {
        fileCounts[file] = (fileCounts[file] || 0) + 1;
      });
    });

    return Object.entries(fileCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([file]) => file);
  }

  private detectConventions(): string[] {
    const conventions: string[] = [];

    try {
      // Check for conventional commits
      const output = execSync(
        'git log --oneline -20',
        { cwd: this.repoPath, encoding: 'utf-8' }
      );

      const conventionalPattern = /^(feat|fix|docs|style|refactor|test|chore)/;
      const hasConventional = output.split('\n').some(line => 
        conventionalPattern.test(line)
      );

      if (hasConventional) {
        conventions.push('Uses conventional commits');
      }
    } catch {
      // Ignore errors
    }

    return conventions;
  }

  captureCommitAsMemory(commit: GitCommit): Omit<Memory, 'id'> {
    return {
      category: 'recap',
      content: `Commit ${commit.hash.substring(0, 7)}: ${commit.message}`,
      importance: 0.5,
      createdAt: commit.date,
      updatedAt: commit.date,
      accessedAt: new Date().toISOString(),
      accessCount: 0,
      tags: ['git', 'commit'],
      source: 'git-hook',
      metadata: {
        hash: commit.hash,
        files: commit.files,
      },
    };
  }
}
```

**Deliverables:**
- Git capture class
- Commit analysis
- Repository analysis
- Memory generation from commits

**Success Criteria:**
- [ ] Can detect git repository
- [ ] Can retrieve recent commits
- [ ] Can analyze repository
- [ ] Can generate memories from commits

---

### Sub-Phase 3.3: Shell Integration (Day 3-4)

**Tasks:**
1. Create `src/capture/shell.ts`
2. Implement Bash integration
3. Implement PowerShell integration

```typescript
// src/capture/shell.ts
import fs from 'fs';
import path from 'path';
import os from 'os';

export class ShellIntegration {
  private projectPath: string;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
  }

  installBashIntegration(): void {
    const bashrcPath = path.join(os.homedir(), '.bashrc');
    const costerHook = `
# Coster shell integration
if [ -f "${path.join(this.projectPath, '.coster', 'shell', 'bash.sh')}" ]; then
  source "${path.join(this.projectPath, '.coster', 'shell', 'bash.sh')}"
fi
`;

    // Append to .bashrc if not already present
    if (fs.existsSync(bashrcPath)) {
      const content = fs.readFileSync(bashrcPath, 'utf-8');
      if (!content.includes('coster')) {
        fs.appendFileSync(bashrcPath, costerHook);
      }
    }
  }

  installPowerShellIntegration(): void {
    const profilePath = path.join(os.homedir(), 'Documents', 'PowerShell', 'Microsoft.PowerShell_profile.ps1');
    const costerHook = `
# Coster shell integration
if (Test-Path "${path.join(this.projectPath, '.coster', 'shell', 'powershell.ps1')}") {
  . "${path.join(this.projectPath, '.coster', 'shell', 'powershell.ps1')}"
}
`;

    // Create directory if it doesn't exist
    const dir = path.dirname(profilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Append to profile if not already present
    if (fs.existsSync(profilePath)) {
      const content = fs.readFileSync(profilePath, 'utf-8');
      if (!content.includes('coster')) {
        fs.appendFileSync(profilePath, costerHook);
      }
    }
  }

  generateBashScript(): string {
    return `#!/bin/bash
# Coster shell integration

# Capture commands
trap 'coster capture --text "Command: $BASH_COMMAND" --category recap --source shell-hook' DEBUG

# Capture directory changes
function cd() {
  builtin cd "$@"
  coster capture --text "Changed directory to: $PWD" --category recap --source shell-hook
}
`;
  }

  generatePowerShellScript(): string {
    return `# Coster PowerShell integration

# Capture commands
function Prompt {
    $cmd = (Get-History -Count 1).CommandLine
    if ($cmd) {
        coster capture --text "Command: $cmd" --category recap --source shell-hook
    }
    return "PS> "
}

# Capture directory changes
function Set-Location {
    param([string]$Path)
    Microsoft.PowerShell.Management\\Set-Location @PSBoundParameters
    coster capture --text "Changed directory to: $PWD" --category recap --source shell-hook
}
`;
  }

  createShellIntegrationFiles(): void {
    const shellDir = path.join(this.projectPath, '.coster', 'shell');
    
    if (!fs.existsSync(shellDir)) {
      fs.mkdirSync(shellDir, { recursive: true });
    }

    // Write Bash script
    fs.writeFileSync(
      path.join(shellDir, 'bash.sh'),
      this.generateBashScript(),
      { mode: 0o755 }
    );

    // Write PowerShell script
    fs.writeFileSync(
      path.join(shellDir, 'powershell.ps1'),
      this.generatePowerShellScript()
    );
  }
}
```

**Deliverables:**
- Shell integration class
- Bash script generation
- PowerShell script generation
- Automatic installation

**Success Criteria:**
- [ ] Bash integration works
- [ ] PowerShell integration works
- [ ] Commands are captured
- [ ] Directory changes are captured

---

### Sub-Phase 3.4: Session Detection (Day 5)

**Tasks:**
1. Create `src/capture/session.ts`
2. Implement session start/end detection
3. Add session summarization

```typescript
// src/capture/session.ts
import { v4 as uuidv4 } from 'uuid';
import { Session, Memory } from '../types';
import { Storage } from '../core/storage';

export class SessionManager {
  private storage: Storage;
  private currentSession: Session | null = null;

  constructor(storage: Storage) {
    this.storage = storage;
  }

  startSession(): Session {
    this.currentSession = {
      id: uuidv4(),
      startedAt: new Date().toISOString(),
      filesChanged: [],
      decisionsMade: [],
    };

    return this.currentSession;
  }

  endSession(summary?: string): Session | null {
    if (!this.currentSession) {
      return null;
    }

    this.currentSession.endedAt = new Date().toISOString();
    this.currentSession.summary = summary;

    // Store session
    this.storage.createSession(this.currentSession);

    // Generate recap memory
    const recapMemory = this.generateRecapMemory(this.currentSession);
    this.storage.createMemory(recapMemory);

    const session = this.currentSession;
    this.currentSession = null;

    return session;
  }

  addFileChanged(file: string): void {
    if (this.currentSession) {
      this.currentSession.filesChanged.push(file);
    }
  }

  addDecisionMade(decision: string): void {
    if (this.currentSession) {
      this.currentSession.decisionsMade.push(decision);
    }
  }

  getCurrentSession(): Session | null {
    return this.currentSession;
  }

  private generateRecapMemory(session: Session): Omit<Memory, 'id'> {
    const duration = session.endedAt 
      ? Math.floor((new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime()) / 1000 / 60)
      : 0;

    let content = `Session recap: ${duration} minutes`;
    
    if (session.filesChanged.length > 0) {
      content += `\nFiles changed: ${session.filesChanged.join(', ')}`;
    }

    if (session.decisionsMade.length > 0) {
      content += `\nDecisions made: ${session.decisionsMade.join('; ')}`;
    }

    if (session.summary) {
      content += `\nSummary: ${session.summary}`;
    }

    return {
      category: 'recap',
      content,
      importance: 0.4,
      createdAt: session.startedAt,
      updatedAt: new Date().toISOString(),
      accessedAt: new Date().toISOString(),
      accessCount: 0,
      tags: ['session', 'recap'],
      source: 'auto',
      metadata: {
        sessionId: session.id,
        duration,
        filesChanged: session.filesChanged,
        decisionsMade: session.decisionsMade,
      },
    };
  }
}
```

**Deliverables:**
- Session manager class
- Session start/end detection
- Recap memory generation

**Success Criteria:**
- [ ] Can start a session
- [ ] Can end a session
- [ ] Session recap is generated
- [ ] Session is stored in database

---

### Sub-Phase 3.5: Auto-Injection (Day 6)

**Tasks:**
1. Create `src/inject/auto.ts`
2. Implement automatic file generation
3. Add file watcher (optional)

```typescript
// src/inject/auto.ts
import fs from 'fs';
import path from 'path';
import { Storage } from '../core/storage';
import { ClaudeGenerator } from './claude';
import { AgentsGenerator } from './agents';
import { CursorGenerator } from './cursor';
import { CopilotGenerator } from './copilot';
import { detectStack } from '../capture/detect';

export class AutoInjector {
  private projectPath: string;
  private storage: Storage;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
    this.storage = new Storage(projectPath);
  }

  async injectAll(): Promise<void> {
    const memories = this.storage.getAllMemories();
    const stack = detectStack(this.projectPath);

    const context = {
      path: this.projectPath,
      name: path.basename(this.projectPath),
      stack,
      memories,
      sessions: [],
      lastUpdated: new Date().toISOString(),
    };

    // Generate all format files
    await this.generateClaudeMd(context);
    await this.generateAgentsMd(context);
    await this.generateCursorRules(context);
    await this.generateCopilotInstructions(context);
  }

  private async generateClaudeMd(context: any): Promise<void> {
    const generator = new ClaudeGenerator();
    const content = generator.generate(context);
    const outputPath = path.join(this.projectPath, 'CLAUDE.md');
    
    fs.writeFileSync(outputPath, content);
  }

  private async generateAgentsMd(context: any): Promise<void> {
    const generator = new AgentsGenerator();
    const content = generator.generate(context);
    const outputPath = path.join(this.projectPath, 'AGENTS.md');
    
    fs.writeFileSync(outputPath, content);
  }

  private async generateCursorRules(context: any): Promise<void> {
    const generator = new CursorGenerator();
    const content = generator.generate(context);
    const outputPath = path.join(this.projectPath, '.cursorrules');
    
    fs.writeFileSync(outputPath, content);
  }

  private async generateCopilotInstructions(context: any): Promise<void> {
    const generator = new CopilotGenerator();
    const content = generator.generate(context);
    const outputPath = path.join(this.projectPath, '.github', 'copilot-instructions.md');
    
    // Ensure directory exists
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(outputPath, content);
  }

  close(): void {
    this.storage.close();
  }
}
```

**Deliverables:**
- Auto-injector class
- Automatic file generation
- File watcher (optional)

**Success Criteria:**
- [ ] Can inject all formats
- [ ] Files are generated correctly
- [ ] Can be called from hooks

---

### Phase 3 Milestone

**Deliverables:**
- [x] Git hooks installer
- [x] Git hook capture
- [x] Shell integration (Bash/PowerShell)
- [x] Session detection
- [x] Auto-injection

**Verification:**
```bash
# Install hooks
coster hooks install

# Make a commit
git commit -m "test: add feature"

# Check captured memory
coster list

# Check generated files
cat CLAUDE.md
cat AGENTS.md
```

---

## 5. Phase 4: MCP & Polish (Week 7-8)

### Goal
MCP server for runtime context access and production readiness.

### Sub-Phase 4.1: MCP Server (Day 1-3)

**Tasks:**
1. Create `src/mcp/server.ts`
2. Implement MCP tools
3. Implement MCP resources
4. Implement MCP prompts

```typescript
// src/mcp/server.ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Storage } from '../core/storage';
import { QualityGate } from '../core/quality';
import { Memory, MemoryCategory } from '../types';

export class CosterMcpServer {
  private server: McpServer;
  private storage: Storage;
  private qualityGate: QualityGate;

  constructor(projectPath: string) {
    this.storage = new Storage(projectPath);
    this.qualityGate = new QualityGate();

    this.server = new McpServer({
      name: 'coster',
      version: '1.0.0',
    });

    this.registerTools();
    this.registerResources();
    this.registerPrompts();
  }

  private registerTools(): void {
    // Tool: Search memories
    this.server.tool(
      'search_memories',
      {
        query: { type: 'string', description: 'Search query' },
        category: { type: 'string', description: 'Filter by category', optional: true },
        limit: { type: 'number', description: 'Max results', optional: true },
      },
      async ({ query, category, limit }) => {
        const results = this.storage.searchMemories(query, category as MemoryCategory);
        const limited = results.slice(0, limit || 10);
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(limited, null, 2),
          }],
        };
      }
    );

    // Tool: Add memory
    this.server.tool(
      'add_memory',
      {
        content: { type: 'string', description: 'Memory content' },
        category: { type: 'string', description: 'Memory category' },
        importance: { type: 'number', description: 'Importance (0-1)', optional: true },
        tags: { type: 'string', description: 'Comma-separated tags', optional: true },
      },
      async ({ content, category, importance, tags }) => {
        const memory: Omit<Memory, 'id'> = {
          category: category as MemoryCategory,
          content,
          importance: importance || 0.5,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          accessedAt: new Date().toISOString(),
          accessCount: 0,
          tags: tags ? tags.split(',').map(t => t.trim()) : [],
          source: 'manual',
        };

        // Evaluate quality
        const existingMemories = this.storage.getAllMemories();
        const qualityResult = this.qualityGate.evaluate(
          { ...memory, id: 'temp' } as Memory,
          existingMemories
        );

        if (!qualityResult.passed) {
          return {
            content: [{
              type: 'text',
              text: `Memory rejected by quality gate. Score: ${qualityResult.score}/7. Reasons: ${qualityResult.reasons.join(', ')}`,
            }],
            isError: true,
          };
        }

        const stored = this.storage.createMemory(memory);
        return {
          content: [{
            type: 'text',
            text: `Memory added successfully. ID: ${stored.id}, Score: ${qualityResult.score}/7`,
          }],
        };
      }
    );

    // Tool: Get memory
    this.server.tool(
      'get_memory',
      {
        id: { type: 'string', description: 'Memory ID' },
      },
      async ({ id }) => {
        const memory = this.storage.getMemory(id);
        if (!memory) {
          return {
            content: [{
              type: 'text',
              text: `Memory not found: ${id}`,
            }],
            isError: true,
          };
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify(memory, null, 2),
          }],
        };
      }
    );

    // Tool: List memories
    this.server.tool(
      'list_memories',
      {
        category: { type: 'string', description: 'Filter by category', optional: true },
        limit: { type: 'number', description: 'Max results', optional: true },
      },
      async ({ category, limit }) => {
        const memories = this.storage.getAllMemories(category as MemoryCategory);
        const limited = memories.slice(0, limit || 20);
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(limited, null, 2),
          }],
        };
      }
    );

    // Tool: Delete memory
    this.server.tool(
      'delete_memory',
      {
        id: { type: 'string', description: 'Memory ID' },
      },
      async ({ id }) => {
        const deleted = this.storage.deleteMemory(id);
        if (!deleted) {
          return {
            content: [{
              type: 'text',
              text: `Memory not found: ${id}`,
            }],
            isError: true,
          };
        }

        return {
          content: [{
            type: 'text',
            text: `Memory deleted: ${id}`,
          }],
        };
      }
    );

    // Tool: Get project context
    this.server.tool(
      'get_project_context',
      {},
      async () => {
        const memories = this.storage.getAllMemories();
        const context = {
          totalMemories: memories.length,
          categories: this.groupByCategory(memories),
          recentMemories: memories
            .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
            .slice(0, 10),
        };
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(context, null, 2),
          }],
        };
      }
    );
  }

  private registerResources(): void {
    // Resource: Project context
    this.server.resource(
      'project_context',
      'project://context',
      async (uri) => {
        const memories = this.storage.getAllMemories();
        const context = {
          totalMemories: memories.length,
          categories: this.groupByCategory(memories),
        };
        
        return {
          contents: [{
            uri: uri.href,
            text: JSON.stringify(context, null, 2),
            mimeType: 'application/json',
          }],
        };
      }
    );

    // Resource: All memories
    this.server.resource(
      'all_memories',
      'project://memories',
      async (uri) => {
        const memories = this.storage.getAllMemories();
        return {
          contents: [{
            uri: uri.href,
            text: JSON.stringify(memories, null, 2),
            mimeType: 'application/json',
          }],
        };
      }
    );

    // Resource: Decisions
    this.server.resource(
      'decisions',
      'project://decisions',
      async (uri) => {
        const memories = this.storage.getAllMemories('decision');
        return {
          contents: [{
            uri: uri.href,
            text: JSON.stringify(memories, null, 2),
            mimeType: 'application/json',
          }],
        };
      }
    );

    // Resource: Conventions
    this.server.resource(
      'conventions',
      'project://conventions',
      async (uri) => {
        const memories = this.storage.getAllMemories('convention');
        return {
          contents: [{
            uri: uri.href,
            text: JSON.stringify(memories, null, 2),
            mimeType: 'application/json',
          }],
        };
      }
    );
  }

  private registerPrompts(): void {
    // Prompt: Session start
    this.server.prompt(
      'session_start',
      {
        project_path: { type: 'string', description: 'Project path' },
      },
      async ({ project_path }) => {
        const memories = this.storage.getAllMemories();
        const context = this.formatContextForPrompt(memories);
        
        return {
          messages: [{
            role: 'user',
            content: {
              type: 'text',
              text: `Starting new session for project: ${project_path}\n\n${context}`,
            },
          }],
        };
      }
    );

    // Prompt: Summarize session
    this.server.prompt(
      'summarize_session',
      {
        files_changed: { type: 'string', description: 'Comma-separated list of changed files' },
      },
      async ({ files_changed }) => {
        const files = files_changed.split(',').map(f => f.trim());
        
        return {
          messages: [{
            role: 'user',
            content: {
              type: 'text',
              text: `Please summarize the changes made to these files:\n${files.map(f => `- ${f}`).join('\n')}\n\nKey decisions and conventions to remember:`,
            },
          }],
        };
      }
    );
  }

  private groupByCategory(memories: Memory[]): Record<string, number> {
    return memories.reduce((acc, m) => {
      acc[m.category] = (acc[m.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  private formatContextForPrompt(memories: Memory[]): string {
    const grouped = this.groupByCategory(memories);
    
    let context = 'Project Context:\n';
    context += `Total memories: ${memories.length}\n\n`;
    
    context += 'By category:\n';
    Object.entries(grouped).forEach(([category, count]) => {
      context += `  - ${category}: ${count}\n`;
    });
    
    context += '\nRecent memories:\n';
    memories
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 10)
      .forEach(m => {
        context += `  - [${m.category}] ${m.content}\n`;
      });
    
    return context;
  }

  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Coster MCP server started');
  }

  close(): void {
    this.storage.close();
  }
}
```

```typescript
// src/cli/commands/mcp.ts
import { Command } from 'commander';
import { CosterMcpServer } from '../../mcp/server';

export function mcpCommand(program: Command): void {
  program
    .command('mcp')
    .description('Start MCP server for runtime context access')
    .action(async () => {
      const server = new CosterMcpServer(process.cwd());
      await server.start();
    });
}
```

**Deliverables:**
- MCP server class
- 6 MCP tools (search, add, get, list, delete, context)
- 4 MCP resources (context, memories, decisions, conventions)
- 2 MCP prompts (session_start, summarize_session)

**Success Criteria:**
- [ ] `coster mcp` starts MCP server
- [ ] Tools are accessible via MCP protocol
- [ ] Resources are accessible via MCP protocol
- [ ] Prompts work correctly

---

### Sub-Phase 4.2: MCP Testing (Day 4)

**Tasks:**
1. Create MCP test suite
2. Test tools
3. Test resources
4. Test prompts

```typescript
// tests/integration/mcp.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CosterMcpServer } from '../../src/mcp/server';
import fs from 'fs';
import path from 'path';

describe('MCP Server', () => {
  let server: CosterMcpServer;
  const testDir = path.join(__dirname, '../fixtures/mcp-test');

  beforeEach(() => {
    fs.mkdirSync(testDir, { recursive: true });
    fs.mkdirSync(path.join(testDir, '.coster'), { recursive: true });
    server = new CosterMcpServer(testDir);
  });

  afterEach(() => {
    server.close();
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('should create server instance', () => {
    expect(server).toBeDefined();
  });

  // Additional tests would require MCP client for full integration testing
});
```

**Deliverables:**
- MCP test suite
- Tool tests
- Resource tests

**Success Criteria:**
- [ ] All MCP tests pass
- [ ] Server starts without errors
- [ ] Tools are accessible

---

### Sub-Phase 4.3: CLI Polish (Day 5)

**Tasks:**
1. Add colors and formatting
2. Add help text
3. Add progress indicators
4. Add error handling

```typescript
// src/cli/utils/output.ts
import chalk from 'chalk';
import ora from 'ora';
import cliTable from 'cli-table3';

export function printSuccess(message: string): void {
  console.log(chalk.green(`✓ ${message}`));
}

export function printError(message: string): void {
  console.log(chalk.red(`✗ ${message}`));
}

export function printWarning(message: string): void {
  console.log(chalk.yellow(`⚠ ${message}`));
}

export function printInfo(message: string): void {
  console.log(chalk.cyan(`ℹ ${message}`));
}

export function printTable(headers: string[], rows: string[][]): void {
  const table = new cliTable({
    head: headers,
    colWidths: headers.map(() => 20),
  });
  
  rows.forEach(row => table.push(row));
  console.log(table.toString());
}

export function createSpinner(text: string) {
  return ora(text);
}
```

**Deliverables:**
- Output utilities
- Colored output
- Progress indicators
- Formatted tables

**Success Criteria:**
- [ ] All commands have colored output
- [ ] Progress indicators work
- [ ] Tables are formatted correctly

---

### Sub-Phase 4.4: Documentation (Day 6)

**Tasks:**
1. Create README.md
2. Create USAGE.md
3. Create API.md
4. Add JSDoc comments

```markdown
# README.md

# Coster

> Universal context persistence layer for AI coding assistants

## Features

- 🔄 **Universal** — Works with 12+ AI coding tools
- 🔒 **Offline-first** — No cloud dependency
- ✅ **Quality-gated** — 7-rule filter prevents noise
- 🔗 **Cross-tool** — One directory, all tools
- 🪝 **Hook-driven** — Automatic capture via git hooks
- 🔌 **MCP-native** — Runtime context access
- 💰 **Token-budget-aware** — Smart injection

## Quick Start

```bash
# Install
npm install -g coster

# Initialize
coster init

# Capture memory
coster capture --text "Use 2-space indentation" --category convention

# Search
coster search "indentation"

# Sync to all tools
coster sync
```

## Commands

| Command | Description |
|---------|-------------|
| `coster init` | Initialize Coster in project |
| `coster capture` | Capture a new memory |
| `coster search` | Search memories |
| `coster list` | List all memories |
| `coster sync` | Generate tool-specific files |
| `coster restore` | Restore context for a tool |
| `coster hooks` | Manage git hooks |
| `coster mcp` | Start MCP server |

## Supported Tools

| Tool | Export File |
|------|-------------|
| Claude Code | CLAUDE.md |
| Cursor | .cursorrules |
| Copilot | .github/copilot-instructions.md |
| OpenCode | AGENTS.md |
| Windsurf | .windsurf/rules/ |
| Codex CLI | .codex/memory.md |
| Cline | .clinerules |
| Continue.dev | .continue/rules/ |
| Kiro | .kiro/steering/ |

## Configuration

Coster stores configuration in `.coster/config.json`:

```json
{
  "version": 1,
  "project": {
    "name": "my-project",
    "path": "/path/to/project"
  },
  "tools": [
    { "name": "claude-code", "enabled": true, "tokenBudget": 17000 }
  ],
  "quality": {
    "minScore": 4,
    "maxTokens": 200
  }
}
```

## Quality Gate

Coster uses a 7-rule quality gate to prevent noise:

1. **Specificity** — Must be specific to this project
2. **Actionability** — Must be actionable
3. **Currency** — Must be current
4. **Uniqueness** — Not a duplicate
5. **Evidence** — Must have evidence
6. **Relevance** — Must be relevant
7. **Conciseness** — Must be concise (< 200 tokens)

Memories scoring ≥ 4/7 are accepted.

## License

MIT
```

**Deliverables:**
- README.md
- USAGE.md
- API.md
- JSDoc comments

**Success Criteria:**
- [ ] README is comprehensive
- [ ] USAGE has examples
- [ ] API documentation exists
- [ ] All functions have JSDoc

---

### Phase 4 Milestone

**Deliverables:**
- [x] MCP server with tools, resources, prompts
- [x] MCP test suite
- [x] CLI polish
- [x] Documentation

**Verification:**
```bash
# Start MCP server
coster mcp

# Test in MCP client
# - search_memories "query"
# - add_memory "content" "category"
# - get_project_context

# Run tests
pnpm test

# Build
pnpm build
```

---

## 6. Phase 5: Advanced Features (Week 9-12)

### Goal
Ecosystem expansion and advanced features.

### Sub-Phase 5.1: Remaining Tool Exports (Day 1-3)

**Tasks:**
1. Create Windsurf generator
2. Create Codex generator
3. Create Cline generator
4. Create Continue generator
5. Create Kiro generator

**Deliverables:**
- 5 additional format generators

**Success Criteria:**
- [ ] All generators produce valid output
- [ ] Token budgets are respected

---

### Sub-Phase 5.2: Session Recaps (Day 4-5)

**Tasks:**
1. Enhance session manager
2. Add auto-summarization
3. Add session comparison

**Deliverables:**
- Enhanced session recaps
- Auto-summarization

**Success Criteria:**
- [ ] Sessions are auto-summarized
- [ ] Session comparison works

---

### Sub-Phase 5.3: Mistake Logging (Day 6)

**Tasks:**
1. Create mistake logger
2. Add mistake detection
3. Add mistake prevention

**Deliverables:**
- Mistake logging system
- Mistake prevention

**Success Criteria:**
- [ ] Mistakes are logged
- [ ] Similar mistakes are prevented

---

### Sub-Phase 5.4: Web Dashboard (Day 7-11)

**Tasks:**
1. Create web server
2. Create dashboard UI
3. Add memory management
4. Add analytics

**Deliverables:**
- Web dashboard
- Memory management UI

**Success Criteria:**
- [ ] Dashboard is accessible
- [ ] Can manage memories via UI
- [ ] Analytics are displayed

---

### Sub-Phase 5.5: Team Sharing (Day 12-16)

**Tasks:**
1. Add team sync
2. Add conflict resolution
3. Add permissions

**Deliverables:**
- Team sharing system
- Conflict resolution

**Success Criteria:**
- [ ] Teams can share context
- [ ] Conflicts are resolved
- [ ] Permissions work

---

### Phase 5 Milestone

**Deliverables:**
- [x] Remaining tool exports
- [x] Session recaps
- [x] Mistake logging
- [x] Web dashboard
- [x] Team sharing

**Verification:**
```bash
# Generate all formats
coster sync

# Check all generated files
ls -la .windsurf/rules/
ls -la .codex/
ls -la .cline/
ls -la .continue/rules/
ls -la .kiro/steering/

# Start web dashboard
coster dashboard

# Access at http://localhost:3000
```

---

## 7. Dependency Matrix

| Phase | Depends On | Blocks |
|-------|------------|--------|
| Phase 1 | None | Phase 2, 3, 4 |
| Phase 2 | Phase 1 | Phase 4, 5 |
| Phase 3 | Phase 1 | Phase 4 |
| Phase 4 | Phase 1, 2 | Phase 5 |
| Phase 5 | Phase 1, 2, 3, 4 | None |

---

## 8. Success Criteria

### Overall Success Criteria

| Criterion | Target | Measurement |
|-----------|--------|-------------|
| Time to first context restore | < 30 seconds | Manual testing |
| Tool integrations | 12+ at launch | Count of generators |
| Memory quality score | > 85% relevance | User testing |
| Zero-config usage | Works with `coster init` | Manual testing |
| Offline operation | 100% core features | Test suite |
| Test coverage | > 80% | Vitest coverage |
| Bundle size | < 500KB | Build output |
| CLI startup time | < 100ms | Benchmark |

### Phase Success Criteria

| Phase | Criterion | Target |
|-------|-----------|--------|
| Phase 1 | Core storage and CLI working | All commands functional |
| Phase 2 | Tool-specific file generation | 4+ formats working |
| Phase 3 | Automatic capture | Git hooks installed |
| Phase 4 | MCP server | Tools accessible via MCP |
| Phase 5 | Ecosystem expansion | 12+ tool integrations |

---

**Document Version:** 1.0
**Last Updated:** August 16, 2026
**Author:** Coster Implementation Team
