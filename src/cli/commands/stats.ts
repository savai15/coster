import { Command } from 'commander';
import { Storage } from '../../core/storage.js';
import { MemoryCategory } from '../../types/index.js';
import { printInfo, printError, printTable } from '../utils/output.js';

const CATEGORIES: MemoryCategory[] = [
  'preference',
  'convention',
  'decision',
  'investigation',
  'workaround',
  'recap',
  'mistake',
];

export function statsCommand(program: Command): void {
  program
    .command('stats')
    .description('Show memory statistics')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      try {
        const storage = await Storage.create(process.cwd());
        try {
          const all = storage.getAllMemories();

          const byCategory: Record<string, number> = {};
          for (const cat of CATEGORIES) byCategory[cat] = 0;
          for (const m of all) {
            byCategory[m.category] = (byCategory[m.category] ?? 0) + 1;
          }

          const totalAccess = all.reduce((sum, m) => sum + m.accessCount, 0);
          const top = [...all]
            .filter((m) => m.accessCount > 0)
            .sort((a, b) => b.accessCount - a.accessCount)
            .slice(0, 5);

          if (options.json) {
            console.log(
              JSON.stringify(
                {
                  total: all.length,
                  totalAccess,
                  byCategory,
                  topAccessed: top.map((m) => ({
                    id: m.id,
                    category: m.category,
                    accessCount: m.accessCount,
                    content: m.content.substring(0, 80),
                  })),
                },
                null,
                2
              )
            );
            return;
          }

          printInfo('Memory statistics:\n');
          printTable(['Category', 'Count'], CATEGORIES.map((c) => [c, byCategory[c]]));
          console.log('');
          console.log(`Total memories : ${all.length}`);
          console.log(`Total accesses : ${totalAccess}`);

          if (top.length > 0) {
            console.log('\nMost accessed:');
            for (const m of top) {
              console.log(
                `  [${m.accessCount}x] (${m.category}) ${m.content.substring(0, 60)}${
                  m.content.length > 60 ? '...' : ''
                }`
              );
            }
          }
        } finally {
          await storage.close();
        }
      } catch (error) {
        printError(`Failed to compute stats: ${error}`);
        process.exitCode = 1;
      }
    });
}
