import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { Storage } from '../../src/core/storage.js';
import { runLifecycle } from '../../src/lifecycle/run.js';
import { CreateMemory } from '../../src/types/index.js';

function mk(category: CreateMemory['category'], content: string, updatedAt: string, importance = 0.5): CreateMemory {
  return { category, content, importance, createdAt: updatedAt, updatedAt, accessedAt: updatedAt, accessCount: 0, tags: [], source: 'manual' };
}

const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();

describe('lifecycle storage ops', () => {
  let tmp: string;
  let storage: Storage;

  beforeEach(async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'coster-life-'));
    storage = await Storage.create(tmp);
  });
  afterEach(() => {
    storage.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('soft-archives TTL-expired recaps and restores them', async () => {
    const recap = storage.createMemory(mk('recap', 'Old weekly status', daysAgo(31)));
    storage.createMemory(mk('recap', 'Fresh status', daysAgo(1)));

    const expired = storage.getExpiredMemories();
    expect(expired.map((m) => m.id)).toContain(recap.id);
    expect(expired).toHaveLength(1);

    const n = storage.archiveMemories([recap.id]);
    expect(n).toBe(1);
    expect(storage.getMemory(recap.id)).toBeNull();
    expect(storage.getArchivedMemories().map((m) => m.id)).toContain(recap.id);

    expect(storage.restoreMemory(recap.id)).not.toBeNull();
    expect(storage.getMemory(recap.id)?.id).toBe(recap.id);
    expect(storage.getArchivedMemories()).toHaveLength(0);
  });

  it('purges archived memories irreversibly', async () => {
    const m = storage.createMemory(mk('recap', 'to purge', daysAgo(40)));
    storage.archiveMemories([m.id]);
    expect(storage.purgeArchivedMemory(m.id)).toBe(true);
    expect(storage.getArchivedMemories()).toHaveLength(0);
  });

  it('applyDecay lowers importance for stale memories but respects the floor', () => {
    const stale = storage.createMemory(mk('decision', 'stale rule', daysAgo(365), 1.0));
    const fresh = storage.createMemory(mk('decision', 'fresh rule', daysAgo(1), 1.0));

    const decayed = storage.applyDecay(new Date(), 180, 0.2);
    expect(decayed).toBeGreaterThanOrEqual(1);
    const after = storage.getMemory(stale.id)!;
    expect(after.importance).toBeLessThan(1.0);
    expect(after.importance).toBeGreaterThanOrEqual(0.2);
    // stale memory decayed more than the fresh one
    const freshAfter = storage.getMemory(fresh.id)!;
    expect(after.importance).toBeLessThan(freshAfter.importance);
  });
});

describe('runLifecycle', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'coster-run-'));
  });
  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('archives expired memories and skips disabled steps in dry-run', async () => {
    const seed = await Storage.create(tmp);
    seed.createMemory(mk('recap', 'expired', daysAgo(40), 1.0));
    seed.close();

    const dry = await runLifecycle(tmp, { dryRun: true });
    expect(dry.archived).toBe(1);

    // dry-run must not have written
    const check = await Storage.create(tmp);
    expect(check.getArchivedMemories()).toHaveLength(0);
    check.close();

    const real = await runLifecycle(tmp, {});
    expect(real.archived).toBe(1);
    const after = await Storage.create(tmp);
    expect(after.getArchivedMemories()).toHaveLength(1);
    after.close();
  });
});
