import { Command } from 'commander';
import { Storage } from '../../core/storage.js';

const SILENT = process.env.COSTER_SILENT === '1';

export function runCleanup(storage: Storage, _projectPath?: string): number {
  const expired = storage.getExpiredMemories();
  if (expired.length === 0) {
    return 0;
  }
  storage.archiveMemories(expired.map(m => m.id));
  return expired.length;
}

export function cleanupCommand(program: Command): void {
  program
    .command('cleanup')
    .description('Archive expired memories based on lifecycle TTL')
    .option('--dry-run', 'Show what would be archived without deleting')
    .action(async (options) => {
      try {
        const projectPath = process.cwd();
        const storage = await Storage.create(projectPath);

        const expired = storage.getExpiredMemories();

        if (expired.length === 0) {
          if (!SILENT) console.log('No expired memories to clean up.');
          storage.close();
          return;
        }

        if (options.dryRun) {
          if (!SILENT) {
            console.log(`Would archive ${expired.length} expired memories:\n`);
            for (const m of expired) {
              console.log(`  [${m.category}] ${m.content.substring(0, 60)}`);
            }
          }
          storage.close();
          return;
        }

        const count = runCleanup(storage, projectPath);
        if (!SILENT) console.log(`Archived ${count} expired memories.`);

        storage.close();
      } catch (error) {
        console.error('Failed to run cleanup:', error);
        process.exitCode = 1;
      }
    });
}
