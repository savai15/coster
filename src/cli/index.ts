import { Command } from 'commander';
import { printError } from './utils/output.js';
import { initCommand } from './commands/init.js';
import { captureCommand } from './commands/capture.js';
import { searchCommand } from './commands/search.js';
import { listCommand } from './commands/list.js';
import { syncCommand } from './commands/sync.js';
import { restoreCommand } from './commands/restore.js';
import { hooksCommand } from './commands/hooks.js';
import { sessionCommand } from './commands/session.js';
import { cleanupCommand } from './commands/cleanup.js';
import { mcpCommand } from './commands/mcp.js';
import { configCommand } from './commands/config.js';
import { statusCommand } from './commands/status.js';
import { statsCommand } from './commands/stats.js';
import { memoryCommand } from './commands/memory.js';

const program = new Command();

program
  .name('coster')
  .description('Universal context persistence layer for AI coding assistants')
  .version('1.0.0');

initCommand(program);
captureCommand(program);
searchCommand(program);
listCommand(program);
syncCommand(program);
restoreCommand(program);
hooksCommand(program);
sessionCommand(program);
cleanupCommand(program);
mcpCommand(program);
configCommand(program);
statusCommand(program);
statsCommand(program);
memoryCommand(program);

async function main(): Promise<void> {
  try {
    await program.parseAsync(process.argv);
  } catch (err) {
    // A command already printed a user-facing error and set the exit code;
    // this is a last-resort handler for unexpected failures.
    printError(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  }
}

main();
