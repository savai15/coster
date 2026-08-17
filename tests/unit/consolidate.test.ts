import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { Storage } from '../../src/core/storage.js';
import { FakeEmbedder } from '../../src/embed/embedder.js';
import { findDuplicates, mergeMemories } from '../../src/lifecycle/consolidate.js';
import { CreateMemory } from '../../src/types/index.js';

function mk(category: CreateMemory['category'], content: string, importance = 0.5): CreateMemory {
  const now = new Date().toISOString();
  return { category, content, importance, createdAt: now, updatedAt: now, accessedAt: now, accessCount: 0, tags: [], source: 'manual' };
}

describe('consolidate (offline, FakeEmbedder)', () => {
  let tmp: string;
  let storage: Storage;

  beforeEach(async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'coster-con-'));
    storage = await Storage.create(tmp);
  });
  afterEach(() => {
    storage.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('finds near-duplicate same-category memories', async () => {
    const a = storage.createMemory(mk('decision', 'Use Postgres for the primary datastore'));
    const b = storage.createMemory(mk('decision', 'Use Postgres for the primary datastore'));
    const embedder = new FakeEmbedder(16);
    const [va, vb] = await embedder.embed([a.content, b.content]);
    storage.upsertVector(a.id, va);
    storage.upsertVector(b.id, vb);

    const pairs = findDuplicates(storage, embedder, 0.92);
    expect(pairs.length).toBe(1);
    expect(new Set([pairs[0].a, pairs[0].b])).toEqual(new Set([a.id, b.id]));
  });

  it('does not merge across different categories', async () => {
    const a = storage.createMemory(mk('decision', 'Use Postgres'));
    const b = storage.createMemory(mk('convention', 'Use Postgres'));
    const embedder = new FakeEmbedder(16);
    const [va, vb] = await embedder.embed([a.content, b.content]);
    storage.upsertVector(a.id, va);
    storage.upsertVector(b.id, vb);

    expect(findDuplicates(storage, embedder, 0.9).length).toBe(0);
  });

  it('merges b into the higher-importance memory and soft-archives the other', async () => {
    const keep = storage.createMemory(mk('decision', 'Keep this high-value rule', 0.9));
    const drop = storage.createMemory(mk('decision', 'Lower value duplicate', 0.3));
    const r = mergeMemories(storage, keep.id, drop.id);

    expect(r).not.toBeNull();
    expect(r!.kept).toBe(keep.id);
    expect(r!.archived).toBe(drop.id);
    expect(storage.getMemory(keep.id)?.content).toContain('Lower value duplicate');
    expect(storage.getMemory(drop.id)).toBeNull();
    expect(storage.getArchivedMemories().map((m) => m.id)).toContain(drop.id);
  });
});
