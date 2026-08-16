import { Command } from 'commander';
import { v4 as uuidv4 } from 'uuid';
import { Storage } from '../../core/storage.js';
import { MemoryCategory } from '../../types/index.js';
import { syncAfterCapture } from '../utils/sync.js';

const SILENT = process.env.COSTER_SILENT === '1';

function autoCategory(text: string): MemoryCategory {
  const t = text.toLowerCase();
  if (/\b(decided|decision|standard|standardized|chose|chosen|policy|rule|convention)\b/.test(t)) return 'decision';
  if (/\b(bug|broken|fix|workaround|hack|temporary|kludge)\b/.test(t)) return 'workaround';
  if (/\b(investigat|found|discovered|root cause|why)\b/.test(t)) return 'investigation';
  if (/\b(mistake|wrong|accidentally|oops|don't repeat|never)\b/.test(t)) return 'mistake';
  return 'convention';
}

export function noteCommand(program: Command): void {
  program
    .command('note <text...>')
    .description('Quick-capture a memory from plain text (auto-categorizes)')
    .option('-c, --category <category>', 'Override the auto-detected category')
    .option('--tags <tags>', 'Comma-separated tags', '')
    .option('--importance <n>', 'Importance 0-1', '0.6')
    .action(async (text: string[], options) => {
      const content = text.join(' ').trim();
      if (!content) {
        console.error('No note text provided.');
        process.exitCode = 1;
        return;
      }

      const category = (options.category || autoCategory(content)) as MemoryCategory;
      const now = new Date().toISOString();

      try {
        const storage = await Storage.create(process.cwd());
        try {
          const created = storage.createMemory({
            category,
            content,
            importance: parseFloat(options.importance) || 0.6,
            createdAt: now,
            updatedAt: now,
            accessedAt: now,
            accessCount: 0,
            tags: options.tags
              ? String(options.tags).split(',').map((t: string) => t.trim()).filter(Boolean)
              : [],
            source: 'manual',
            metadata: { id: uuidv4() },
          });
          if (!SILENT) console.log(`Captured (${category}): ${created.id.substring(0, 8)}`);
          syncAfterCapture(storage, process.cwd());
        } finally {
          await storage.close();
        }
      } catch (error) {
        console.error('Failed to capture note:', error);
        process.exitCode = 1;
      }
    });
}
