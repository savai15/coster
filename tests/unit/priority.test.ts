import { describe, it, expect } from 'vitest';
import { TokenBudget } from '../../src/inject/priority.js';
import { Memory } from '../../src/types/index.js';

function createMemory(overrides: Partial<Memory>): Memory {
  return {
    id: 'test-id',
    category: 'decision',
    content: 'Test content',
    importance: 0.8,
    accessCount: 10,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('TokenBudget', () => {
  it('estimates tokens from content length', () => {
    const budget = new TokenBudget(1000);
    expect(budget.estimateTokens('hello')).toBe(2);
    expect(budget.estimateTokens('12345678')).toBe(2);
    expect(budget.estimateTokens('a'.repeat(100))).toBe(25);
  });

  it('prioritizes memories by score', () => {
    const budget = new TokenBudget(1000);
    const memories = [
      createMemory({ id: '1', importance: 0.5, accessCount: 10 }),
      createMemory({ id: '2', importance: 0.9, accessCount: 50 }),
      createMemory({ id: '3', importance: 0.3, accessCount: 100 }),
    ];

    const result = budget.prioritize(memories);
    expect(result[0].memory.id).toBe('2');
  });

  it('respects token budget', () => {
    const budget = new TokenBudget(10);
    const memories = [
      createMemory({ id: '1', content: 'a'.repeat(100), importance: 1.0 }),
      createMemory({ id: '2', content: 'b'.repeat(100), importance: 1.0 }),
    ];

    const result = budget.prioritize(memories);
    expect(result.length).toBeLessThan(2);
  });

  it('handles empty memories', () => {
    const budget = new TokenBudget(1000);
    const result = budget.prioritize([]);
    expect(result.length).toBe(0);
  });

  it('includes tokens in result', () => {
    const budget = new TokenBudget(1000);
    const memories = [createMemory({ content: 'hello world' })];

    const result = budget.prioritize(memories);
    expect(result[0].tokens).toBe(3);
  });
});
