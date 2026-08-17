/**
 * Exponential importance decay. `base` is the memory's original importance
 * (stored as `metadata.baseImportance`); age in days is measured from the
 * last update. Returns a value no lower than `minImportance`.
 */
export function decayImportance(
  base: number,
  daysSinceUpdated: number,
  halfLifeDays: number,
  minImportance: number
): number {
  const factor = Math.pow(0.5, daysSinceUpdated / halfLifeDays);
  return Math.max(minImportance, base * factor);
}
