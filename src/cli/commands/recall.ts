import { Command } from 'commander';
import fs from 'fs';
import { Storage } from '../../core/storage.js';
import { curateContext, renderRecallMarkdown } from '../../inject/curate.js';
import { assertInitialized, resolveProjectPath } from '../utils/project.js';
import { printError, printInfo } from '../utils/output.js';

export async function recallContext(
  projectPath: string,
  focus: string,
  opts: { limit?: number; useSemantic?: boolean } = {}
): Promise<ReturnType<typeof curateContext>> {
  const storage = await Storage.create(projectPath);
  try {
    const list = await curateContext(storage, projectPath, {
      focus,
      useSemantic: opts.useSemantic,
      maxMemories: opts.limit,
    });
    for (const p of list) {
      storage.recordAccess(p.memory.id);
    }
    return list;
  } finally {
    storage.close();
  }
}

export function recallCommand(program: Command): void {
  program
    .command('recall')
    .description('Recall the most relevant memories for a topic or file (decay + optional semantic ranking)')
    .argument('[query]', 'Topic, phrase, or file path to recall memories for')
    .option('-f, --file <path>', 'Treat the argument as a file path and recall memories relevant to that file')
    .option('-l, --limit <n>', 'Maximum number of memories to return', '20')
    .option('--json', 'Output raw JSON instead of markdown')
    .option('--no-semantic', 'Disable semantic ranking (use decayed-importance only)')
    .action(async (query: string | undefined, options) => {
      try {
        const projectPath = resolveProjectPath();
        assertInitialized(projectPath);

        let focus = query ?? '';
        if (options.file) {
          const filePath = options.file;
          focus = fs.existsSync(filePath)
            ? `${filePath}\n${fs.readFileSync(filePath, 'utf-8').slice(0, 2000)}`
            : filePath;
        } else if (query && fs.existsSync(query)) {
          focus = `${query}\n${fs.readFileSync(query, 'utf-8').slice(0, 2000)}`;
        }

        if (!focus.trim()) {
          printInfo('Provide a query or --file to recall relevant memories.');
          return;
        }

        const list = await recallContext(projectPath, focus, {
          limit: parseInt(options.limit, 10),
          useSemantic: options.semantic,
        });

        if (options.json) {
          process.stdout.write(
            JSON.stringify(
              list.map((p) => ({ ...p.memory, score: Number(p.score.toFixed(4)) })),
              null,
              2
            ) + '\n'
          );
          return;
        }

        process.stdout.write(renderRecallMarkdown(list));
      } catch (error) {
        printError(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
      }
    });
}
