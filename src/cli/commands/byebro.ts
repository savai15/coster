import { Command } from 'commander';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { uninstallHooks } from './hooks.js';
import { stopDaemon, uninstallServiceCommand } from './daemon.js';
import { unregisterMcp } from './mcp.js';
import { resolveProjectPath } from '../utils/project.js';
import { printInfo, printSuccess, printError } from '../utils/output.js';

/**
 * `coster byebro` — completely remove Coster from a project.
 *
 * It tears down everything Coster owns: the local store (.coster/), git/shell
 * hooks, the MCP registration, the OS service, and any running daemon. It does
 * NOT touch the generated assistant tool files (AGENTS.md, CLAUDE.md,
 * .cursorrules, COSTER.md, …) — those are left exactly as they were, so the
 * project keeps working with whatever context was already written.
 */
export function byebroCommand(): Command {
  const cmd = new Command('byebro')
    .description('Remove Coster entirely from this project (keeps generated tool files untouched)')
    .option('-y, --yes', 'Confirm removal without the safety prompt')
    .option('--purge-global', 'Also delete the globally cached embedding model (~/.coster/models)')
    .action((options) => {
      try {
        const projectPath = resolveProjectPath();
        const costerDir = path.join(projectPath, '.coster');

        if (!fs.existsSync(costerDir) && !options.purgeGlobal) {
          printInfo('Coster is not initialized in this directory. Nothing to remove.');
          return;
        }

        if (!options.yes) {
          printInfo('This will remove Coster\'s data and integrations from this project.');
          printInfo('Generated tool files (AGENTS.md, CLAUDE.md, .cursorrules, …) are left as-is.');
          printInfo('Re-run with --yes to confirm: coster byebro --yes');
          return;
        }

        printInfo('Removing Coster from this project…');

        stopDaemon(projectPath);
        uninstallServiceCommand(projectPath);
        try {
          uninstallHooks(projectPath);
        } catch {
          /* best-effort */
        }
        try {
          unregisterMcp(projectPath);
        } catch {
          /* best-effort */
        }

        if (fs.existsSync(costerDir)) {
          fs.rmSync(costerDir, { recursive: true, force: true });
        }

        if (options.purgeGlobal) {
          const modelsDir = path.join(os.homedir(), '.coster', 'models');
          if (fs.existsSync(modelsDir)) {
            fs.rmSync(modelsDir, { recursive: true, force: true });
            printInfo('Removed cached embedding model.');
          }
        }

        printSuccess('Coster removed. Your generated tool files were left untouched.');
      } catch (err) {
        printError(err instanceof Error ? err.message : String(err));
        process.exitCode = 1;
      }
    });

  return cmd;
}
