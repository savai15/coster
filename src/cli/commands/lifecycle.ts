import { Command } from 'commander';
import { Storage } from '../../core/storage.js';
import { loadConfig } from '../../core/config.js';
import { runLifecycle, LifecycleStep } from '../../lifecycle/run.js';
import { findDuplicates, mergeMemories } from '../../lifecycle/consolidate.js';
import { createEmbedder, isModelPresent } from '../../embed/embedder.js';
import { resolveProjectPath } from '../utils/project.js';

export function lifecycleCommand(): Command {
  const cmd = new Command('lifecycle').description('Run/inspect memory lifecycle maintenance');

  cmd
    .command('run')
    .description('Run archive, decay and consolidation (skips disabled steps)')
    .option('-p, --project <path>', 'project root')
    .option('--dry-run', 'preview counts without writing')
    .option('--step <step>', 'run only one step: archive|decay|consolidate')
    .action(async (options) => {
      const projectPath = resolveProjectPath(options.project);
      const steps = options.step ? [options.step as LifecycleStep] : undefined;
      const result = await runLifecycle(projectPath, {
        dryRun: !!options.dryRun,
        steps,
        silent: false,
      });
      const label = options.dryRun ? '(dry-run) ' : '';
      console.log(
        `${label}archived=${result.archived} decayed=${result.decayed} merged=${result.merged}`
      );
    });

  cmd
    .command('decay')
    .description('Apply age-based importance decay only')
    .option('-p, --project <path>', 'project root')
    .option('--dry-run', 'preview without writing')
    .action(async (options) => {
      const projectPath = resolveProjectPath(options.project);
      const result = await runLifecycle(projectPath, {
        dryRun: !!options.dryRun,
        steps: ['decay'],
      });
      console.log(`${options.dryRun ? '(dry-run) ' : ''}decayed=${result.decayed}`);
    });

  cmd
    .command('consolidate')
    .description('Merge near-duplicate memories only')
    .option('-p, --project <path>', 'project root')
    .option('--dry-run', 'preview without writing')
    .action(async (options) => {
      const projectPath = resolveProjectPath(options.project);
      const result = await runLifecycle(projectPath, {
        dryRun: !!options.dryRun,
        steps: ['consolidate'],
      });
      console.log(`${options.dryRun ? '(dry-run) ' : ''}merged=${result.merged}`);
    });

  cmd
    .command('status')
    .description('Show lifecycle counts and pending work')
    .option('-p, --project <path>', 'project root')
    .action(async (options) => {
      const projectPath = resolveProjectPath(options.project);
      const config = loadConfig(projectPath);
      const storage = await Storage.create(projectPath);
      try {
        const total = storage.getMemoryCount();
        const expired = storage.getExpiredMemories().length;
        const archived = storage.getArchivedMemories().length;
        let dupes = 0;
        if (config.embeddings.enabled && isModelPresent(config.embeddings)) {
          const embedder = createEmbedder(config.embeddings);
          dupes = findDuplicates(storage, embedder, config.lifecycle.consolidateSimilarity).length;
        }
        console.log(`active memories:     ${total}`);
        console.log(`archived memories:   ${archived}`);
        console.log(`expired (TTL):       ${config.lifecycle.autoArchive ? expired : 'autoArchive off'}`);
        console.log(`near-duplicates:     ${config.embeddings.enabled ? dupes : 'embeddings off'}`);
        console.log(`decay half-life:     ${config.lifecycle.decayHalfLifeDays}d`);
        console.log(`decay floor:         ${config.lifecycle.decayMinImportance}`);
        console.log(`consolidate @:       cos>=${config.lifecycle.consolidateSimilarity}`);
      } finally {
        storage.close();
      }
    });

  cmd
    .command('duplicates')
    .description('List detected near-duplicate pairs (no writes)')
    .option('-p, --project <path>', 'project root')
    .action(async (options) => {
      const projectPath = resolveProjectPath(options.project);
      const config = loadConfig(projectPath);
      if (!config.embeddings.enabled) {
        console.log('embeddings disabled; enable with `config set embeddings.enabled true`');
        return;
      }
      if (!isModelPresent(config.embeddings)) {
        console.log('model not fetched; run `embeddings fetch` first');
        return;
      }
      const storage = await Storage.create(projectPath);
      try {
        const embedder = createEmbedder(config.embeddings);
        const pairs = findDuplicates(storage, embedder, config.lifecycle.consolidateSimilarity);
        if (!pairs.length) {
          console.log('no near-duplicates found');
          return;
        }
        for (const p of pairs) {
          console.log(`${p.a} <-> ${p.b}  cos=${p.score.toFixed(4)}`);
        }
      } finally {
        storage.close();
      }
    });

  cmd
    .command('merge <a> <b>')
    .description('Manually merge memory b into a')
    .option('-p, --project <path>', 'project root')
    .action(async (a, b, options) => {
      const projectPath = resolveProjectPath(options.project);
      const storage = await Storage.create(projectPath);
      try {
        const r = mergeMemories(storage, a, b);
        if (!r) {
          console.log('one or both ids not found');
          return;
        }
        console.log(`merged ${b} -> ${a} (archived ${r.archived})`);
      } finally {
        storage.close();
      }
    });

  return cmd;
}
