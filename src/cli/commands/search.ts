import { Command } from 'commander';
import { Storage } from '../../core/storage.js';
import { MemoryCategory } from '../../types/index.js';
import { loadConfig } from '../../core/config.js';
import { createEmbedder, isModelPresent } from '../../embed/embedder.js';
import { hybridSearch } from '../../search/hybrid.js';
import { printInfo } from '../utils/output.js';

export function searchCommand(program: Command): void {
  program
    .command('search')
    .description('Search memories (hybrid: keyword + semantic)')
    .argument('<query>', 'Search query')
    .option('-c, --category <category>', 'Filter by category')
    .option('-l, --limit <limit>', 'Max results', '10')
    .option('--keyword-only', 'Skip semantic ranking')
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

        let embedder;
        if (!options.keywordOnly) {
          const config = loadConfig(process.cwd());
          if (config.embeddings.enabled && isModelPresent(config.embeddings)) {
            embedder = createEmbedder(config.embeddings);
          } else {
            printInfo('(semantic index not built yet — keyword-only. Run `coster embeddings build`.)');
          }
        }

        const hits = await hybridSearch(storage, query, {
          category: options.category,
          limit: parseInt(options.limit),
          embedder,
        });

        if (hits.length === 0) {
          console.log('No memories found.');
          storage.close();
          return;
        }

        if (options.json) {
          console.log(JSON.stringify(hits.map((h) => h.memory), null, 2));
          storage.close();
          return;
        }

        for (const { memory } of hits) {
          storage.recordAccess(memory.id);
        }

        console.log('\nSearch results:\n');
        for (const { memory, score } of hits) {
          console.log(`  ID:       ${memory.id.substring(0, 8)}`);
          console.log(`  Category: ${memory.category}`);
          console.log(`  Content:  ${memory.content.substring(0, 50)}${memory.content.length > 50 ? '...' : ''}`);
          console.log(`  Score:    ${score.toFixed(3)}`);
          console.log(`  Updated:  ${memory.updatedAt.substring(0, 10)}`);
          console.log('');
        }

        console.log(`${hits.length} results found.`);
        storage.close();

      } catch (error) {
        console.error('Failed to search memories:', error);
        process.exitCode = 1;
      }
    });
}
