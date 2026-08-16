import { Command } from 'commander';
import { v4 as uuidv4 } from 'uuid';
import { Storage } from '../../core/storage.js';
import { QualityGate } from '../../core/quality.js';
import { Memory, MemoryCategory, Session } from '../../types/index.js';
import { readGitCommit, readGitCheckout, parseCostDirective, isGitRepo } from '../../capture/git.js';

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
          const memory: Omit<Memory, 'id'> = {
            category: directive.category,
            content: directive.content,
            importance: 0.8,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            accessedAt: new Date().toISOString(),
            accessCount: 0,
            tags: ['git-commit'],
            source: 'git-hook',
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
          } else {
            const stored = storage.createMemory(memory);
            if (!SILENT) console.log(`Captured memory from commit: ${stored.id}`);
          }
        } else if (!SILENT) {
          console.log(`Recorded commit ${commit.hash.substring(0, 8)} in session ${session.id.substring(0, 8)}`);
        }

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
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      accessedAt: new Date().toISOString(),
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

    storage.close();
  } catch (error) {
        console.error('Failed to capture memory:', error);
        process.exitCode = 1;
  }
}
