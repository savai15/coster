import { describe, it, expect } from 'vitest';
import { bm25Rank, substringRank } from '../../src/search/keyword.js';
import { rrf } from '../../src/search/hybrid.js';
import { FakeEmbedder } from '../../src/embed/embedder.js';
import { Memory, MemoryCategory } from '../../src/types/index.js';

function mem(id: string, content: string, tags: string[] = []): Memory {
  const now = new Date().toISOString();
  return {
    id,
    category: 'decision' as MemoryCategory,
    content,
    importance: 0.5,
    createdAt: now,
    updatedAt: now,
    accessedAt: now,
    accessCount: 0,
    tags,
    source: 'manual',
    metadata: {},
  };
}

describe('BM25 keyword ranking', () => {
  const corpus = [
    mem('a', 'Use Postgres for the primary datastore'),
    mem('b', 'Cache with Redis to avoid database load'),
    mem('c', 'The parser drops empty lines on Windows'),
  ];

  it('ranks the document containing the query terms highest', () => {
    const ranks = bm25Rank('Postgres database', corpus);
    expect(ranks[0].id).toBe('a');
  });

  it('returns nothing for a query with no matches', () => {
    expect(bm25Rank('kubernetes', corpus)).toHaveLength(0);
  });

  it('substringRank finds content matches', () => {
    expect(substringRank('Redis', corpus).map((r) => r.id)).toContain('b');
  });
});

describe('Reciprocal Rank Fusion', () => {
  it('boosts ids present in both lists', () => {
    const fused = rrf([
      [{ id: 'x', score: 5 }, { id: 'y', score: 1 }],
      [{ id: 'x', score: 9 }, { id: 'z', score: 2 }],
    ]);
    expect(fused[0].id).toBe('x');
  });
});

describe('FakeEmbedder', () => {
  it('produces normalized vectors of the configured dimension', async () => {
    const e = new FakeEmbedder(8);
    const out = await e.embed(['hello world', 'goodbye']);
    expect(out).toHaveLength(2);
    expect(out[0]).toHaveLength(8);
    const norm = Math.sqrt(out[0].reduce((s, v) => s + v * v, 0));
    expect(norm).toBeCloseTo(1, 5);
  });
});
