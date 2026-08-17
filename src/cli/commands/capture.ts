import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { Storage } from '../../core/storage.js';
import { QualityGate } from '../../core/quality.js';
import { Memory, MemoryCategory, Session } from '../../types/index.js';
import {
  readGitCommit,
  readGitCheckout,
  parseCostDirective,
  isGitRepo,
  readDiffStats,
  signalRichPolicy,
  classifyCommit,
} from '../../capture/git.js';
import { parseTranscript } from '../../capture/transcript.js';
import { parseShellLog } from '../../capture/shell.js';
import { summarizeMergedPrs } from '../../capture/pr.js';
import { syncAfterCapture } from '../utils/sync.js';
import { loadConfig } from '../../core/config.js';

const SILENT = process.env.COSTER_SILENT === '1';

function ensureSession(storage: Storage): Session {
  const active = storage.getActiveSession();
  if (active) {
    return active;
  }
  const session: Session = {
    id: uuidv4(),
    startedAt: new Date().toISOString(),
    filesChanged: [],
    decisionsMade: [],
  };
  storage.createSession(session);
  return session;
}

function nowIso(): string {
  return new Date().toISOString();
}

export function captureCommand(program: Command): void {
  const capture = program
    .command('capture')
    .description('Capture a new memory/context')
    .option('-t, --text <text>', 'Memory content')
    .option('-c, --category <category>', 'Memory category', 'convention')
    .option('-i, --importance <importance>', 'Importance score (0-1)', '0.5')
    .option('-s, --source <source>', 'Memory source', 'manual')
    .option('--tags <tags>', 'Comma-separated tags', '')
    .option('--no-quality', 'Skip quality gate')
    .action(async (options) => {
      if (!options.text) {
        console.log('Error: --text is required for manual capture. Use `coster capture commit` for git hooks.');
        process.exitCode = 1;
        return;
      }
      await manualCapture(options);
    });

  capture
    .command('commit')
    .description('Auto-capture from the latest git commit (called by post-commit hook)')
    .action(async () => {
      try {
        const projectPath = process.cwd();
        if (!isGitRepo(projectPath)) {
          if (!SILENT) console.log('Not a git repository; skipping commit capture.');
          return;
        }

        const commit = readGitCommit(projectPath);
        if (!commit) {
          if (!SILENT) console.log('No commit found; skipping.');
          return;
        }

        const storage = await Storage.create(projectPath);
        const session = ensureSession(storage);
        storage.updateSession(session.id, { filesChanged: commit.files });

        const directive = parseCostDirective(commit.message);
        if (directive) {
          await captureDirectedMemory(storage, projectPath, directive.category, directive.content, commit.hash);
        } else {
          const config = loadConfig(projectPath);
          if (config.capture.commitPolicy.enabled) {
            const stats = readDiffStats(projectPath, false);
            if (signalRichPolicy(commit, stats, config.capture.commitPolicy)) {
              const cls = classifyCommit(commit, stats);
              await captureDirectedMemory(storage, projectPath, cls.category, cls.content, commit.hash, cls.importance);
            } else if (!SILENT) {
              console.log(`Commit ${commit.hash.substring(0, 8)} not signal-rich; skipping auto-capture.`);
            }
          }
        }

        syncAfterCapture(storage, projectPath);
        storage.close();
      } catch (error) {
        if (!SILENT) console.error('Failed to capture commit:', error);
      }
    });

  capture
    .command('checkout')
    .description('Record branch checkout (called by post-checkout hook)')
    .action(async () => {
      try {
        const projectPath = process.cwd();
        if (!isGitRepo(projectPath)) {
          return;
        }

        const checkout = readGitCheckout(projectPath);
        if (!checkout) {
          return;
        }

        const storage = await Storage.create(projectPath);
        const session = ensureSession(storage);
        storage.updateSession(session.id, {
          decisionsMade: [`checkout:${checkout.to}`],
          summary: `On branch ${checkout.to}`,
        });
        storage.close();
      } catch {
        // swallow — never block git
      }
    });

  capture
    .command('prepare-msg')
    .description('Append a cost: trailer to the commit message when signal-rich (opt-in; enable hooks.prepareCommitMsg)')
    .argument('<msgfile>')
    .action(async (msgfile: string) => {
      try {
        const projectPath = process.cwd();
        if (!isGitRepo(projectPath)) return;
        const config = loadConfig(projectPath);
        if (!config.hooks.prepareCommitMsg) return;

        const msgPath = path.resolve(projectPath, msgfile);
        if (!fs.existsSync(msgPath)) return;
        let msg = fs.readFileSync(msgPath, 'utf-8');
        if (/^cost:[a-z]+:/im.test(msg)) return;

        const commit = readGitCommit(projectPath);
        if (!commit) return;
        const stats = readDiffStats(projectPath, true);
        const pseudoCommit = { ...commit, message: msg };
        if (!signalRichPolicy(pseudoCommit, stats, config.capture.commitPolicy)) return;

        const cls = classifyCommit(pseudoCommit, stats);
        const subject = msg.split('\n')[0].trim();
        const trailer = `\ncost:${cls.category}: ${subject}`;
        msg = msg.replace(/\s*$/, '') + trailer + '\n';
        fs.writeFileSync(msgPath, msg);
      } catch {
        // swallow — never block git
      }
    });

  capture
    .command('import')
    .description('Import memories from an exported agent conversation (Claude jsonl / OpenCode json / text)')
    .argument('<path>')
    .option('--tool <tool>', 'Transcript source: claude | opencode | auto', 'auto')
    .action(async (filePath: string, options) => {
      try {
        const projectPath = process.cwd();
        const config = loadConfig(projectPath);
        const abs = path.resolve(projectPath, filePath);
        if (!fs.existsSync(abs)) {
          console.error(`File not found: ${abs}`);
          process.exitCode = 1;
          return;
        }

        const candidates = parseTranscript(abs, options.tool);
        const storage = await Storage.create(projectPath);
        const added = storeCandidates(storage, candidates, config.quality.minScore);
        if (added > 0) syncAfterCapture(storage, projectPath);
        storage.close();

        if (!SILENT) console.log(`Imported ${added} memories from ${path.basename(abs)}.`);
      } catch (error) {
        console.error('Failed to import transcript:', error);
        process.exitCode = 1;
      }
    });

  capture
    .command('pr')
    .description('Capture memories from recently merged PRs (via the user\'s gh CLI)')
    .option('--limit <n>', 'Max PRs to ingest', '20')
    .action(async (options) => {
      try {
        const projectPath = process.cwd();
        const config = loadConfig(projectPath);
        if (!config.capture.pr.enabled) {
          if (!SILENT) console.log('PR capture disabled. Enable with: coster config set capture.pr.enabled true');
          return;
        }
        const limit = parseInt(options.limit, 10) || config.capture.pr.limit;
        const storage = await Storage.create(projectPath);
        let candidates: ReturnType<typeof summarizeMergedPrs> = [];
        try {
          candidates = summarizeMergedPrs(projectPath, limit);
        } catch (e: any) {
          if (!SILENT) console.log(`PR capture skipped: ${e?.message ?? e}`);
          storage.close();
          return;
        }
        const added = storeCandidates(storage, candidates, config.quality.minScore);
        if (added > 0) syncAfterCapture(storage, projectPath);
        storage.close();

        if (!SILENT) console.log(`Captured ${added} memories from merged PRs.`);
      } catch (error) {
        console.error('Failed to capture PRs:', error);
        process.exitCode = 1;
      }
    });

  capture
    .command('shell')
    .description('Capture memories from the shell command log (enable with coster hooks install --shell)')
    .action(async () => {
      try {
        const projectPath = process.cwd();
        const config = loadConfig(projectPath);
        if (!config.capture.shell.enabled && !config.hooks.shell) {
          if (!SILENT) console.log('Shell capture disabled. Enable with: coster hooks install --shell');
          return;
        }
        const logPath =
          process.env.COSTER_SHELL_LOG || path.join(os.homedir(), '.coster-shell.log');
        if (!fs.existsSync(logPath)) {
          if (!SILENT) console.log('No shell log found.');
          return;
        }
        const candidates = parseShellLog(logPath);
        const storage = await Storage.create(projectPath);
        const added = storeCandidates(storage, candidates, config.quality.minScore);
        if (added > 0) syncAfterCapture(storage, projectPath);
        storage.close();

        if (!SILENT) console.log(`Captured ${added} memories from shell history.`);
      } catch (error) {
        console.error('Failed to capture shell history:', error);
        process.exitCode = 1;
      }
    });
}

interface CandidateInput {
  category: MemoryCategory;
  content: string;
  importance: number;
  tags: string[];
  source: Memory['source'];
  metadata?: Record<string, unknown>;
}

function storeCandidates(storage: Storage, candidates: CandidateInput[], minScore: number): number {
  const now = nowIso();
  const qualityGate = new QualityGate(minScore);
  let added = 0;
  for (const c of candidates) {
    const existing = storage.getAllMemories();
    const probe: Memory = {
      id: '00000000-0000-0000-0000-000000000000',
      category: c.category,
      content: c.content,
      importance: c.importance,
      createdAt: now,
      updatedAt: now,
      accessedAt: now,
      accessCount: 0,
      tags: c.tags,
      source: c.source,
      metadata: c.metadata ?? {},
    } as Memory;
    const result = qualityGate.evaluate(probe, existing);
    if (!result.passed) continue;
    storage.createMemory({
      category: c.category,
      content: c.content,
      importance: c.importance,
      createdAt: now,
      updatedAt: now,
      accessedAt: now,
      accessCount: 0,
      tags: c.tags,
      source: c.source,
      metadata: c.metadata ?? {},
    });
    added++;
  }
  return added;
}

async function captureDirectedMemory(
  storage: Storage,
  projectPath: string,
  category: MemoryCategory,
  content: string,
  commitHash: string,
  importance = 0.8
): Promise<void> {
  const now = nowIso();
  const memory: Omit<Memory, 'id'> = {
    category,
    content,
    importance,
    createdAt: now,
    updatedAt: now,
    accessedAt: now,
    accessCount: 0,
    tags: ['git-commit'],
    source: 'git-hook',
    metadata: { commit: commitHash },
  };

  const qualityGate = new QualityGate();
  const existing = storage.getAllMemories();
  const result = qualityGate.evaluate(
    { ...memory, id: '00000000-0000-0000-0000-000000000000' } as Memory,
    existing
  );

  if (!result.passed) {
    if (!SILENT) {
      console.log('Commit memory rejected by quality gate:');
      console.log('Score:', result.score, '/ 7');
      console.log('Reasons:', result.reasons.join(', '));
    }
    return;
  }

  const stored = storage.createMemory(memory);
  if (!SILENT) console.log(`Captured memory from commit: ${stored.id}`);
}

async function manualCapture(options: any): Promise<void> {
  try {
    const validCategories: MemoryCategory[] = [
      'preference', 'convention', 'decision',
      'investigation', 'workaround', 'recap', 'mistake',
    ];

    if (!validCategories.includes(options.category)) {
      console.log(`Invalid category: ${options.category}`);
      console.log('Valid categories:', validCategories.join(', '));
      return;
    }

    const importance = parseFloat(options.importance);
    if (isNaN(importance) || importance < 0 || importance > 1) {
      console.log('Importance must be between 0 and 1');
      return;
    }

    const storage = await Storage.create(process.cwd());
    const qualityGate = new QualityGate();

    const memory: Omit<Memory, 'id'> = {
      category: options.category as MemoryCategory,
      content: options.text,
      importance,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      accessedAt: nowIso(),
      accessCount: 0,
      tags: options.tags ? options.tags.split(',').map((t: string) => t.trim()) : [],
      source: options.source as Memory['source'],
    };

    if (options.quality !== false) {
      const existingMemories = storage.getAllMemories();
      const qualityResult = qualityGate.evaluate(
        { ...memory, id: '00000000-0000-0000-0000-000000000000' } as Memory,
        existingMemories
      );

      if (!qualityResult.passed) {
        console.log('Memory rejected by quality gate');
        console.log('Score:', qualityResult.score, '/ 7');
        console.log('Reasons:', qualityResult.reasons.join(', '));
        console.log('\nUse --no-quality to bypass the quality gate.');
        storage.close();
        return;
      }

      console.log('Quality score:', qualityResult.score, '/ 7');
    }

    const stored = storage.createMemory(memory);
    console.log('Memory captured successfully!');
    console.log('ID:', stored.id);

    syncAfterCapture(storage, process.cwd());
    storage.close();
  } catch (error) {
    console.error('Failed to capture memory:', error);
    process.exitCode = 1;
  }
}
