import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { Storage } from '../../src/core/storage.js';
import { FakeEmbedder } from '../../src/embed/embedder.js';
import { hybridSearch } from '../../src/search/hybrid.js';
import { CreateMemory } from '../../src/types/index.js';

function mk(content: string): CreateMemory {
  const now = new Date().toISOString();
  return {
    category: 'decision',
    content,
    importance: 0.5,
    createdAt: now,
    updatedAt: now,
    accessedAt: now,
    accessCount: 0,
    tags: [],
    source: 'manual',
  };
}

describe('embeddings + hybrid search (offline)', () => {
  let tmp: string;
  let storage: Storage;

  beforeEach(async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'coster-emb-'));
    storage = await Storage.create(tmp);
  });
  afterEach(() => {
    storage.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('round-trips vectors in the store', async () => {
    const m = storage.createMemory(mk('Use Postgres'));
    const embedder = new FakeEmbedder(16);
    const [vec] = await embedder.embed([m.content]);
    storage.upsertVector(m.id, vec);
    expect(storage.vectorCount()).toBe(1);
    const got = storage.getVector(m.id)!;
    expect(got).toHaveLength(16);
    expect(got[0]).toBeCloseTo(vec[0], 6);
  });

  it('hybridSearch falls back to keyword-only when no embedder is given', async () => {
    storage.createMemory(mk('Use Postgres for storage'));
    storage.createMemory(mk('Cache with Redis'));

    const hits = await hybridSearch(storage, 'Postgres storage', { limit: 5 });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].memory.content).toContain('Postgres');
  });

  it('hybridSearch uses the vector index when present', async () => {
    const a = storage.createMemory(mk('Use Postgres for the primary datastore'));
    const b = storage.createMemory(mk('The parser drops empty lines on Windows'));
    const embedder = new FakeEmbedder(16);
    const [va, vb] = await embedder.embed([a.content, b.content]);
    storage.upsertVector(a.id, va);
    storage.upsertVector(b.id, vb);

    const hits = await hybridSearch(storage, 'primary database', { limit: 5, embedder });
    expect(hits.length).toBeGreaterThan(0);
    // 'Postgres' shares tokens with the query and is also semantically close -> should rank first.
    expect(hits[0].memory.id).toBe(a.id);
  });

  it('clearVectors empties the index', async () => {
    const m = storage.createMemory(mk('x'));
    const [v] = await new FakeEmbedder(8).embed(['x']);
    storage.upsertVector(m.id, v);
    expect(storage.vectorCount()).toBe(1);
    storage.clearVectors();
    expect(storage.vectorCount()).toBe(0);
    expect(storage.getVector(m.id)).toBeNull();
  });
});
