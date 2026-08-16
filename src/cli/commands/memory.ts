import { Command } from 'commander';
import { Storage } from '../../core/storage.js';
import { CreateMemory, MemoryCategory, MemorySource } from '../../types/index.js';
import { printInfo, printError, printJson } from '../utils/output.js';

function now(): string {
  return new Date().toISOString();
}

function parseTags(value?: string): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

function validCategory(value: string): value is MemoryCategory {
  return [
    'preference',
    'convention',
    'decision',
    'investigation',
    'workaround',
    'recap',
    'mistake',
  ].includes(value);
}

export function memoryCommand(program: Command): void {
  const mem = program.command('memory').description('Manage individual memories');

  mem
    .command('list')
    .description('List all memories')
    .option('-c, --category <category>', 'Filter by category')
    .option('-l, --limit <limit>', 'Max results', '50')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      try {
        const storage = await Storage.create(process.cwd());
        try {
          const memories = storage.getAllMemories(options.category);
          const limited = memories.slice(0, parseInt(options.limit, 10) || 50);

          if (options.json) {
            printJson(limited);
            return;
          }
          if (limited.length === 0) {
            printInfo('No memories found.');
            return;
          }
          for (const m of limited) {
            console.log(`  ID:       ${m.id.substring(0, 8)}`);
            console.log(`  Category: ${m.category}`);
            console.log(`  Content:  ${m.content.substring(0, 60)}${m.content.length > 60 ? '...' : ''}`);
            console.log(`  Accessed: ${m.accessCount}x`);
            console.log('');
          }
          console.log(`${memories.length} total memories.`);
        } finally {
          await storage.close();
        }
      } catch (error) {
        printError(`Failed to list memories: ${error}`);
        process.exitCode = 1;
      }
    });

  mem
    .command('show <id>')
    .description('Show a single memory by id')
    .action(async (id: string) => {
      try {
        const storage = await Storage.create(process.cwd());
        try {
          const m = storage.getMemory(id);
          if (!m) {
            printError(`Memory not found: ${id}`);
            process.exitCode = 1;
            return;
          }
          printJson(m);
        } finally {
          await storage.close();
        }
      } catch (error) {
        printError(`Failed to read memory: ${error}`);
        process.exitCode = 1;
      }
    });

  mem
    .command('add')
    .description('Add a memory')
    .requiredOption('-c, --category <category>', 'Category')
    .requiredOption('-t, --text <text>', 'Memory content')
    .option('--tags <tags>', 'Comma-separated tags')
    .option('--source <source>', 'Source', 'manual')
    .option('--importance <n>', 'Importance 0-1', '0.5')
    .action(async (options) => {
      try {
        if (!validCategory(options.category)) {
          printError(`Invalid category: ${options.category}`);
          process.exitCode = 1;
          return;
        }
        const source: MemorySource = (options.source as MemorySource) ?? 'manual';
        const record: CreateMemory = {
          category: options.category,
          content: options.text,
          importance: parseFloat(options.importance) || 0.5,
          createdAt: now(),
          updatedAt: now(),
          accessedAt: now(),
          accessCount: 0,
          tags: parseTags(options.tags),
          source,
          metadata: {},
        };
        const storage = await Storage.create(process.cwd());
        try {
          const created = storage.createMemory(record);
          printInfo(`Created memory ${created.id.substring(0, 8)} (${created.category})`);
        } finally {
          await storage.close();
        }
      } catch (error) {
        printError(`Failed to add memory: ${error}`);
        process.exitCode = 1;
      }
    });

  mem
    .command('edit <id>')
    .description('Edit a memory')
    .option('-t, --text <text>', 'New content')
    .option('-c, --category <category>', 'New category')
    .option('--tags <tags>', 'Comma-separated tags')
    .option('--importance <n>', 'Importance 0-1')
    .action(async (id: string, options) => {
      try {
        const storage = await Storage.create(process.cwd());
        try {
          if (options.category && !validCategory(options.category)) {
            printError(`Invalid category: ${options.category}`);
            process.exitCode = 1;
            return;
          }
          const updates: Partial<CreateMemory> = { updatedAt: now() };
          if (options.text) updates.content = options.text;
          if (options.category) updates.category = options.category;
          if (options.tags) updates.tags = parseTags(options.tags);
          if (options.importance) updates.importance = parseFloat(options.importance) || 0.5;

          const updated = storage.updateMemory(id, updates as any);
          if (!updated) {
            printError(`Memory not found: ${id}`);
            process.exitCode = 1;
            return;
          }
          printInfo(`Updated memory ${updated.id.substring(0, 8)}`);
        } finally {
          await storage.close();
        }
      } catch (error) {
        printError(`Failed to edit memory: ${error}`);
        process.exitCode = 1;
      }
    });

  mem
    .command('delete <id>')
    .description('Delete a memory')
    .action(async (id: string) => {
      try {
        const storage = await Storage.create(process.cwd());
        try {
          const ok = storage.deleteMemory(id);
          if (!ok) {
            printError(`Memory not found: ${id}`);
            process.exitCode = 1;
            return;
          }
          printInfo(`Deleted memory ${id.substring(0, 8)}`);
        } finally {
          await storage.close();
        }
      } catch (error) {
        printError(`Failed to delete memory: ${error}`);
        process.exitCode = 1;
      }
    });
}
