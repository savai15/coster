import { Command } from 'commander';
import { Storage } from '../../core/storage.js';
import { generateExports } from '../../core/export.js';

const SILENT = process.env.COSTER_SILENT === '1';

export function syncCommand(program: Command): void {
  program
    .command('sync')
    .description('Sync memories to tool-specific files')
    .option('-t, --tool <tool>', 'Specific tool to sync (claude-code, opencode, cursor, copilot, windsurf, codex, cline, continue, kiro, all)', 'all')
    .option('--dry-run', 'Preview without writing files')
    .action(async (options) => {
      try {
        const projectPath = process.cwd();
        const storage = await Storage.create(projectPath);

        const results = generateExports(storage, projectPath, {
          toolFilter: options.tool === 'all' ? undefined : options.tool,
          dryRun: options.dryRun,
        });

        storage.close();

        if (results.length === 0) {
          if (!SILENT) console.log('No enabled tools to sync.');
          return;
        }

        for (const result of results) {
          if (options.dryRun) {
            if (!SILENT) {
              console.log(`\n--- ${result.tool} (${result.path}) ---\n`);
              console.log(result.content);
            }
          } else if (!SILENT) {
            console.log(`${result.tool} file generated: ${result.path}`);
          }
        }

      } catch (error) {
        console.error('Failed to sync memories:', error);
        process.exitCode = 1;
      }
    });
}
