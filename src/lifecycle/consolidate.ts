import { Storage } from '../core/storage.js';
import { Embedder } from '../embed/embedder.js';
import { MemoryCategory } from '../types/index.js';

/** Categories safe to auto-merge (avoid collapsing narratives like recaps/investigations). */
const CONSOLIDATABLE: MemoryCategory[] = [
  'preference',
  'convention',
  'decision',
  'workaround',
  'mistake',
];

export interface DuplicatePair {
  a: string;
  b: string;
  score: number;
}

function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot; // vectors are L2-normalized
}

/**
 * Find near-duplicate memory pairs using the semantic index. Only same-category
 * pairs among consolidatable categories with cosine similarity >= `similarity`.
 */
export function findDuplicates(
  storage: Storage,
  embedder: Embedder,
  similarity: number
): DuplicatePair[] {
  const vectors = storage.getAllVectors().filter((v) => v.vector.length === embedder.dim);
  const byId = new Map(storage.getAllMemories().map((m) => [m.id, m]));

  const pairs: DuplicatePair[] = [];
  for (let i = 0; i < vectors.length; i++) {
    for (let j = i + 1; j < vectors.length; j++) {
      const ma = byId.get(vectors[i].id);
      const mb = byId.get(vectors[j].id);
      if (!ma || !mb) continue;
      if (ma.category !== mb.category) continue;
      if (!CONSOLIDATABLE.includes(ma.category) || !CONSOLIDATABLE.includes(mb.category)) continue;
      const score = cosine(vectors[i].vector, vectors[j].vector);
      if (score >= similarity) pairs.push({ a: vectors[i].id, b: vectors[j].id, score });
    }
  }
  pairs.sort((x, y) => y.score - x.score);
  return pairs;
}

/**
 * Merge `b` into `a` (the higher-importance memory is kept; the other is
 * soft-archived). Returns the kept and archived ids.
 */
export function mergeMemories(
  storage: Storage,
  aId: string,
  bId: string
): { kept: string; archived: string } | null {
  const a = storage.getMemory(aId);
  const b = storage.getMemory(bId);
  if (!a || !b) return null;

  const kept = a.importance >= b.importance ? a : b;
  const other = kept.id === a.id ? b : a;

  const mergedContent = `${kept.content}\n\n${other.content}`;
  storage.updateMemory(kept.id, { content: mergedContent });
  storage.archiveMemories([other.id]);
  return { kept: kept.id, archived: other.id };
}
