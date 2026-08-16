import { Command } from 'commander';
import { Storage } from '../../core/storage.js';
import { detectStack } from '../../capture/detect.js';
import { MemoryCategory } from '../../types/index.js';

export function restoreCommand(program: Command): void {
  program
    .command('restore')
    .description('Restore context for a specific tool')
    .option('-t, --tool <tool>', 'Tool to restore context for')
    .option('-c, --category <category>', 'Filter by category')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      try {
        const projectPath = process.cwd();
        const storage = await Storage.create(projectPath);
        const memories = storage.getAllMemories(options.category as MemoryCategory);
        const stack = detectStack(projectPath);

        if (options.json) {
          console.log(JSON.stringify({
            tool: options.tool,
            stack,
            memories,
          }, null, 2));
        } else {
          console.log(`\nContext for ${options.tool || 'all tools'}:\n`);
          console.log('Project:', projectPath);
          console.log('Language:', stack.language);
          console.log('Framework:', stack.framework);
          console.log('Memories:', memories.length);

          const grouped = memories.reduce((acc, m) => {
            if (!acc[m.category]) {
              acc[m.category] = [];
            }
            acc[m.category].push(m);
            return acc;
          }, {} as Record<string, typeof memories>);

          Object.entries(grouped).forEach(([category, mems]) => {
            console.log(`\n${category.toUpperCase()}:`);
            mems.forEach(m => {
              console.log(`  - ${m.content}`);
            });
          });
        }

        storage.close();

      } catch (error) {
        console.error('Failed to restore context:', error);
        process.exitCode = 1;
      }
    });
}
