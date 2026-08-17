import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import os from 'os';
import readline from 'readline';
import { Storage } from '../../core/storage.js';
import { saveConfig } from '../../core/config.js';
import { generateExports } from '../../core/export.js';
import { detectActiveTool } from '../../inject/detect.js';
import { TOOL_REGISTRY } from '../../inject/registry.js';
import { isGitRepo } from '../../capture/git.js';
import { printInfo, printError } from '../utils/output.js';
import { installHooks } from './hooks.js';
import { registerMcp } from './mcp.js';

const SILENT = process.env.COSTER_SILENT === '1';

function isInteractive(): boolean {
  return Boolean(process.stdin.isTTY) && !SILENT;
}

function promptToolSelection(): Promise<string | null> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const tools = Object.keys(TOOL_REGISTRY).filter((t) => t !== 'coster');
    printInfo('Which AI coding assistant will use this project?');
    printInfo('(Coster also keeps a portable COSTER.md that any tool can read.)');
    tools.forEach((t, i) => console.log(`  ${i + 1}. ${t}`));
    console.log(`  0. Skip (portable COSTER.md only)`);

    rl.question(`Select [1-${tools.length}] (default 1): `, (answer) => {
      rl.close();
      const n = parseInt(answer.trim(), 10);
      if (isNaN(n) || n === 0) return resolve(null);
      if (n >= 1 && n <= tools.length) return resolve(tools[n - 1]);
      resolve(null);
    });
  });
}

function applyToolSelection(config: any, tool: string | null): void {
  if (!tool) return;
  const target = config.tools.find((t: any) => t.name === tool);
  if (target) {
    config.tools = config.tools.map((t: any) =>
      t.name === 'coster' || t.name === tool ? t : { ...t, enabled: false }
    );
  }
}

export function initCommand(program: Command): void {
  const init = program
    .command('init')
    .description('Initialize Coster in the current project (auto-detects and bootstraps)')
    .option('--auto', 'Auto-detect tools and bootstrap (default behavior)', false)
    .option('--minimal', 'Create config + hooks but skip tool-file generation', false)
    .option('--tool <tool>', 'Target AI assistant (claude-code, opencode, cursor, ...)')
    .action(async (options) => {
      await runBootstrap(options, Boolean(options.auto));
    });

  init
    .command('auto')
    .description('Auto-detect tools and bootstrap (alias for plain init)')
    .option('--minimal', 'Create config + hooks but skip tool-file generation', false)
    .option('--tool <tool>', 'Target AI assistant (claude-code, opencode, cursor, ...)')
    .action(async (options) => {
      await runBootstrap(options, true);
    });
}

export async function runBootstrap(options: { minimal?: boolean; tool?: string }, fromAuto: boolean): Promise<void> {
  const projectPath = process.cwd();

  if (fs.existsSync(path.join(projectPath, '.coster'))) {
    printInfo('Coster is already initialized here. Run `coster sync` to refresh tool files.');
    return;
  }

  const pkgPath = path.join(projectPath, 'package.json');
  let projectName = path.basename(projectPath);
  try {
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      if (pkg.name) projectName = pkg.name;
    }
  } catch {
    // ignore
  }

  const config = {
    version: 1,
    created_at: new Date().toISOString(),
    project: { name: projectName, path: projectPath },
    tools: [
      { name: 'claude-code', enabled: true, exportPath: 'CLAUDE.md', tokenBudget: 17000 },
      { name: 'opencode', enabled: true, exportPath: 'AGENTS.md', tokenBudget: 15000 },
      { name: 'cursor', enabled: true, exportPath: '.cursorrules', tokenBudget: 12000 },
      { name: 'copilot', enabled: true, exportPath: '.github/copilot-instructions.md', tokenBudget: 8000 },
      { name: 'windsurf', enabled: true, exportPath: '.windsurf/rules/coster.md', tokenBudget: 10000 },
      { name: 'codex', enabled: true, exportPath: '.codex/memory.md', tokenBudget: 10000 },
      { name: 'cline', enabled: true, exportPath: '.clinerules', tokenBudget: 10000 },
      { name: 'continue', enabled: true, exportPath: '.continue/rules/coster.md', tokenBudget: 10000 },
      { name: 'kiro', enabled: true, exportPath: '.kiro/steering/coster.md', tokenBudget: 10000 },
      { name: 'coster', enabled: true, exportPath: 'COSTER.md', tokenBudget: 12000 },
    ],
    quality: { minScore: 4, maxTokens: 200, autoCleanup: true },
    lifecycle: { recapTTL: 30, investigationTTL: 90, workaroundTTL: 90, autoArchive: true, decayHalfLifeDays: 180, decayMinImportance: 0.2, consolidateSimilarity: 0.92 },
    hooks: { git: true, shell: false, postCommit: true, postCheckout: true, prepareCommitMsg: false },
    capture: {
      commitPolicy: {
        enabled: true,
        minDiffLines: 120,
        signalGlobs: [
          'CLAUDE.md',
          'AGENTS.md',
          '**/*.rules',
          '**/*.rule',
          '**/*.config.*',
          'package.json',
          'package-lock.json',
          'tsconfig*.json',
          '**/migrations/**',
          'Dockerfile',
          'Makefile',
          '.env*',
          '**/.cursorrules',
          '**/.windsurf/**',
          '**/.clinerules',
        ],
        fixKeywords: ['fix', 'bug', 'hotfix', 'workaround', 'revert', 'patch'],
      },
      shell: { enabled: false },
      pr: { enabled: false, limit: 20 },
    },
    autoInject: true,
    embeddings: {
      enabled: true,
      model: 'Xenova/bge-base-en-v1.5',
      dim: 768,
      modelDir: path.join(os.homedir(), '.coster', 'models'),
      autoBuild: true,
    },
    scheduler: {
      enabled: false,
      decayEveryHours: 24,
      archiveEveryHours: 24,
      consolidateEveryHours: 168,
    },
    injection: {
      mode: 'curated' as const,
      useSemantic: true,
      semanticWeight: 0.4,
      maxMemories: 200,
      proactive: true,
    },
  };

  // Determine target tool: explicit flag, detected file, or interactive prompt.
  let tool: string | null = options.tool || null;
  if (tool && !TOOL_REGISTRY[tool]) {
    printError(`Unknown tool: ${tool}`);
    printError(`Available: ${Object.keys(TOOL_REGISTRY).join(', ')}`);
    process.exitCode = 1;
    return;
  }

  if (!tool) {
    const detected = detectActiveTool(projectPath);
    if (detected) {
      tool = detected;
    } else if (isInteractive()) {
      tool = await promptToolSelection();
    }
  }

  if (tool) {
    applyToolSelection(config, tool);
    printInfo(`Targeting tool: ${tool}`);
  } else {
    printInfo('No specific tool selected — Coster will keep a portable COSTER.md.');
  }

  saveConfig(projectPath, config);

  const gitInstalled = installHooks(projectPath, {});
  if (gitInstalled) {
    printInfo('Installed git hooks (capture on commit/checkout).');
  }

  registerMcp(projectPath);

  if (options.minimal) {
    printInfo('Minimal init complete. Run `coster sync` to generate tool files later.');
    return;
  }

  const storage = await Storage.create(projectPath);
  try {
    if (fromAuto) {
      // (legacy flag path — same behavior as plain init)
    }

    // Always keep the portable COSTER.md up to date.
    generateExports(storage, projectPath, { toolFilter: 'coster' });
    printInfo('Generated COSTER.md (portable, tool-agnostic).');

    if (tool && tool !== 'coster') {
      generateExports(storage, projectPath, { toolFilter: tool });
      printInfo(`Generated ${tool} memory file.`);
    }

    if (isGitRepo(projectPath)) {
      const commits = backfillRecentCommits(storage, projectPath);
      if (commits > 0) {
        printInfo(`Backfilled ${commits} recent commit(s).`);
      }
    }

    printInfo('Coster is ready! Capture memories with:');
    printInfo('  coster note "decided to use X because Y"   (quick capture)');
    printInfo('  coster capture "explain context..."         (full capture)');
    printInfo('  coster memory add --text "..." --category decision');
  } finally {
    await storage.close();
  }
}

function backfillRecentCommits(storage: Storage, projectPath: string): number {
  let count = 0;
  try {
    const { execSync } = require('child_process');
    const log = execSync('git log --oneline -50', { cwd: projectPath, encoding: 'utf-8' }).trim();
    const lines = log ? log.split('\n') : [];
    for (const line of lines) {
      const match = line.match(/^(\w+)\s+(.*)$/);
      if (!match) continue;
      const message = match[2];
      if (!message) continue;

      // Only backfill commits that carry an explicit cost: directive so we don't
      // import every routine commit as noise.
      const directive = message.match(/cost:(\w+):\s*(.+)/i);
      if (!directive) continue;

      const category = directive[1].toLowerCase();
      const content = directive[2].trim();
      try {
        const existing = storage.searchMemories(content);
        if (existing.length > 0) continue;
        const id = storage.createMemory({
          category: ['decision', 'convention', 'workaround', 'investigation', 'preference', 'mistake', 'recap'].includes(category)
            ? (category as any)
            : 'decision',
          content,
          importance: 0.6,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          accessedAt: new Date().toISOString(),
          accessCount: 0,
          tags: ['git', 'commit', 'backfill'],
          source: 'auto',
          metadata: { commit: match[1] },
        });
        if (id) count++;
      } catch {
        // ignore individual failures
      }
    }
  } catch {
    // git not available / no history
  }
  return count;
}
