import { Memory } from '../types/index.js';
import { decayImportance } from '../lifecycle/decay.js';

export interface PrioritizedMemory {
  memory: Memory;
  score: number;
  tokens: number;
}

export interface PriorityOptions {
  decayHalfLifeDays?: number;
  decayMinImportance?: number;
  mode?: 'curated' | 'all';
}

const CATEGORY_WEIGHTS: Record<string, number> = {
  decision: 1.0,
  workaround: 0.9,
  investigation: 0.8,
  convention: 0.7,
  preference: 0.6,
  recap: 0.5,
  mistake: 0.4,
};

const IMPORTANCE_WEIGHT = 0.4;
const ACCESS_WEIGHT = 0.2;
const RECENCY_WEIGHT = 0.2;
const CATEGORY_WEIGHT = 0.2;

export class TokenBudget {
  private budget: number;
  private opts: PriorityOptions;

  constructor(budget: number, opts: PriorityOptions = {}) {
    this.budget = budget;
    this.opts = opts;
  }

  estimateTokens(content: string): number {
    return Math.ceil(content.length / 4);
  }

  prioritize(memories: Memory[]): PrioritizedMemory[] {
    const prioritized = memories
      .map((memory) => ({
        memory,
        score: this.calculateScore(memory),
        tokens: this.estimateTokens(memory.content),
      }))
      .sort((a, b) => b.score - a.score);

    let totalTokens = 0;
    const result: PrioritizedMemory[] = [];

    for (const item of prioritized) {
      if (totalTokens + item.tokens <= this.budget) {
        result.push(item);
        totalTokens += item.tokens;
      }
    }

    return result;
  }

  private calculateScore(memory: Memory): number {
    // `all` mode: keep insertion (recency) order, only fit to budget.
    if (this.opts.mode === 'all') return 1;

    const baseValue =
      memory.metadata && typeof memory.metadata.baseImportance === 'number'
        ? (memory.metadata.baseImportance as number)
        : memory.importance;

    let importanceScore = baseValue;
    if (
      this.opts.decayHalfLifeDays &&
      this.opts.decayMinImportance !== undefined
    ) {
      const days = Math.max(
        0,
        (Date.now() - new Date(memory.updatedAt).getTime()) / (1000 * 60 * 60 * 24)
      );
      importanceScore = decayImportance(
        baseValue,
        days,
        this.opts.decayHalfLifeDays,
        this.opts.decayMinImportance
      );
    }

    const accessScore = Math.min(memory.accessCount / 100, 1);

    const daysSinceUpdate = Math.floor(
      (Date.now() - new Date(memory.updatedAt).getTime()) / (1000 * 60 * 60 * 24)
    );
    const recencyScore = Math.max(0, 1 - daysSinceUpdate / 30);

    const categoryScore = CATEGORY_WEIGHTS[memory.category] ?? 0.5;

    return (
      importanceScore * IMPORTANCE_WEIGHT +
      accessScore * ACCESS_WEIGHT +
      recencyScore * RECENCY_WEIGHT +
      categoryScore * CATEGORY_WEIGHT
    );
  }
}
