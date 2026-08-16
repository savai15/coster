import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import { CosterConfig, defaultConfig } from '../../types/index.js';
import { Storage } from '../../core/storage.js';
import { generateExports } from '../../core/export.js';
import { installHooks, uninstallHooks } from './hooks.js';
import { detectActiveTool } from '../../inject/detect.js';
import { backfillMemories } from '../../core/backfill.js';
import { isGitRepo } from '../../capture/git.js';

const SILENT = process.env.COSTER_SILENT === '1';

function log(message: string): void {
  if (!SILENT) {
    console.log(message);
  }
}

export function initCommand(program: Command): void {
  program
    .command('init')
    .description('Initialize Coster in the current project')
    .option('-f, --force', 'Force initialization (overwrite existing)')
    .option('-n, --name <name>', 'Project name')
    .option('--auto', 'One-command bootstrap: detect tool, install hooks, sync, and backfill')
    .option('--shell', 'Also install a shell hook for ambient capture')
    .option('--tool <id>', 'Override the detected AI tool to sync for')
    .option('--backfill-limit <n>', 'Max commits to scan during backfill', '200')
    .action(async (options) => {
      try {
        const projectPath = process.cwd();
        const costerDir = path.join(projectPath, '.coster');

        if (fs.existsSync(costerDir) && !options.force) {
          log('Coster already initialized. Use --force to overwrite.');
          if (options.auto) {
            await runAuto(options, projectPath);
          }
          return;
        }

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

        const schema = {
          version: 1,
          created_at: new Date().toISOString(),
          features: ['mcp', 'hooks', 'quality_gate'],
        };

        fs.writeFileSync(
          path.join(costerDir, 'schema.json'),
          JSON.stringify(schema, null, 2)
        );

        const gitignorePath = path.join(projectPath, '.gitignore');
        if (fs.existsSync(gitignorePath)) {
          const content = fs.readFileSync(gitignorePath, 'utf-8');
          if (!content.includes('.coster/')) {
            fs.appendFileSync(gitignorePath, '\n# Coster\n.coster/\n');
          }
        }

        log('Coster initialized successfully!');

        if (options.auto) {
          await runAuto(options, projectPath);
        } else {
          log('\nNext steps:');
          log('  1. Run `coster capture --text "Your first memory"`');
          log('  2. Run `coster search "query"` to search memories');
          log('  3. Run `coster sync` to generate tool-specific files');
        }
      } catch (error) {
        console.error('Failed to initialize Coster:', error);
        process.exitCode = 1;
      }
    });
}

async function runAuto(options: any, projectPath: string): Promise<void> {
  const git = isGitRepo(projectPath);
  const detected = detectActiveTool(projectPath);
  const tool = options.tool || detected;

  log(`\nBootstrap:`);
  log(`  Git repo:        ${git ? 'yes' : 'no'}`);
  log(`  Detected tool:   ${detected ?? 'none'}`);
  log(`  Target tool:     ${tool ?? 'none (skipping sync)'}`);

  if (git) {
    const result = installHooks(projectPath, { shell: !!options.shell, force: true });
    const parts: string[] = [];
    if (result.git) parts.push('git');
    if (result.shell) parts.push('shell');
    if (parts.length > 0) {
      log(`  Hooks:           installed (${parts.join(', ')}) -> ${result.hooksDir}`);
    } else {
      log('  Hooks:           none installed');
    }
  } else {
    log('  Hooks:           skipped (no git repo)');
  }

  const storage = await Storage.create(projectPath);
  try {
    if (tool) {
      generateExports(storage, projectPath, { toolFilter: tool });
      log(`  Sync:            generated ${tool} memory file`);
    } else {
      log('  Sync:            skipped (no tool detected)');
    }

    if (git) {
      const limit = parseInt(options.backfillLimit, 10) || 200;
      const created = backfillMemories(storage, projectPath, limit);
      log(`  Backfill:        imported ${created} memory(ies) from git history`);
    } else {
      log('  Backfill:        skipped (no git repo)');
    }
  } finally {
    await storage.close();
  }

  log('\nDone. Your AI assistant now has persistent context via Coster.');
}
