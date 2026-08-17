import { describe, it, expect } from 'vitest';
import { decayImportance } from '../../src/lifecycle/decay.js';

describe('decayImportance', () => {
  it('keeps full importance at zero age', () => {
    expect(decayImportance(1.0, 0, 180, 0.2)).toBeCloseTo(1.0, 6);
  });

  it('halves at one half-life', () => {
    // max(0.2, 1.0 * 0.5) = 0.5
    expect(decayImportance(1.0, 180, 180, 0.2)).toBeCloseTo(0.5, 6);
  });

  it('converges to the floor for very old memories', () => {
    expect(decayImportance(1.0, 1e9, 180, 0.2)).toBeCloseTo(0.2, 6);
  });

  it('never decays below the configured floor', () => {
    // base 0.3 -> max(0.2, 0.3 * ~0) = 0.2
    expect(decayImportance(0.3, 1e9, 180, 0.2)).toBeCloseTo(0.2, 6);
    expect(decayImportance(0.3, 1e9, 180, 0.2)).toBeGreaterThanOrEqual(0.2);
  });

  it('respects the half-life rate', () => {
    const fast = decayImportance(1.0, 90, 90, 0.2);
    const slow = decayImportance(1.0, 90, 180, 0.2);
    expect(fast).toBeLessThan(slow);
  });
});
