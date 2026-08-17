import { Storage } from '../core/storage.js';
import { Memory, MemoryCategory } from '../types/index.js';
import { Embedder } from '../embed/embedder.js';
import { bm25Rank, RankedId } from './keyword.js';

export interface SearchHit {
  memory: Memory;
  score: number;
}

export function rrf(lists: RankedId[][], k = 60): RankedId[] {
  const merged = new Map<string, number>();
  for (const list of lists) {
    list.forEach((item, idx) => {
      merged.set(item.id, (merged.get(item.id) ?? 0) + 1 / (k + idx + 1));
    });
  }
  return [...merged.entries()]
    .map(([id, score]) => ({ id, score }))
    .sort((a, b) => b.score - a.score);
}

function cosineTopK(queryVec: number[], vectors: { id: string; vector: number[] }[], k: number): RankedId[] {
  const dim = queryVec.length;
  return vectors
    .map((v) => {
      if (v.vector.length !== dim) return { id: v.id, dot: 0 };
      let dot = 0;
      for (let i = 0; i < dim; i++) dot += queryVec[i] * v.vector[i];
      return { id: v.id, dot };
    })
    .filter((x) => x.dot > 0)
    .sort((a, b) => b.dot - a.dot)
    .slice(0, k)
    .map((x) => ({ id: x.id, score: x.dot }));
}

/**
 * Hybrid memory search: keyword (BM25) fused with vector (cosine) via
 * Reciprocal Rank Fusion. Falls back to keyword-only when no embedder or no
 * vectors are available, so search always works out of the box.
 */
export async function hybridSearch(
  storage: Storage,
  query: string,
  opts: { category?: MemoryCategory; limit?: number; embedder?: Embedder }
): Promise<SearchHit[]> {
  const limit = opts.limit ?? 10;
  const memories = storage.getAllMemories(opts.category);
  if (memories.length === 0) return [];

  const keywordRanks = bm25Rank(query, memories);
  const lists: RankedId[][] = [keywordRanks];

  if (opts.embedder) {
    try {
      const vectors = storage.getAllVectors().filter((v) => v.vector.length === opts.embedder!.dim);
      if (vectors.length > 0) {
        const [queryVec] = await opts.embedder.embed([query], { isQuery: true });
        const vectorRanks = cosineTopK(queryVec, vectors, Math.max(limit * 3, 50));
        if (vectorRanks.length > 0) lists.push(vectorRanks);
      }
    } catch {
      // embedder/model problem -> keyword-only (caller may warn)
    }
  }

  const fused = rrf(lists);
  const byId = new Map(memories.map((m) => [m.id, m]));

  const hits: SearchHit[] = [];
  for (const r of fused) {
    const memory = byId.get(r.id);
    if (memory) hits.push({ memory, score: r.score });
    if (hits.length >= limit) break;
  }
  return hits;
}
