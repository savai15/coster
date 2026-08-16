import { describe, it, expect } from 'vitest';
import { QualityGate } from '../../src/core/quality.js';
import { Memory } from '../../src/types/index.js';

describe('QualityGate', () => {
  const qualityGate = new QualityGate(4);

  const createMemory = (overrides: Partial<Memory> = {}): Memory => ({
    id: '550e8400-e29b-41d4-a716-446655440000',
    category: 'convention',
    content: 'Use 2-space indentation',
    importance: 0.8,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    accessedAt: new Date().toISOString(),
    accessCount: 0,
    tags: [],
    source: 'manual',
    ...overrides,
  });

  describe('evaluate', () => {
    it('should pass high-quality memory', () => {
      const memory = createMemory({
        category: 'decision',
        content: 'Chose PostgreSQL over MySQL for better JSON support. git blame shows commit abc123.',
        importance: 0.9,
        source: 'git-hook',
      });

      const result = qualityGate.evaluate(memory, []);
      expect(result.passed).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(4);
      expect(result.reasons.length).toBe(7);
    });

    it('should reject low-quality memory', () => {
      const memory = createMemory({
        category: 'preference',
        content: 'Write good code',
        importance: 0.1,
        source: 'manual',
      });

      const result = qualityGate.evaluate(memory, []);
      expect(result.passed).toBe(false);
      expect(result.score).toBeLessThan(4);
    });

    it('should detect duplicates', () => {
      const existing = createMemory({
        id: '550e8400-e29b-41d4-a716-446655440001',
        content: 'Use 2-space indentation',
      });

      const newMemory = createMemory({
        id: '550e8400-e29b-41d4-a716-446655440002',
        content: 'Use 2-space indentation',
      });

      const result = qualityGate.evaluate(newMemory, [existing]);
      expect(result.reasons).toContain('Duplicate');
    });

    it('should accept unique memories', () => {
      const existing = createMemory({
        id: '550e8400-e29b-41d4-a716-446655440001',
        content: 'Use 2-space indentation',
      });

      const newMemory = createMemory({
        id: '550e8400-e29b-41d4-a716-446655440002',
        content: 'Use functional components in React',
      });

      const result = qualityGate.evaluate(newMemory, [existing]);
      expect(result.reasons).toContain('Unique');
    });

    it('should check currency', () => {
      const oldMemory = createMemory({
        updatedAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString(),
      });

      const result = qualityGate.evaluate(oldMemory, []);
      expect(result.reasons).toContain('Outdated');
    });

    it('should check evidence', () => {
      const memoryWithEvidence = createMemory({
        content: 'Use TypeScript. See file: src/types.ts',
      });

      const result = qualityGate.evaluate(memoryWithEvidence, []);
      expect(result.reasons).toContain('Has evidence');
    });

    it('should check conciseness', () => {
      const verboseMemory = createMemory({
        content: 'x'.repeat(1000),
      });

      const result = qualityGate.evaluate(verboseMemory, []);
      expect(result.reasons).toContain('Too verbose');
    });
  });

  describe('custom minScore', () => {
    it('should respect custom threshold', () => {
      const strictGate = new QualityGate(7);
      const memory = createMemory({
        category: 'decision',
        content: 'Chose PostgreSQL. git blame shows commit abc123.',
        importance: 0.9,
        source: 'git-hook',
      });

      const result = strictGate.evaluate(memory, []);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(7);
    });
  });
});
