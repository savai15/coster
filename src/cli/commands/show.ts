import { Command } from 'commander';
import { Storage } from '../../core/storage.js';
import { generateExports } from '../../core/export.js';
import { detectActiveTool } from '../../inject/detect.js';
import { TOOL_REGISTRY } from '../../inject/registry.js';
import { printError } from '../utils/output.js';

export function showCommand(program: Command): void {
  program
    .command('show [tool]')
    .description('Print the generated memory file for a tool (default: detected or COSTER.md)')
    .option('--dry', 'Show what would be generated without writing', false)
    .action(async (tool: string | undefined, options: { dry?: boolean }) => {
      const projectPath = process.cwd();
      let target = tool;

      if (!target) {
        const detected = detectActiveTool(projectPath);
        target = detected ?? 'coster';
      }

      if (!TOOL_REGISTRY[target]) {
        printError(`Unknown tool: ${target}`);
        printError(`Available: ${Object.keys(TOOL_REGISTRY).join(', ')}`);
        process.exitCode = 1;
        return;
      }

      try {
        const storage = await Storage.create(projectPath);
        try {
          const results = generateExports(storage, projectPath, { toolFilter: target, dryRun: true });
          if (results.length === 0) {
            printError(`No memories to show for ${target}. Capture some with: coster note "..."`);
            process.exitCode = 1;
            return;
          }
          for (const r of results) {
            if (!options.dry) {
              console.log(`# ${r.path}\n`);
            }
            console.log(r.content);
          }
        } finally {
          await storage.close();
        }
      } catch (error) {
        printError(`Failed to generate preview: ${error}`);
        process.exitCode = 1;
      }
    });
}
