import { Memory, ProjectContext } from '../types/index.js';
import { TokenBudget, PrioritizedMemory } from './priority.js';

export abstract class BaseGenerator {
  protected budget: TokenBudget;
  protected toolName: string;

  constructor(tokenBudget: number, toolName: string) {
    this.budget = new TokenBudget(tokenBudget);
    this.toolName = toolName;
  }

  abstract generate(context: ProjectContext): string;

  protected groupByCategory(memories: PrioritizedMemory[]): Record<string, PrioritizedMemory[]> {
    return memories.reduce((acc, m) => {
      if (!acc[m.memory.category]) {
        acc[m.memory.category] = [];
      }
      acc[m.memory.category].push(m);
      return acc;
    }, {} as Record<string, PrioritizedMemory[]>);
  }

  protected formatMemoryList(memories: PrioritizedMemory[]): string {
    return memories.map(m => `- ${m.memory.content}`).join('\n');
  }
}
