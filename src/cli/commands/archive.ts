import { Command } from 'commander';
import { Storage } from '../../core/storage.js';
import { resolveProjectPath, assertInitialized } from '../utils/project.js';

export function archiveCommand(): Command {
  const cmd = new Command('archive').description('Inspect and manage soft-archived memories');

  cmd
    .command('list')
    .description('List archived memories')
    .option('-p, --project <path>', 'project root')
    .action(async (options) => {
      const projectPath = resolveProjectPath(options.project);
      if (!assertInitialized(projectPath)) return;
      const storage = await Storage.create(projectPath);
      try {
        const archived = storage.getArchivedMemories();
        if (!archived.length) {
          console.log('no archived memories');
          return;
        }
        for (const m of archived) {
          const tags = m.tags.length ? ` [${m.tags.join(', ')}]` : '';
          console.log(`${m.id}  ${m.category}  imp=${m.importance.toFixed(2)}${tags}`);
          console.log(`    ${m.content}`);
        }
      } finally {
        storage.close();
      }
    });

  cmd
    .command('restore <id>')
    .description('Restore an archived memory back to active')
    .option('-p, --project <path>', 'project root')
    .action(async (id, options) => {
      const projectPath = resolveProjectPath(options.project);
      if (!assertInitialized(projectPath)) return;
      const storage = await Storage.create(projectPath);
      try {
        const ok = storage.restoreMemory(id);
        console.log(ok ? `restored ${id}` : `not found in archive: ${id}`);
      } finally {
        storage.close();
      }
    });

  cmd
    .command('purge <id>')
    .description('Permanently delete an archived memory (irreversible)')
    .option('-p, --project <path>', 'project root')
    .action(async (id, options) => {
      const projectPath = resolveProjectPath(options.project);
      if (!assertInitialized(projectPath)) return;
      const storage = await Storage.create(projectPath);
      try {
        const ok = storage.purgeArchivedMemory(id);
        console.log(ok ? `purged ${id}` : `not found in archive: ${id}`);
      } finally {
        storage.close();
      }
    });

  cmd
    .command('purge-all')
    .description('Permanently delete all archived memories (irreversible)')
    .option('-p, --project <path>', 'project root')
    .action(async (options) => {
      const projectPath = resolveProjectPath(options.project);
      if (!assertInitialized(projectPath)) return;
      const storage = await Storage.create(projectPath);
      try {
        const n = storage.purgeAllArchived();
        console.log(`purged ${n} archived memorie(s)`);
      } finally {
        storage.close();
      }
    });

  return cmd;
}
