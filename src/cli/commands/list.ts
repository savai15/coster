import { Command } from 'commander';
import { Storage } from '../../core/storage.js';
import { MemoryCategory } from '../../types/index.js';

export function listCommand(program: Command): void {
  program
    .command('list')
    .description('List all memories')
    .option('-c, --category <category>', 'Filter by category')
    .option('-l, --limit <limit>', 'Max results', '20')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      try {
        const storage = await Storage.create(process.cwd());
        
        if (options.category) {
          const validCategories: MemoryCategory[] = [
            'preference', 'convention', 'decision', 
            'investigation', 'workaround', 'recap', 'mistake'
          ];
          
          if (!validCategories.includes(options.category)) {
            console.log(`Invalid category: ${options.category}`);
            console.log('Valid categories:', validCategories.join(', '));
            storage.close();
            return;
          }
        }

        const memories = storage.getAllMemories(options.category);

        if (memories.length === 0) {
          console.log('No memories found.');
          storage.close();
          return;
        }

        if (options.json) {
          console.log(JSON.stringify(memories, null, 2));
          storage.close();
          return;
        }

        const limit = parseInt(options.limit);
        const displayMemories = memories.slice(0, limit);

        console.log('\nAll memories:\n');
        for (const memory of displayMemories) {
          console.log(`  ID:       ${memory.id.substring(0, 8)}`);
          console.log(`  Category: ${memory.category}`);
          console.log(`  Content:  ${memory.content.substring(0, 50)}${memory.content.length > 50 ? '...' : ''}`);
          console.log(`  Score:    ${memory.importance.toFixed(1)}`);
          console.log(`  Source:   ${memory.source}`);
          console.log(`  Updated:  ${memory.updatedAt.substring(0, 10)}`);
          console.log('');
        }

        console.log(`${memories.length} total memories.`);
        storage.close();

      } catch (error) {
        console.error('Failed to list memories:', error);
        process.exitCode = 1;
      }
    });
}
