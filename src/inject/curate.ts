import { Storage } from '../core/storage.js';
import { loadConfig } from '../core/config.js';
import { TokenBudget, PrioritizedMemory } from './priority.js';
import { hybridSearch } from '../search/hybrid.js';
import { createEmbedder, isModelPresent } from '../embed/embedder.js';
import { EmbeddingsConfig } from '../types/index.js';

export interface CurateOptions {
  focus?: string;
  useSemantic?: boolean;
  budget?: number;
  maxMemories?: number;
}

function normalize(scores: number[]): { min: number; max: number; range: number } {
  const min = Math.min(...scores, 0);
  const max = Math.max(...scores, 0);
  return { min, max, range: max - min || 1 };
}

/**
 * Build a relevance-curated, budget-fitting list of memories for a project.
 *
 * Base ranking always reflects decayed importance (old memories fade unless
 * re-accessed). When a `focus` is supplied and semantic search is available,
 * the decayed ranking is blended with a normalized semantic score so the most
 * topically relevant memories float up. Semantic search only runs when an
 * embedding model is present locally - otherwise curation is purely lexical/age
 * based (no network, no model download).
 */
export async function curateContext(
  storage: Storage,
  projectPath: string,
  opts: CurateOptions = {}
): Promise<PrioritizedMemory[]> {
  const config = await loadConfig(projectPath);
  const injection = config.injection;
  const embeddings: EmbeddingsConfig = config.embeddings;

  const budget = new TokenBudget(opts.budget ?? 60000, {
    decayHalfLifeDays: config.lifecycle.decayHalfLifeDays,
    decayMinImportance: config.lifecycle.decayMinImportance,
    mode: injection.mode,
  });

  let list = budget.prioritize(storage.getAllMemories());

  const wantSemantic =
    opts.focus &&
    (opts.useSemantic ?? injection.useSemantic) &&
    embeddings.enabled;

  if (wantSemantic && (await isModelPresent(embeddings))) {
    const embedder = createEmbedder(embeddings);
    const hits = await hybridSearch(storage, opts.focus as string, {
      limit: 1000,
      embedder,
    });
    if (hits.length) {
      const byId = new Map(hits.map((h) => [h.memory.id, h.score]));
      const norm = normalize(hits.map((h) => h.score));
      const w = injection.semanticWeight;
      list = list
        .map((p) => {
          const sem = byId.has(p.memory.id)
            ? (byId.get(p.memory.id)! - norm.min) / norm.range
            : 0;
          return { ...p, score: (1 - w) * p.score + w * sem };
        })
        .sort((a, b) => b.score - a.score);
    }
  }

  if (opts.maxMemories) list = list.slice(0, opts.maxMemories);

  const cap = opts.maxMemories ?? injection.maxMemories;
  const budgetLimit = opts.budget ?? 60000;
  let total = 0;
  const out: PrioritizedMemory[] = [];
  for (const p of list) {
    if (out.length >= cap) break;
    if (total + p.tokens <= budgetLimit) {
      out.push(p);
      total += p.tokens;
    }
  }
  return out;
}

export function renderRecallMarkdown(list: PrioritizedMemory[]): string {
  if (!list.length) return '_No relevant memories found._';
  const byCategory = list.reduce((acc, p) => {
    (acc[p.memory.category] ||= []).push(p.memory);
    return acc;
  }, {} as Record<string, typeof list[number]['memory'][]>);

  const order = ['decision', 'convention', 'workaround', 'preference', 'investigation', 'recap', 'mistake'];
  const lines: string[] = ['# Recalled memories', ''];
  for (const cat of order) {
    const mems = byCategory[cat];
    if (!mems || !mems.length) continue;
    lines.push(`## ${cat.charAt(0).toUpperCase() + cat.slice(1)}`);
    for (const m of mems) lines.push(`- ${m.content}`);
    lines.push('');
  }
  return lines.join('\n').trim() + '\n';
}
