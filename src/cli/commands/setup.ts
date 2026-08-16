import { Command } from 'commander';
import { runBootstrap } from './init.js';

/**
 * `coster setup` — interactive wizard that bootstraps the project.
 * Mirrors plain `coster init` but is the friendlier, discoverable entry point.
 */
export function setupCommand(program: Command): void {
  program
    .command('setup')
    .description('Interactive setup wizard (initialize Coster for this project)')
    .option('--minimal', 'Create config + hooks but skip tool-file generation', false)
    .option('--tool <tool>', 'Target AI assistant (claude-code, opencode, cursor, ...)')
    .action(async (options) => {
      await runBootstrap(options, false);
    });
}
