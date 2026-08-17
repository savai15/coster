import { Memory } from '../types/index.js';

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

export interface RankedId {
  id: string;
  score: number;
}

/**
 * Lightweight BM25 ranking over memory content + tags. Designed for the small
 * corpora Coster handles (hundreds–low thousands of memories); operates fully
 * in memory with no extra dependencies. Returns ids sorted by descending score.
 */
export function bm25Rank(query: string, memories: Memory[], opts?: { k1?: number; b?: number }): RankedId[] {
  const k1 = opts?.k1 ?? 1.5;
  const b = opts?.b ?? 0.75;
  const terms = tokenize(query);
  if (terms.length === 0) return [];

  const docs = memories.map((m) => ({
    id: m.id,
    len: tokenize(m.content).length,
    tokens: tokenize(`${m.content} ${m.tags.join(' ')}`),
  }));

  const avgdl = docs.reduce((s, d) => s + d.len, 0) / (docs.length || 1);

  // document frequency per term
  const df: Record<string, number> = {};
  for (const term of terms) {
    df[term] = docs.filter((d) => d.tokens.includes(term)).length;
  }
  const N = docs.length;

  const scores: Record<string, number> = {};
  for (const doc of docs) {
    let score = 0;
    const tf: Record<string, number> = {};
    for (const t of doc.tokens) tf[t] = (tf[t] ?? 0) + 1;
    for (const term of terms) {
      const f = tf[term];
      if (!f) continue;
      const idf = Math.log(1 + (N - (df[term] || 0) + 0.5) / ((df[term] || 0) + 0.5));
      score += idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + b * (doc.len / avgdl))));
    }
    if (score > 0) scores[doc.id] = score;
  }

  return Object.entries(scores)
    .map(([id, score]) => ({ id, score }))
    .sort((a, c) => c.score - a.score);
}

/** Simple substring fallback used before any index exists. */
export function substringRank(query: string, memories: Memory[]): RankedId[] {
  const q = query.toLowerCase();
  return memories
    .filter((m) => m.content.toLowerCase().includes(q) || m.tags.some((t) => t.toLowerCase().includes(q)))
    .map((m) => ({ id: m.id, score: 1 }))
    .sort((a, c) => c.score - a.score);
}
