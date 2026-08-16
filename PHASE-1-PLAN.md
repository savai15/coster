# COSTER Phase 1 — Exhaustive Implementation Plan

> **Every Detail, Every Problem, Every Solution**
> Version: 1.0 | Date: August 16, 2026

---

## Table of Contents

1. [Phase 1 Overview](#1-phase-1-overview)
2. [Sub-Phase 1.1: Project Scaffolding](#2-sub-phase-11-project-scaffolding)
3. [Sub-Phase 1.2: Type Definitions](#3-sub-phase-12-type-definitions)
4. [Sub-Phase 1.3: SQLite Storage Layer](#4-sub-phase-13-sqlite-storage-layer)
5. [Sub-Phase 1.4: Quality Gate](#5-sub-phase-14-quality-gate)
6. [Sub-Phase 1.5: CLI Foundation](#6-sub-phase-15-cli-foundation)
7. [Sub-Phase 1.6: Unit Tests](#7-sub-phase-16-unit-tests)
8. [Problem Registry](#8-problem-registry)
9. [Verification Checklist](#9-verification-checklist)

---

## 1. Phase 1 Overview

### Goal
Core storage and CLI working with basic capture, search, and quality gate.

### Success Criteria
- `coster init` creates `.coster/` directory
- `coster capture --text "..."` stores memory
- `coster search "query"` returns results
- `coster list` shows all memories
- Quality gate rejects low-quality memories
- All unit tests pass
- Test coverage > 80%

### Dependencies
- Node.js 18+ installed
- pnpm 8+ installed
- Git 2.30+ installed
- SQLite 3.35+ available (via better-sqlite3)

### Risk Assessment
| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| SQLite native module compilation | Medium | High | Use prebuilt binaries, fallback to source build |
| Path handling on Windows | High | Medium | Use path module consistently, test on Windows |
| FTS5 not available | Low | High | Check SQLite version, fallback to LIKE search |
| Commander.js API changes | Low | Low | Pin version, test CLI thoroughly |
| UUID generation conflicts | Low | Low | Use uuid v4, validate uniqueness |

---

## 2. Sub-Phase 1.1: Project Scaffolding

### Goal
Working development environment with all tooling configured.

### Step-by-Step Plan

#### Step 1.1.1: Initialize Package Manager

```bash
# Create project directory
mkdir coster && cd coster

# Initialize with pnpm
pnpm init
```

**Potential Problems:**
1. pnpm not installed
   - **Solution:** `npm install -g pnpm`
   - **Verification:** `pnpm --version` should show 8+

2. Wrong directory permissions
   - **Solution:** Check write permissions, run as admin if needed
   - **Verification:** `ls -la` shows write permission

3. Existing package.json conflicts
   - **Solution:** Use `--force` or remove existing file
   - **Verification:** Fresh package.json created

#### Step 1.1.2: Install Core Dependencies

```bash
# Core dependencies
pnpm add commander.js@12.1.1 \
  better-sqlite3@11.3.0 \
  @modelcontextprotocol/sdk@1.0.0 \
  chalk@5.3.0 \
  ora@8.0.1 \
  cli-table3@0.6.5 \
  zod@3.23.8 \
  uuid@10.0.0
```

**Potential Problems:**
1. better-sqlite3 compilation failure
   - **Solution:** Install build tools first
     - Windows: `npm install -g windows-build-tools`
     - macOS: `xcode-select --install`
     - Linux: `sudo apt-get install build-essential`
   - **Fallback:** Use `better-sqlite3` prebuilt binaries
   - **Verification:** `node -e "require('better-sqlite3')"` succeeds

2. Package version conflicts
   - **Solution:** Use exact versions, run `pnpm install --force`
   - **Verification:** `pnpm list` shows no peer dependency warnings

3. Network issues during install
   - **Solution:** Use `pnpm install --retry 3`
   - **Verification:** All packages in node_modules

#### Step 1.1.3: Install Dev Dependencies

```bash
# Dev dependencies
pnpm add -D typescript@5.5.4 \
  tsup@8.2.4 \
  vitest@2.1.1 \
  @types/node@22.5.5 \
  @types/better-sqlite3@7.6.11 \
  eslint@9.10.0 \
  @typescript-eslint/eslint-plugin@8.5.0 \
  @typescript-eslint/parser@8.5.0 \
  prettier@3.3.3 \
  husky@9.1.6 \
  lint-staged@15.2.10 \
  @vitest/coverage-v8@2.1.1
```

**Potential Problems:**
1. TypeScript version conflicts
   - **Solution:** Use exact version, check compatibility
   - **Verification:** `tsc --version` shows 5.5.4

2. Vitest compatibility issues
   - **Solution:** Use Vitest 2.x with Node 18+
   - **Verification:** `pnpm test` runs without errors

3. ESLint config issues
   - **Solution:** Use flat config format
   - **Verification:** `pnpm lint` runs without errors

#### Step 1.1.4: Configure TypeScript

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "allowSyntheticDefaultImports": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "paths": {
      "@/*": ["./src/*"]
    },
    "baseUrl": "."
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

**Potential Problems:**
1. Path alias conflicts
   - **Solution:** Use `@/*` pattern, configure in tsup
   - **Verification:** `tsc --noEmit` passes

2. Strict mode issues
   - **Solution:** Fix all type errors before proceeding
   - **Verification:** No `any` types in core modules

3. Module resolution issues
   - **Solution:** Use `bundler` resolution for tsup
   - **Verification:** `tsc --noEmit` passes

#### Step 1.1.5: Configure tsup

```typescript
// tsup.config.ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/cli/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  minify: false,
  target: 'node18',
  outDir: 'dist',
  external: ['better-sqlite3'],
  noExternal: [],
  banner: {
    js: '#!/usr/bin/env node',
  },
});
```

**Potential Problems:**
1. better-sqlite3 bundling issues
   - **Solution:** Mark as external, handle in build
   - **Verification:** `pnpm build` succeeds

2. ESM/CJS compatibility
   - **Solution:** Generate both formats, test both
   - **Verification:** Both formats work

3. Missing banner in output
   - **Solution:** Add hashbang banner
   - **Verification:** `dist/cli/index.js` starts with `#!/usr/bin/env node`

#### Step 1.1.6: Configure Vitest

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'tests/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/index.ts',
      ],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
    setupFiles: ['./tests/setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

**Potential Problems:**
1. Coverage thresholds too high initially
   - **Solution:** Start with 50%, increase gradually
   - **Verification:** `pnpm test:coverage` passes

2. Setup file issues
   - **Solution:** Create minimal setup file
   - **Verification:** Tests run without setup errors

3. Path alias resolution
   - **Solution:** Configure in vitest config
   - **Verification:** Tests can import from `@/`

#### Step 1.1.7: Create Directory Structure

```bash
# Create all directories
mkdir -p bin
mkdir -p src/cli/commands
mkdir -p src/cli/utils
mkdir -p src/core
mkdir -p src/capture
mkdir -p src/inject
mkdir -p src/mcp
mkdir -p src/types
mkdir -p tests/unit
mkdir -p tests/integration
mkdir -p tests/fixtures
```

**Potential Problems:**
1. Windows path issues
   - **Solution:** Use forward slashes, test on Windows
   - **Verification:** All directories created

2. Permission issues
   - **Solution:** Check permissions, use sudo if needed
   - **Verification:** `ls -la` shows correct permissions

#### Step 1.1.8: Create Entry Point

```javascript
// bin/cli.js
#!/usr/bin/env node

const { main } = require('../dist/cli/index.js');

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

**Potential Problems:**
1. Missing hashbang
   - **Solution:** Add `#!/usr/bin/env node`
   - **Verification:** `chmod +x bin/cli.js`

2. Wrong path to dist
   - **Solution:** Use relative path from bin/
   - **Verification:** `node bin/cli.js --help` works

#### Step 1.1.9: Configure package.json

```json
{
  "name": "coster",
  "version": "1.0.0",
  "description": "Universal context persistence layer for AI coding assistants",
  "type": "module",
  "main": "./dist/cli/index.js",
  "bin": {
    "coster": "./bin/cli.js"
  },
  "exports": {
    ".": {
      "import": "./dist/cli/index.js",
      "require": "./dist/cli/index.cjs"
    }
  },
  "scripts": {
    "dev": "tsup --watch",
    "build": "tsup",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "lint": "eslint src --ext .ts",
    "lint:fix": "eslint src --ext .ts --fix",
    "format": "prettier --write 'src/**/*.ts'",
    "typecheck": "tsc --noEmit",
    "prepare": "husky"
  },
  "keywords": [
    "ai",
    "coding",
    "context",
    "persistence",
    "mcp",
    "claude",
    "cursor",
    "copilot"
  ],
  "author": "Coster Team",
  "license": "MIT",
  "engines": {
    "node": ">=18.0.0"
  },
  "files": [
    "dist",
    "bin"
  ]
}
```

**Potential Problems:**
1. Missing "type": "module"
   - **Solution:** Add for ESM support
   - **Verification:** `node -e "import('./dist/cli/index.js')"`

2. Wrong bin path
   - **Solution:** Point to bin/cli.js
   - **Verification:** `npm link` then `coster --help`

3. Missing files field
   - **Solution:** Include dist and bin
   - **Verification:** `npm pack` includes correct files

#### Step 1.1.10: Configure ESLint

```javascript
// eslint.config.js
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/explicit-function-return-type': 'warn',
      'no-console': 'warn',
    },
  },
  {
    ignores: ['dist/', 'node_modules/', 'tests/'],
  }
);
```

**Potential Problems:**
1. ESLint flat config issues
   - **Solution:** Use new flat config format
   - **Verification:** `pnpm lint` runs

2. Strict rules blocking development
   - **Solution:** Start with warnings, increase to errors
   - **Verification:** No errors in src/

#### Step 1.1.11: Configure Prettier

```json
// .prettierrc
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "bracketSpacing": true,
  "arrowParens": "always"
}
```

**Potential Problems:**
1. Conflicting with ESLint
   - **Solution:** Use `eslint-config-prettier`
   - **Verification:** No conflicts

#### Step 1.1.12: Configure Husky

```bash
# Initialize husky
npx husky init

# Create pre-commit hook
echo "pnpm lint-staged" > .husky/pre-commit
```

```json
// package.json (add)
{
  "lint-staged": {
    "*.ts": ["eslint --fix", "prettier --write"],
    "*.json": ["prettier --write"]
  }
}
```

**Potential Problems:**
1. Husky not working in CI
   - **Solution:** Skip in CI with `HUSKY=0`
   - **Verification:** Hooks work locally

#### Step 1.1.13: Create .gitignore

```gitignore
# Dependencies
node_modules/

# Build output
dist/

# Coverage
coverage/

# IDE
.vscode/
.idea/

# OS
.DS_Store
Thumbs.db

# Coster
.coster/

# Logs
*.log
npm-debug.log*
```

**Potential Problems:**
1. .coster/ not ignored
   - **Solution:** Add to .gitignore
   - **Verification:** `git status` doesn't show .coster/

### Verification Checklist for Sub-Phase 1.1

- [ ] `pnpm dev` runs without errors
- [ ] `pnpm build` generates dist/
- [ ] `pnpm test` runs (even if no tests yet)
- [ ] `pnpm lint` runs without errors
- [ ] `pnpm typecheck` passes
- [ ] `node bin/cli.js --help` shows help
- [ ] All directories exist
- [ ] All config files are valid

---

## 3. Sub-Phase 1.2: Type Definitions

### Goal
Complete type definitions with no `any` types in core modules.

### Step-by-Step Plan

#### Step 1.2.1: Create Memory Types

```typescript
// src/types/memory.ts
import { z } from 'zod';

// Memory categories with lifecycle
export const MemoryCategorySchema = z.enum([
  'preference',      // User preferences (permanent)
  'convention',      // Project conventions (long-lived)
  'decision',        // Architectural decisions (permanent)
  'investigation',   // Active investigations (until resolved)
  'workaround',      // Bug workarounds (until fixed)
  'recap',           // Session summaries (30-day TTL)
  'mistake',         // Mistake log (permanent)
]);

export type MemoryCategory = z.infer<typeof MemoryCategorySchema>;

// Memory source
export const MemorySourceSchema = z.enum([
  'git-hook',
  'shell-hook',
  'manual',
  'auto',
]);

export type MemorySource = z.infer<typeof MemorySourceSchema>;

// Memory schema
export const MemorySchema = z.object({
  id: z.string().uuid(),
  category: MemoryCategorySchema,
  content: z.string().min(1).max(10000),
  importance: z.number().min(0).max(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  accessedAt: z.string().datetime(),
  accessCount: z.number().int().min(0),
  tags: z.array(z.string()),
  source: MemorySourceSchema,
  metadata: z.record(z.unknown()).optional(),
});

export type Memory = z.infer<typeof MemorySchema>;

// Memory creation (without id)
export const CreateMemorySchema = MemorySchema.omit({ id: true });
export type CreateMemory = z.infer<typeof CreateMemorySchema>;

// Memory update (partial)
export const UpdateMemorySchema = MemorySchema.partial().required({ id: true });
export type UpdateMemory = z.infer<typeof UpdateMemorySchema>;
```

**Potential Problems:**
1. UUID validation failing
   - **Solution:** Use proper UUID format, test with valid UUIDs
   - **Verification:** `z.string().uuid().parse('550e8400-e29b-41d4-a716-446655440000')` works

2. Date validation issues
   - **Solution:** Use ISO 8601 format
   - **Verification:** `new Date().toISOString()` is valid

3. Zod version compatibility
   - **Solution:** Pin zod version, test schema
   - **Verification:** All schemas parse correctly

#### Step 1.2.2: Create Context Types

```typescript
// src/types/context.ts
import { z } from 'zod';
import { MemorySchema } from './memory';

// Stack detection
export const StackInfoSchema = z.object({
  language: z.string(),
  framework: z.string(),
  buildSystem: z.string(),
  packageManager: z.string(),
  testFramework: z.string(),
});

export type StackInfo = z.infer<typeof StackInfoSchema>;

// Session
export const SessionSchema = z.object({
  id: z.string().uuid(),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime().optional(),
  summary: z.string().optional(),
  filesChanged: z.array(z.string()),
  decisionsMade: z.array(z.string()),
});

export type Session = z.infer<typeof SessionSchema>;

// Project context
export const ProjectContextSchema = z.object({
  path: z.string(),
  name: z.string(),
  stack: StackInfoSchema,
  memories: z.array(MemorySchema),
  sessions: z.array(SessionSchema),
  lastUpdated: z.string().datetime(),
});

export type ProjectContext = z.infer<typeof ProjectContextSchema>;
```

**Potential Problems:**
1. Nested schema validation
   - **Solution:** Test nested objects thoroughly
   - **Verification:** Complex objects parse correctly

2. Optional fields
   - **Solution:** Use `.optional()` consistently
   - **Verification:** Missing optional fields don't fail

#### Step 1.2.3: Create Config Types

```typescript
// src/types/config.ts
import { z } from 'zod';

// Tool configuration
export const ToolConfigSchema = z.object({
  name: z.string(),
  enabled: z.boolean(),
  exportPath: z.string(),
  tokenBudget: z.number().int().min(1000).max(100000),
});

export type ToolConfig = z.infer<typeof ToolConfigSchema>;

// Quality configuration
export const QualityConfigSchema = z.object({
  minScore: z.number().min(0).max(7),
  maxTokens: z.number().int().min(50).max(1000),
  autoCleanup: z.boolean(),
});

export type QualityConfig = z.infer<typeof QualityConfigSchema>;

// Lifecycle configuration
export const LifecycleConfigSchema = z.object({
  recapTTL: z.number().int().min(1).max(365),
  investigationTTL: z.number().int().min(1).max(365),
  workaroundTTL: z.number().int().min(1).max(365),
  autoArchive: z.boolean(),
});

export type LifecycleConfig = z.infer<typeof LifecycleConfigSchema>;

// Main config
export const CosterConfigSchema = z.object({
  version: z.number().int().min(1),
  created_at: z.string().datetime(),
  project: z.object({
    name: z.string(),
    path: z.string(),
  }),
  tools: z.array(ToolConfigSchema),
  quality: QualityConfigSchema,
  lifecycle: LifecycleConfigSchema,
});

export type CosterConfig = z.infer<typeof CosterConfigSchema>;

// Default config
export const defaultConfig: CosterConfig = {
  version: 1,
  created_at: new Date().toISOString(),
  project: {
    name: '',
    path: '',
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
```

**Potential Problems:**
1. Default config validation
   - **Solution:** Test default config parses correctly
   - **Verification:** `CosterConfigSchema.parse(defaultConfig)` succeeds

2. Token budget validation
   - **Solution:** Set reasonable min/max bounds
   - **Verification:** Invalid budgets fail validation

#### Step 1.2.4: Create Index File

```typescript
// src/types/index.ts
export * from './memory';
export * from './context';
export * from './config';
```

### Verification Checklist for Sub-Phase 1.2

- [ ] All types compile without errors
- [ ] All Zod schemas parse valid data
- [ ] All Zod schemas reject invalid data
- [ ] No `any` types in type files
- [ ] All types are exported correctly
- [ ] `tsc --noEmit` passes

---

## 4. Sub-Phase 1.3: SQLite Storage Layer

### Goal
Robust SQLite storage with CRUD, FTS5, WAL mode, and backups.

### Step-by-Step Plan

#### Step 1.3.1: Create Storage Class

```typescript
// src/core/storage.ts
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { Memory, MemoryCategory, CreateMemory, Session } from '../types';

export class Storage {
  private db: Database.Database;
  private dbPath: string;
  private backupDir: string;

  constructor(projectPath: string) {
    this.dbPath = path.join(projectPath, '.coster', 'coster.db');
    this.backupDir = path.join(projectPath, '.coster', 'backups');
    this.ensureDirectory();
    this.db = this.openDatabase();
    this.initialize();
  }

  private ensureDirectory(): void {
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private openDatabase(): Database.Database {
    try {
      const db = new Database(this.dbPath);
      return db;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to open database: ${error.message}`);
      }
      throw error;
    }
  }

  private initialize(): void {
    // Enable WAL mode for better performance
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
    `);

    // Create FTS5 table for search
    this.createFTS5();
  }

  private createFTS5(): void {
    // Check if FTS5 is available
    const fts5Available = this.db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='memories_fts'"
    ).get();

    if (!fts5Available) {
      try {
        this.db.exec(`
          CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
            content,
            category,
            tags,
            content=memories,
            content_rowid=rowid
          );
        `);

        // Create triggers for FTS sync
        this.db.exec(`
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
      } catch (error) {
        console.warn('FTS5 not available, using LIKE search as fallback');
      }
    }
  }

  // CRUD Operations
  createMemory(memory: CreateMemory): Memory {
    const id = uuidv4();
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO memories (id, category, content, importance, created_at, updated_at, accessed_at, access_count, tags, source, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      memory.category,
      memory.content,
      memory.importance,
      now,
      now,
      now,
      0,
      JSON.stringify(memory.tags),
      memory.source,
      JSON.stringify(memory.metadata || {})
    );

    return this.getMemory(id)!;
  }

  getMemory(id: string): Memory | null {
    const row = this.db.prepare('SELECT * FROM memories WHERE id = ?').get(id) as any;
    
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      category: row.category,
      content: row.content,
      importance: row.importance,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      accessedAt: row.accessed_at,
      accessCount: row.access_count,
      tags: JSON.parse(row.tags),
      source: row.source,
      metadata: JSON.parse(row.metadata),
    };
  }

  updateMemory(id: string, updates: Partial<Memory>): Memory | null {
    const existing = this.getMemory(id);
    if (!existing) {
      return null;
    }

    const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };

    const stmt = this.db.prepare(`
      UPDATE memories 
      SET category = ?, content = ?, importance = ?, updated_at = ?, tags = ?, source = ?, metadata = ?
      WHERE id = ?
    `);

    stmt.run(
      updated.category,
      updated.content,
      updated.importance,
      updated.updatedAt,
      JSON.stringify(updated.tags),
      updated.source,
      JSON.stringify(updated.metadata || {}),
      id
    );

    return this.getMemory(id);
  }

  deleteMemory(id: string): boolean {
    const result = this.db.prepare('DELETE FROM memories WHERE id = ?').run(id);
    return result.changes > 0;
  }

  getAllMemories(category?: MemoryCategory): Memory[] {
    let query = 'SELECT * FROM memories';
    const params: any[] = [];

    if (category) {
      query += ' WHERE category = ?';
      params.push(category);
    }

    query += ' ORDER BY updated_at DESC';

    const rows = this.db.prepare(query).all(...params) as any[];
    
    return rows.map(row => ({
      id: row.id,
      category: row.category,
      content: row.content,
      importance: row.importance,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      accessedAt: row.accessed_at,
      accessCount: row.access_count,
      tags: JSON.parse(row.tags),
      source: row.source,
      metadata: JSON.parse(row.metadata),
    }));
  }

  // Search
  searchMemories(query: string, category?: MemoryCategory): Memory[] {
    // Try FTS5 first
    try {
      return this.searchWithFTS5(query, category);
    } catch {
      // Fallback to LIKE search
      return this.searchWithLIKE(query, category);
    }
  }

  private searchWithFTS5(query: string, category?: MemoryCategory): Memory[] {
    let sql = `
      SELECT m.* FROM memories m
      JOIN memories_fts fts ON m.rowid = fts.rowid
      WHERE memories_fts MATCH ?
    `;
    const params: any[] = [query];

    if (category) {
      sql += ' AND m.category = ?';
      params.push(category);
    }

    sql += ' ORDER BY rank LIMIT 50';

    const rows = this.db.prepare(sql).all(...params) as any[];
    
    return rows.map(row => ({
      id: row.id,
      category: row.category,
      content: row.content,
      importance: row.importance,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      accessedAt: row.accessed_at,
      accessCount: row.access_count,
      tags: JSON.parse(row.tags),
      source: row.source,
      metadata: JSON.parse(row.metadata),
    }));
  }

  private searchWithLIKE(query: string, category?: MemoryCategory): Memory[] {
    let sql = 'SELECT * FROM memories WHERE content LIKE ?';
    const params: any[] = [`%${query}%`];

    if (category) {
      sql += ' AND category = ?';
      params.push(category);
    }

    sql += ' ORDER BY updated_at DESC LIMIT 50';

    const rows = this.db.prepare(sql).all(...params) as any[];
    
    return rows.map(row => ({
      id: row.id,
      category: row.category,
      content: row.content,
      importance: row.importance,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      accessedAt: row.accessed_at,
      accessCount: row.access_count,
      tags: JSON.parse(row.tags),
      source: row.source,
      metadata: JSON.parse(row.metadata),
    }));
  }

  // Session operations
  createSession(session: Session): void {
    const stmt = this.db.prepare(`
      INSERT INTO sessions (id, started_at, ended_at, summary, files_changed, decisions_made)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      session.id,
      session.startedAt,
      session.endedAt || null,
      session.summary || null,
      JSON.stringify(session.filesChanged),
      JSON.stringify(session.decisionsMade)
    );
  }

  // Backup
  backup(): string {
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(this.backupDir, `coster-${timestamp}.db`);

    this.db.backup(backupPath);

    return backupPath;
  }

  // Cleanup
  getExpiredMemories(): Memory[] {
    const now = new Date();
    const memories = this.getAllMemories();
    
    return memories.filter(memory => {
      const updatedAt = new Date(memory.updatedAt);
      const daysSinceUpdate = Math.floor((now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60 * 24));

      switch (memory.category) {
        case 'recap':
          return daysSinceUpdate > 30;
        case 'investigation':
          return daysSinceUpdate > 90;
        case 'workaround':
          return daysSinceUpdate > 90;
        default:
          return false;
      }
    });
  }

  archiveMemories(ids: string[]): void {
    const stmt = this.db.prepare('DELETE FROM memories WHERE id = ?');
    
    const deleteMany = this.db.transaction((ids: string[]) => {
      for (const id of ids) {
        stmt.run(id);
      }
    });

    deleteMany(ids);
  }

  // Close
  close(): void {
    this.db.close();
  }
}
```

**Potential Problems:**
1. Database file locked
   - **Solution:** Ensure proper close, handle busy timeout
   - **Verification:** Multiple operations don't fail

2. FTS5 not available
   - **Solution:** Fallback to LIKE search
   - **Verification:** Search works with or without FTS5

3. WAL mode issues
   - **Solution:** Check SQLite version, handle gracefully
   - **Verification:** Write operations succeed

4. JSON parsing errors
   - **Solution:** Validate JSON before parsing, handle errors
   - **Verification:** Corrupted JSON doesn't crash

5. Memory leaks from unclosed databases
   - **Solution:** Implement proper close, use try/finally
   - **Verification:** No memory leaks in tests

6. Backup failures
   - **Solution:** Check disk space, handle permissions
   - **Verification:** Backup creates valid file

#### Step 1.3.2: Create Storage Tests

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
    // Clean up and create test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testDir, { recursive: true });
    fs.mkdirSync(path.join(testDir, '.coster'), { recursive: true });
    storage = new Storage(testDir);
  });

  afterEach(() => {
    storage.close();
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('createMemory', () => {
    it('should create a memory with all fields', () => {
      const memory = storage.createMemory({
        category: 'convention',
        content: 'Use 2-space indentation',
        importance: 0.8,
        tags: ['style', 'indentation'],
        source: 'manual',
      });

      expect(memory).toBeDefined();
      expect(memory.id).toBeDefined();
      expect(memory.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      expect(memory.category).toBe('convention');
      expect(memory.content).toBe('Use 2-space indentation');
      expect(memory.importance).toBe(0.8);
      expect(memory.tags).toEqual(['style', 'indentation']);
      expect(memory.source).toBe('manual');
    });

    it('should set timestamps correctly', () => {
      const before = new Date().toISOString();
      const memory = storage.createMemory({
        category: 'convention',
        content: 'Test memory',
        importance: 0.5,
        tags: [],
        source: 'manual',
      });
      const after = new Date().toISOString();

      expect(memory.createdAt >= before).toBe(true);
      expect(memory.createdAt <= after).toBe(true);
      expect(memory.updatedAt).toBe(memory.createdAt);
      expect(memory.accessedAt).toBe(memory.createdAt);
      expect(memory.accessCount).toBe(0);
    });

    it('should handle empty tags', () => {
      const memory = storage.createMemory({
        category: 'convention',
        content: 'Test memory',
        importance: 0.5,
        tags: [],
        source: 'manual',
      });

      expect(memory.tags).toEqual([]);
    });
  });

  describe('getMemory', () => {
    it('should retrieve a memory by id', () => {
      const created = storage.createMemory({
        category: 'convention',
        content: 'Test memory',
        importance: 0.5,
        tags: [],
        source: 'manual',
      });

      const retrieved = storage.getMemory(created.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.content).toBe('Test memory');
    });

    it('should return null for non-existent id', () => {
      const retrieved = storage.getMemory('non-existent-id');
      expect(retrieved).toBeNull();
    });
  });

  describe('updateMemory', () => {
    it('should update memory fields', () => {
      const created = storage.createMemory({
        category: 'convention',
        content: 'Original content',
        importance: 0.5,
        tags: [],
        source: 'manual',
      });

      const updated = storage.updateMemory(created.id, {
        content: 'Updated content',
        importance: 0.9,
      });

      expect(updated).toBeDefined();
      expect(updated?.content).toBe('Updated content');
      expect(updated?.importance).toBe(0.9);
      expect(updated?.updatedAt).not.toBe(created.updatedAt);
    });

    it('should return null for non-existent id', () => {
      const updated = storage.updateMemory('non-existent-id', {
        content: 'Updated',
      });
      expect(updated).toBeNull();
    });
  });

  describe('deleteMemory', () => {
    it('should delete a memory', () => {
      const created = storage.createMemory({
        category: 'convention',
        content: 'To be deleted',
        importance: 0.5,
        tags: [],
        source: 'manual',
      });

      const deleted = storage.deleteMemory(created.id);
      expect(deleted).toBe(true);

      const retrieved = storage.getMemory(created.id);
      expect(retrieved).toBeNull();
    });

    it('should return false for non-existent id', () => {
      const deleted = storage.deleteMemory('non-existent-id');
      expect(deleted).toBe(false);
    });
  });

  describe('searchMemories', () => {
    it('should search by content', () => {
      storage.createMemory({
        category: 'convention',
        content: 'Use TypeScript strict mode',
        importance: 0.8,
        tags: ['typescript'],
        source: 'manual',
      });

      storage.createMemory({
        category: 'convention',
        content: 'Use functional components',
        importance: 0.7,
        tags: ['react'],
        source: 'manual',
      });

      const results = storage.searchMemories('TypeScript');
      expect(results).toHaveLength(1);
      expect(results[0].content).toContain('TypeScript');
    });

    it('should filter by category', () => {
      storage.createMemory({
        category: 'convention',
        content: 'Convention memory',
        importance: 0.5,
        tags: [],
        source: 'manual',
      });

      storage.createMemory({
        category: 'decision',
        content: 'Decision memory',
        importance: 0.5,
        tags: [],
        source: 'manual',
      });

      const results = storage.searchMemories('memory', 'convention');
      expect(results).toHaveLength(1);
      expect(results[0].category).toBe('convention');
    });
  });

  describe('getAllMemories', () => {
    it('should return all memories', () => {
      storage.createMemory({
        category: 'convention',
        content: 'Memory 1',
        importance: 0.5,
        tags: [],
        source: 'manual',
      });

      storage.createMemory({
        category: 'decision',
        content: 'Memory 2',
        importance: 0.5,
        tags: [],
        source: 'manual',
      });

      const all = storage.getAllMemories();
      expect(all).toHaveLength(2);
    });

    it('should filter by category', () => {
      storage.createMemory({
        category: 'convention',
        content: 'Convention',
        importance: 0.5,
        tags: [],
        source: 'manual',
      });

      storage.createMemory({
        category: 'decision',
        content: 'Decision',
        importance: 0.5,
        tags: [],
        source: 'manual',
      });

      const conventions = storage.getAllMemories('convention');
      expect(conventions).toHaveLength(1);
      expect(conventions[0].category).toBe('convention');
    });
  });

  describe('backup', () => {
    it('should create a backup file', () => {
      storage.createMemory({
        category: 'convention',
        content: 'Test backup',
        importance: 0.5,
        tags: [],
        source: 'manual',
      });

      const backupPath = storage.backup();
      expect(fs.existsSync(backupPath)).toBe(true);
    });
  });

  describe('getExpiredMemories', () => {
    it('should identify expired recaps', () => {
      const memory = storage.createMemory({
        category: 'recap',
        content: 'Old recap',
        importance: 0.3,
        tags: [],
        source: 'manual',
      });

      // Manually set old timestamp
      storage.updateMemory(memory.id, {
        updatedAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString(),
      });

      const expired = storage.getExpiredMemories();
      expect(expired).toHaveLength(1);
      expect(expired[0].id).toBe(memory.id);
    });
  });
});
```

**Potential Problems:**
1. Test isolation issues
   - **Solution:** Clean up before/after each test
   - **Verification:** Tests don't interfere with each other

2. Timing issues in tests
   - **Solution:** Use fixed dates or tolerances
   - **Verification:** Tests pass consistently

3. File system cleanup
   - **Solution:** Always clean up test directories
   - **Verification:** No leftover test files

### Verification Checklist for Sub-Phase 1.3

- [ ] Can create memory
- [ ] Can retrieve memory by id
- [ ] Can update memory
- [ ] Can delete memory
- [ ] Can search memories with FTS5
- [ ] Can search memories with LIKE fallback
- [ ] Can list all memories
- [ ] Can filter by category
- [ ] Can backup database
- [ ] Can identify expired memories
- [ ] WAL mode is enabled
- [ ] All tests pass

---

## 5. Sub-Phase 1.4: Quality Gate

### Goal
7-rule quality gate with scoring and deduplication.

### Step-by-Step Plan

#### Step 1.4.1: Create Quality Gate Class

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
    const genericPhrases = [
      'good code',
      'best practices',
      'write better',
      'code well',
      'do good',
      'be better',
      'improve quality',
      'write clean',
      'follow standards',
      'use common sense',
    ];
    
    const lowerContent = content.toLowerCase();
    return !genericPhrases.some(phrase => lowerContent.includes(phrase));
  }

  private checkActionability(content: string): boolean {
    const actionVerbs = [
      'run',
      'use',
      'prefer',
      'avoid',
      'check',
      'update',
      'create',
      'delete',
      'modify',
      'implement',
      'follow',
      'ensure',
      'always',
      'never',
      'must',
      'should',
      'use 2-space',
      'use tabs',
      'format with',
      'lint with',
      'test with',
    ];
    
    const lowerContent = content.toLowerCase();
    return actionVerbs.some(verb => lowerContent.includes(verb));
  }

  private checkCurrency(updatedAt: string): boolean {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return new Date(updatedAt) > thirtyDaysAgo;
  }

  private checkUniqueness(memory: Memory, existing: Memory[]): boolean {
    if (existing.length === 0) {
      return true;
    }

    return !existing.some(e => 
      this.calculateSimilarity(memory.content, e.content) > 0.8
    );
  }

  private checkEvidence(memory: Memory): boolean {
    const evidenceMarkers = [
      'git blame',
      'file:',
      'commit',
      'issue #',
      'pr #',
      'pull request',
      'link:',
      'reference:',
      'based on',
      'according to',
      'see ',
      'ref:',
    ];
    
    const lowerContent = memory.content.toLowerCase();
    const hasMarkers = evidenceMarkers.some(marker => lowerContent.includes(marker));
    const isGitHook = memory.source === 'git-hook';
    
    return hasMarkers || isGitHook;
  }

  private checkRelevance(memory: Memory): boolean {
    const relevantCategories = ['decision', 'workaround', 'investigation'];
    if (relevantCategories.includes(memory.category)) {
      return true;
    }

    // For other categories, check importance
    return memory.importance >= 0.5;
  }

  private checkConciseness(content: string): boolean {
    // Approximate token count (1 token ≈ 4 characters)
    const tokenCount = Math.ceil(content.length / 4);
    return tokenCount <= 200;
  }

  private calculateSimilarity(a: string, b: string): number {
    // Simple Jaccard similarity
    const setA = new Set(a.toLowerCase().split(/\s+/));
    const setB = new Set(b.toLowerCase().split(/\s+/));
    const intersection = new Set([...setA].filter(x => setB.has(x)));
    const union = new Set([...setA, ...setB]);
    
    if (union.size === 0) {
      return 0;
    }
    
    return intersection.size / union.size;
  }
}
```

**Potential Problems:**
1. Similarity detection too aggressive
   - **Solution:** Use 0.8 threshold, tune if needed
   - **Verification:** Similar memories are detected

2. Actionability detection too strict
   - **Solution:** Include common patterns
   - **Verification:** Actionable memories pass

3. Evidence detection too strict
   - **Solution:** Include git-hook source as evidence
   - **Verification:** Git-hook memories pass

#### Step 1.4.2: Create Quality Gate Tests

```typescript
// tests/unit/quality.test.ts
import { describe, it, expect } from 'vitest';
import { QualityGate } from '../../src/core/quality';
import { Memory } from '../../src/types';

describe('QualityGate', () => {
  const qualityGate = new QualityGate(4);

  const createMemory = (overrides: Partial<Memory> = {}): Memory => ({
    id: '550e8400-e29b-41d4-a716-446655440000',
    category: 'convention',
    content: 'Use 2-space indentation',
    importance: 0.8,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    accessedAt: new Date().toISOString(),
    accessCount: 0,
    tags: [],
    source: 'manual',
    ...overrides,
  });

  describe('evaluate', () => {
    it('should pass high-quality memory', () => {
      const memory = createMemory({
        category: 'decision',
        content: 'Chose PostgreSQL over MySQL for better JSON support. git blame shows commit abc123.',
        importance: 0.9,
        source: 'git-hook',
      });

      const result = qualityGate.evaluate(memory, []);
      expect(result.passed).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(4);
      expect(result.reasons.length).toBe(7);
    });

    it('should reject low-quality memory', () => {
      const memory = createMemory({
        category: 'preference',
        content: 'Write good code',
        importance: 0.1,
        source: 'manual',
      });

      const result = qualityGate.evaluate(memory, []);
      expect(result.passed).toBe(false);
      expect(result.score).toBeLessThan(4);
    });

    it('should detect duplicates', () => {
      const existing = createMemory({
        id: 'existing-id',
        content: 'Use 2-space indentation',
      });

      const newMemory = createMemory({
        id: 'new-id',
        content: 'Use 2-space indentation',
      });

      const result = qualityGate.evaluate(newMemory, [existing]);
      expect(result.reasons).toContain('Duplicate');
    });

    it('should accept unique memories', () => {
      const existing = createMemory({
        id: 'existing-id',
        content: 'Use 2-space indentation',
      });

      const newMemory = createMemory({
        id: 'new-id',
        content: 'Use functional components in React',
      });

      const result = qualityGate.evaluate(newMemory, [existing]);
      expect(result.reasons).toContain('Unique');
    });

    it('should check currency', () => {
      const oldMemory = createMemory({
        updatedAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString(),
      });

      const result = qualityGate.evaluate(oldMemory, []);
      expect(result.reasons).toContain('Outdated');
    });

    it('should check evidence', () => {
      const memoryWithEvidence = createMemory({
        content: 'Use TypeScript. See file: src/types.ts',
      });

      const result = qualityGate.evaluate(memoryWithEvidence, []);
      expect(result.reasons).toContain('Has evidence');
    });

    it('should check conciseness', () => {
      const verboseMemory = createMemory({
        content: 'x'.repeat(1000),
      });

      const result = qualityGate.evaluate(verboseMemory, []);
      expect(result.reasons).toContain('Too verbose');
    });
  });

  describe('custom minScore', () => {
    it('should respect custom threshold', () => {
      const strictGate = new QualityGate(7);
      const memory = createMemory({
        category: 'decision',
        content: 'Chose PostgreSQL. git blame shows commit abc123.',
        importance: 0.9,
        source: 'git-hook',
      });

      const result = strictGate.evaluate(memory, []);
      // May or may not pass depending on all rules
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(7);
    });
  });
});
```

**Potential Problems:**
1. Test flakiness due to randomness
   - **Solution:** Use deterministic test data
   - **Verification:** Tests pass consistently

2. Edge cases not covered
   - **Solution:** Add more edge case tests
   - **Verification:** All edge cases handled

### Verification Checklist for Sub-Phase 1.4

- [ ] Quality gate evaluates all 7 rules
- [ ] Scoring is consistent and deterministic
- [ ] Deduplication works correctly
- [ ] Pass/fail threshold is configurable
- [ ] All tests pass
- [ ] No false positives/negatives

---

## 6. Sub-Phase 1.5: CLI Foundation

### Goal
Working CLI with init, capture, search, and list commands.

### Step-by-Step Plan

#### Step 1.5.1: Create CLI Entry Point

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

// Parse arguments
program.parse();
```

**Potential Problems:**
1. Missing hashbang
   - **Solution:** Add via tsup banner
   - **Verification:** File starts with `#!/usr/bin/env node`

2. Command registration issues
   - **Solution:** Import and register each command
   - **Verification:** `coster --help` shows all commands

#### Step 1.5.2: Create Init Command

```typescript
// src/cli/commands/init.ts
import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { CosterConfig, defaultConfig } from '../../types';

export function initCommand(program: Command): void {
  program
    .command('init')
    .description('Initialize Coster in the current project')
    .option('-f, --force', 'Force initialization (overwrite existing)')
    .option('-n, --name <name>', 'Project name')
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
        const dirs = [
          costerDir,
          path.join(costerDir, 'memories'),
          path.join(costerDir, 'sessions'),
          path.join(costerDir, 'exports'),
          path.join(costerDir, 'hooks'),
          path.join(costerDir, 'cache'),
          path.join(costerDir, 'backups'),
        ];

        for (const dir of dirs) {
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
        }

        // Create config
        const config: CosterConfig = {
          ...defaultConfig,
          created_at: new Date().toISOString(),
          project: {
            name: options.name || path.basename(projectPath),
            path: projectPath,
          },
        };

        fs.writeFileSync(
          path.join(costerDir, 'config.json'),
          JSON.stringify(config, null, 2)
        );

        // Create schema
        const schema = {
          version: 1,
          created_at: new Date().toISOString(),
          features: ['mcp', 'hooks', 'quality_gate'],
        };

        fs.writeFileSync(
          path.join(costerDir, 'schema.json'),
          JSON.stringify(schema, null, 2)
        );

        // Create .gitignore entry
        const gitignorePath = path.join(projectPath, '.gitignore');
        if (fs.existsSync(gitignorePath)) {
          const content = fs.readFileSync(gitignorePath, 'utf-8');
          if (!content.includes('.coster/')) {
            fs.appendFileSync(gitignorePath, '\n# Coster\n.coster/\n');
          }
        }

        spinner.succeed(chalk.green('Coster initialized successfully!'));
        console.log(chalk.cyan('\nNext steps:'));
        console.log('  1. Run `coster capture --text "Your first memory"`');
        console.log('  2. Run `coster search "query"` to search memories');
        console.log('  3. Run `coster sync` to generate tool-specific files');

      } catch (error) {
        spinner.fail(chalk.red('Failed to initialize Coster'));
        console.error(error);
        process.exit(1);
      }
    });
}
```

**Potential Problems:**
1. Permission denied creating directories
   - **Solution:** Check permissions, provide helpful error
   - **Verification:** Directories created successfully

2. Config file already exists
   - **Solution:** Check for --force flag
   - **Verification:** Overwrite only with --force

3. .gitignore doesn't exist
   - **Solution:** Create if not exists, or skip
   - **Verification:** .gitignore updated correctly

#### Step 1.5.3: Create Capture Command

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
    .option('--no-quality', 'Skip quality gate')
    .action(async (options) => {
      const spinner = ora('Capturing memory...').start();

      try {
        // Validate category
        const validCategories: MemoryCategory[] = [
          'preference', 'convention', 'decision', 
          'investigation', 'workaround', 'recap', 'mistake'
        ];
        
        if (!validCategories.includes(options.category)) {
          spinner.fail(chalk.red(`Invalid category: ${options.category}`));
          console.log(chalk.yellow('Valid categories:', validCategories.join(', ')));
          return;
        }

        // Validate importance
        const importance = parseFloat(options.importance);
        if (isNaN(importance) || importance < 0 || importance > 1) {
          spinner.fail(chalk.red('Importance must be between 0 and 1'));
          return;
        }

        const storage = new Storage(process.cwd());
        const qualityGate = new QualityGate();

        // Create memory object
        const memory: Omit<Memory, 'id'> = {
          category: options.category as MemoryCategory,
          content: options.text,
          importance,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          accessedAt: new Date().toISOString(),
          accessCount: 0,
          tags: options.tags ? options.tags.split(',').map((t: string) => t.trim()) : [],
          source: options.source as Memory['source'],
        };

        // Evaluate quality
        if (options.quality !== false) {
          const existingMemories = storage.getAllMemories();
          const qualityResult = qualityGate.evaluate(
            { ...memory, id: 'temp' } as Memory,
            existingMemories
          );

          if (!qualityResult.passed) {
            spinner.fail(chalk.red('Memory rejected by quality gate'));
            console.log(chalk.yellow('Score:', qualityResult.score, '/ 7'));
            console.log(chalk.gray('Reasons:', qualityResult.reasons.join(', ')));
            console.log(chalk.cyan('\nUse --no-quality to bypass the quality gate.'));
            storage.close();
            return;
          }

          spinner.text = `Quality score: ${qualityResult.score}/7`;
        }

        // Store memory
        const stored = storage.createMemory(memory);
        spinner.succeed(chalk.green('Memory captured successfully!'));
        console.log(chalk.cyan('ID:', stored.id));

        storage.close();

      } catch (error) {
        spinner.fail(chalk.red('Failed to capture memory'));
        console.error(error);
        process.exit(1);
      }
    });
}
```

**Potential Problems:**
1. Invalid category
   - **Solution:** Validate against enum values
   - **Verification:** Invalid categories are rejected

2. Invalid importance
   - **Solution:** Validate range 0-1
   - **Verification:** Out of range values are rejected

3. Quality gate bypass
   - **Solution:** Add --no-quality flag
   - **Verification:** Bypass works correctly

#### Step 1.5.4: Create Search Command

```typescript
// src/cli/commands/search.ts
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import cliTable from 'cli-table3';
import { Storage } from '../../core/storage';
import { MemoryCategory } from '../../types';

export function searchCommand(program: Command): void {
  program
    .command('search')
    .description('Search memories')
    .argument('<query>', 'Search query')
    .option('-c, --category <category>', 'Filter by category')
    .option('-l, --limit <limit>', 'Max results', '10')
    .option('--json', 'Output as JSON')
    .action(async (query, options) => {
      const spinner = ora('Searching memories...').start();

      try {
        const storage = new Storage(process.cwd());
        
        // Validate category if provided
        if (options.category) {
          const validCategories: MemoryCategory[] = [
            'preference', 'convention', 'decision', 
            'investigation', 'workaround', 'recap', 'mistake'
          ];
          
          if (!validCategories.includes(options.category)) {
            spinner.fail(chalk.red(`Invalid category: ${options.category}`));
            console.log(chalk.yellow('Valid categories:', validCategories.join(', ')));
            storage.close();
            return;
          }
        }

        const results = storage.searchMemories(query, options.category);
        spinner.stop();

        if (results.length === 0) {
          console.log(chalk.yellow('No memories found.'));
          storage.close();
          return;
        }

        // Output as JSON if requested
        if (options.json) {
          console.log(JSON.stringify(results, null, 2));
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
        process.exit(1);
      }
    });
}
```

**Potential Problems:**
1. Empty query
   - **Solution:** Use required argument
   - **Verification:** Empty query is rejected

2. No results found
   - **Solution:** Show helpful message
   - **Verification:** User sees "No memories found"

3. JSON output format
   - **Solution:** Add --json flag
   - **Verification:** JSON output is valid

#### Step 1.5.5: Create List Command

```typescript
// src/cli/commands/list.ts
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import cliTable from 'cli-table3';
import { Storage } from '../../core/storage';
import { MemoryCategory } from '../../types';

export function listCommand(program: Command): void {
  program
    .command('list')
    .description('List all memories')
    .option('-c, --category <category>', 'Filter by category')
    .option('-l, --limit <limit>', 'Max results', '20')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      const spinner = ora('Listing memories...').start();

      try {
        const storage = new Storage(process.cwd());
        
        // Validate category if provided
        if (options.category) {
          const validCategories: MemoryCategory[] = [
            'preference', 'convention', 'decision', 
            'investigation', 'workaround', 'recap', 'mistake'
          ];
          
          if (!validCategories.includes(options.category)) {
            spinner.fail(chalk.red(`Invalid category: ${options.category}`));
            console.log(chalk.yellow('Valid categories:', validCategories.join(', ')));
            storage.close();
            return;
          }
        }

        const memories = storage.getAllMemories(options.category);
        spinner.stop();

        if (memories.length === 0) {
          console.log(chalk.yellow('No memories found.'));
          storage.close();
          return;
        }

        // Output as JSON if requested
        if (options.json) {
          console.log(JSON.stringify(memories, null, 2));
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
        process.exit(1);
      }
    });
}
```

**Potential Problems:**
1. Large number of memories
   - **Solution:** Implement pagination
   - **Verification:** Limit works correctly

2. Category filtering
   - **Solution:** Validate category
   - **Verification:** Filtering works

#### Step 1.5.6: Create CLI Tests

```typescript
// tests/unit/cli.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

describe('CLI Commands', () => {
  const testDir = path.join(__dirname, '../fixtures/cli-test');
  const cliPath = path.join(__dirname, '../../bin/cli.js');

  beforeEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should show help', () => {
    const output = execSync(`node ${cliPath} --help`, { encoding: 'utf-8' });
    expect(output).toContain('coster');
    expect(output).toContain('init');
    expect(output).toContain('capture');
    expect(output).toContain('search');
    expect(output).toContain('list');
  });

  it('should initialize project', () => {
    execSync(`node ${cliPath} init`, { cwd: testDir, encoding: 'utf-8' });
    expect(fs.existsSync(path.join(testDir, '.coster'))).toBe(true);
    expect(fs.existsSync(path.join(testDir, '.coster', 'config.json'))).toBe(true);
  });

  it('should capture memory', () => {
    execSync(`node ${cliPath} init`, { cwd: testDir, encoding: 'utf-8' });
    const output = execSync(
      `node ${cliPath} capture --text "Test memory" --no-quality`,
      { cwd: testDir, encoding: 'utf-8' }
    );
    expect(output).toContain('Memory captured successfully');
  });

  it('should list memories', () => {
    execSync(`node ${cliPath} init`, { cwd: testDir, encoding: 'utf-8' });
    execSync(
      `node ${cliPath} capture --text "Test memory" --no-quality`,
      { cwd: testDir, encoding: 'utf-8' }
    );
    const output = execSync(`node ${cliPath} list`, { cwd: testDir, encoding: 'utf-8' });
    expect(output).toContain('Test memory');
  });
});
```

### Verification Checklist for Sub-Phase 1.5

- [ ] `coster --help` shows all commands
- [ ] `coster init` creates .coster/ directory
- [ ] `coster init --force` overwrites existing
- [ ] `coster capture --text "..."` stores memory
- [ ] `coster capture --no-quality` bypasses quality gate
- [ ] `coster search "query"` returns results
- [ ] `coster list` shows all memories
- [ ] `coster list --category convention` filters
- [ ] `coster list --json` outputs JSON
- [ ] All CLI tests pass

---

## 7. Sub-Phase 1.6: Unit Tests

### Goal
80%+ test coverage with all tests passing.

### Step-by-Step Plan

#### Step 1.6.1: Create Test Setup

```typescript
// tests/setup.ts
import { afterAll, beforeEach } from 'vitest';

// Global test setup
afterAll(() => {
  // Clean up any test artifacts
  console.log('Test suite completed');
});
```

#### Step 1.6.2: Create Test Fixtures

```typescript
// tests/fixtures/index.ts
import { Memory, Session, CosterConfig } from '../../src/types';
import { v4 as uuidv4 } from 'uuid';

export const createTestMemory = (overrides: Partial<Memory> = {}): Memory => ({
  id: uuidv4(),
  category: 'convention',
  content: 'Test memory content',
  importance: 0.5,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  accessedAt: new Date().toISOString(),
  accessCount: 0,
  tags: ['test'],
  source: 'manual',
  ...overrides,
});

export const createTestSession = (overrides: Partial<Session> = {}): Session => ({
  id: uuidv4(),
  startedAt: new Date().toISOString(),
  filesChanged: ['src/index.ts'],
  decisionsMade: ['Use TypeScript'],
  ...overrides,
});

export const createTestConfig = (overrides: Partial<CosterConfig> = {}): CosterConfig => ({
  version: 1,
  created_at: new Date().toISOString(),
  project: {
    name: 'test-project',
    path: '/tmp/test',
  },
  tools: [
    { name: 'claude-code', enabled: true, exportPath: 'CLAUDE.md', tokenBudget: 17000 },
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
  ...overrides,
});
```

#### Step 1.6.3: Create Integration Tests

```typescript
// tests/integration/e2e.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { Storage } from '../../src/core/storage';

describe('End-to-End', () => {
  const testDir = path.join(__dirname, '../fixtures/e2e-test');
  const cliPath = path.join(__dirname, '../../bin/cli.js');

  beforeEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should complete full workflow', () => {
    // Initialize
    execSync(`node ${cliPath} init`, { cwd: testDir, encoding: 'utf-8' });
    
    // Capture memories
    execSync(
      `node ${cliPath} capture --text "Use 2-space indentation" --category convention --importance 0.8`,
      { cwd: testDir, encoding: 'utf-8' }
    );
    
    execSync(
      `node ${cliPath} capture --text "Use TypeScript strict mode" --category convention --importance 0.9`,
      { cwd: testDir, encoding: 'utf-8' }
    );
    
    execSync(
      `node ${cliPath} capture --text "Chose PostgreSQL" --category decision --importance 1.0`,
      { cwd: testDir, encoding: 'utf-8' }
    );
    
    // Search
    const searchOutput = execSync(
      `node ${cliPath} search "TypeScript"`,
      { cwd: testDir, encoding: 'utf-8' }
    );
    expect(searchOutput).toContain('TypeScript');
    
    // List
    const listOutput = execSync(
      `node ${cliPath} list`,
      { cwd: testDir, encoding: 'utf-8' }
    );
    expect(listOutput).toContain('Use 2-space indentation');
    expect(listOutput).toContain('Chose PostgreSQL');
    
    // List by category
    const categoryOutput = execSync(
      `node ${cliPath} list --category decision`,
      { cwd: testDir, encoding: 'utf-8' }
    );
    expect(categoryOutput).toContain('Chose PostgreSQL');
    expect(categoryOutput).not.toContain('Use 2-space indentation');
  });
});
```

#### Step 1.6.4: Run Coverage

```bash
# Run tests with coverage
pnpm test:coverage

# Check coverage thresholds
# Should pass with >80% coverage
```

**Potential Problems:**
1. Coverage thresholds too high
   - **Solution:** Start with 70%, increase gradually
   - **Verification:** Coverage report shows >80%

2. Flaky tests
   - **Solution:** Use deterministic data, avoid timing issues
   - **Verification:** Tests pass consistently

3. Slow tests
   - **Solution:** Optimize database operations, use in-memory SQLite
   - **Verification:** Tests run in <10 seconds

### Verification Checklist for Sub-Phase 1.6

- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] Test coverage > 80%
- [ ] No flaky tests
- [ ] Tests run in <10 seconds
- [ ] Test fixtures are clean

---

## 8. Problem Registry

### Critical Problems (Must Solve)

| # | Problem | Impact | Solution | Verification |
|---|---------|--------|----------|--------------|
| 1 | better-sqlite3 compilation fails | High | Use prebuilt binaries, install build tools | `node -e "require('better-sqlite3')"` works |
| 2 | FTS5 not available | High | Fallback to LIKE search | Search works with both methods |
| 3 | Path handling on Windows | Medium | Use path module consistently | Test on Windows |
| 4 | Memory leaks from unclosed DB | Medium | Implement proper close, use try/finally | No memory leaks in tests |
| 5 | UUID collisions | Low | Use v4 UUID, validate uniqueness | No duplicate IDs |

### Medium Problems (Should Solve)

| # | Problem | Impact | Solution | Verification |
|---|---------|--------|----------|--------------|
| 6 | Config file corruption | Medium | Validate on load, backup before write | Corrupted config is detected |
| 7 | Database locked errors | Medium | Handle busy timeout, use WAL mode | Concurrent operations work |
| 8 | Large memory performance | Low | Add pagination, optimize queries | List works with 1000+ memories |
| 9 | Quality gate too strict | Low | Tune thresholds, add bypass flag | --no-quality works |
| 10 | CLI startup slow | Low | Optimize imports, lazy load | Startup <100ms |

### Low Problems (Nice to Solve)

| # | Problem | Impact | Solution | Verification |
|---|---------|--------|----------|--------------|
| 11 | Missing error messages | Low | Add helpful error messages | Errors are informative |
| 12 | No color support | Low | Detect terminal capabilities | Colors work in terminal |
| 13 | No progress indicators | Low | Add ora spinners | Spinners work |
| 14 | No JSON output | Low | Add --json flag | JSON output works |
| 15 | No completion scripts | Low | Add bash/zsh completion | Completion works |

---

## 9. Verification Checklist

### Final Phase 1 Verification

- [ ] Project scaffolding complete
- [ ] All dependencies installed
- [ ] TypeScript compiles without errors
- [ ] All tests pass
- [ ] Test coverage > 80%
- [ ] CLI works end-to-end
- [ ] SQLite storage works
- [ ] FTS5 search works
- [ ] Quality gate works
- [ ] Documentation complete

### Manual Testing Script

```bash
# 1. Initialize
coster init
ls -la .coster/

# 2. Capture memories
coster capture --text "Use 2-space indentation" --category convention --importance 0.8
coster capture --text "Use TypeScript strict mode" --category convention --importance 0.9
coster capture --text "Chose PostgreSQL over MySQL" --category decision --importance 1.0
coster capture --text "Memory leak workaround in auth module" --category workaround --importance 0.7
coster capture --text "Investigating performance issue in dashboard" --category investigation --importance 0.6

# 3. Search
coster search "TypeScript"
coster search "PostgreSQL" --category decision
coster search "memory" --json

# 4. List
coster list
coster list --category convention
coster list --limit 5

# 5. Check quality gate
coster capture --text "Write good code" --category preference
# Should be rejected

# 6. Bypass quality gate
coster capture --text "Write good code" --category preference --no-quality
# Should be accepted

# 7. Check database
sqlite3 .coster/coster.db "SELECT * FROM memories;"
```

---

**Document Version:** 1.0
**Last Updated:** August 16, 2026
**Author:** Coster Phase 1 Planning Team
