import { Command } from 'commander';
import { Storage } from '../../core/storage.js';
import { MemoryCategory } from '../../types/index.js';

export function searchCommand(program: Command): void {
  program
    .command('search')
    .description('Search memories')
    .argument('<query>', 'Search query')
    .option('-c, --category <category>', 'Filter by category')
    .option('-l, --limit <limit>', 'Max results', '10')
    .option('--json', 'Output as JSON')
    .action(async (query, options) => {
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

        const results = storage.searchMemories(query, options.category);

        if (results.length === 0) {
          console.log('No memories found.');
          storage.close();
          return;
        }

        if (options.json) {
          console.log(JSON.stringify(results, null, 2));
          storage.close();
          return;
        }

        const limit = parseInt(options.limit);
        const displayResults = results.slice(0, limit);

        for (const memory of displayResults) {
          storage.recordAccess(memory.id);
        }

        console.log('\nSearch results:\n');
        for (const memory of displayResults) {
          console.log(`  ID:       ${memory.id.substring(0, 8)}`);
          console.log(`  Category: ${memory.category}`);
          console.log(`  Content:  ${memory.content.substring(0, 50)}${memory.content.length > 50 ? '...' : ''}`);
          console.log(`  Score:    ${memory.importance.toFixed(1)}`);
          console.log(`  Updated:  ${memory.updatedAt.substring(0, 10)}`);
          console.log('');
        }

        console.log(`${results.length} results found.`);
        storage.close();

      } catch (error) {
        console.error('Failed to search memories:', error);
        process.exitCode = 1;
      }
    });
}
