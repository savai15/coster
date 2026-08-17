import { Storage } from '../core/storage.js';
import { loadConfig } from '../core/config.js';
import { createEmbedder, isModelPresent } from '../embed/embedder.js';
import { findDuplicates, mergeMemories } from './consolidate.js';
import { decayImportance } from './decay.js';

export type LifecycleStep = 'archive' | 'decay' | 'consolidate';

export interface LifecycleResult {
  archived: number;
  decayed: number;
  merged: number;
}

const DEFAULT_STEPS: LifecycleStep[] = ['archive', 'decay', 'consolidate'];

/**
 * Run one or more lifecycle steps. `archive` soft-archives TTL-expired memories
 * (only when `lifecycle.autoArchive`); `decay` fades importance with age;
 * `consolidate` merges near-duplicate memories using the semantic index.
 * With `dryRun`, no writes happen (counts are previews).
 */
export async function runLifecycle(
  projectPath: string,
  opts: { dryRun?: boolean; steps?: LifecycleStep[]; silent?: boolean } = {}
): Promise<LifecycleResult> {
  const config = loadConfig(projectPath);
  const steps = opts.steps ?? DEFAULT_STEPS;
  const storage = await Storage.create(projectPath);
  const result: LifecycleResult = { archived: 0, decayed: 0, merged: 0 };

  try {
    if (steps.includes('archive') && config.lifecycle.autoArchive) {
      const expired = storage.getExpiredMemories();
      if (opts.dryRun) {
        result.archived = expired.length;
      } else {
        result.archived = storage.archiveMemories(expired.map((m) => m.id));
      }
    }

    if (steps.includes('decay')) {
      if (opts.dryRun) {
        const now = new Date();
        result.decayed = storage.getAllMemories().filter((m) => {
          const base =
            m.metadata && typeof m.metadata.baseImportance === 'number'
              ? (m.metadata.baseImportance as number)
              : m.importance;
          const days = Math.max(
            0,
            (now.getTime() - new Date(m.updatedAt).getTime()) / (1000 * 60 * 60 * 24)
          );
          return Math.abs(decayImportance(base, days, config.lifecycle.decayHalfLifeDays, config.lifecycle.decayMinImportance) - m.importance) > 0.001;
        }).length;
      } else {
        result.decayed = storage.applyDecay(
          new Date(),
          config.lifecycle.decayHalfLifeDays,
          config.lifecycle.decayMinImportance
        );
      }
    }

    if (steps.includes('consolidate') && config.embeddings.enabled && isModelPresent(config.embeddings)) {
      const embedder = createEmbedder(config.embeddings);
      const pairs = findDuplicates(storage, embedder, config.lifecycle.consolidateSimilarity);
      for (const p of pairs) {
        if (opts.dryRun) {
          result.merged++;
          continue;
        }
        const r = mergeMemories(storage, p.a, p.b);
        if (r) result.merged++;
      }
    }
  } finally {
    storage.close();
  }

  return result;
}
