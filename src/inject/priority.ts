import { Memory } from '../types/index.js';

export interface PrioritizedMemory {
  memory: Memory;
  score: number;
  tokens: number;
}

export class TokenBudget {
  private budget: number;

  constructor(budget: number) {
    this.budget = budget;
  }

  estimateTokens(content: string): number {
    return Math.ceil(content.length / 4);
  }

  prioritize(memories: Memory[]): PrioritizedMemory[] {
    const prioritized = memories
      .map(memory => ({
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
    const importanceWeight = 0.4;
    const accessWeight = 0.2;
    const recencyWeight = 0.2;
    const categoryWeight = 0.2;

    const importanceScore = memory.importance;
    const accessScore = Math.min(memory.accessCount / 100, 1);

    const daysSinceUpdate = Math.floor(
      (Date.now() - new Date(memory.updatedAt).getTime()) / (1000 * 60 * 60 * 24)
    );
    const recencyScore = Math.max(0, 1 - daysSinceUpdate / 30);

    const categoryScores: Record<string, number> = {
      decision: 1.0,
      workaround: 0.9,
      investigation: 0.8,
      convention: 0.7,
      preference: 0.6,
      recap: 0.5,
      mistake: 0.4,
    };
    const categoryScore = categoryScores[memory.category] || 0.5;

    return (
      importanceScore * importanceWeight +
      accessScore * accessWeight +
      recencyScore * recencyWeight +
      categoryScore * categoryWeight
    );
  }
}
