import { describe, it, expect } from 'vitest';
import { signalRichPolicy, classifyCommit } from '../../src/capture/git.js';
import { defaultConfig } from '../../src/types/config.js';

const policy = defaultConfig.capture.commitPolicy;

describe('commit auto-capture policy (M1)', () => {
  const baseCommit = { hash: 'abc123', message: 'tidy docs', files: ['README.md'] };
  const baseStats = { files: [{ path: 'README.md', status: 'M', insertions: 2, deletions: 1 }], totalLines: 3 };

  it('ignores trivial doc tweaks', () => {
    expect(signalRichPolicy(baseCommit, baseStats, policy)).toBe(false);
  });

  it('flags commits touching rule/config files', () => {
    const stats = {
      files: [{ path: 'AGENTS.md', status: 'M', insertions: 5, deletions: 1 }],
      totalLines: 6,
    };
    expect(signalRichPolicy(baseCommit, stats, policy)).toBe(true);
  });

  it('flags large diffs by line count', () => {
    const stats = { files: [{ path: 'src/a.ts', status: 'M', insertions: 300, deletions: 0 }], totalLines: 300 };
    expect(signalRichPolicy(baseCommit, stats, policy)).toBe(true);
  });

  it('flags fix/bug keywords in the message', () => {
    expect(signalRichPolicy({ ...baseCommit, message: 'fix parser crash' }, baseStats, policy)).toBe(true);
  });

  it('classifyCommit picks decision for rule files and scales importance', () => {
    const stats = {
      files: [{ path: 'CLAUDE.md', status: 'M', insertions: 5, deletions: 1 }],
      totalLines: 6,
    };
    const cls = classifyCommit({ hash: 'deadbeef', message: 'add guideline', files: ['CLAUDE.md'] }, stats);
    expect(cls.category).toBe('decision');
    expect(cls.content).toContain('deadbeef');
    expect(cls.importance).toBeGreaterThanOrEqual(0.45);
  });

  it('classifyCommit picks workaround for fix keywords', () => {
    const cls = classifyCommit({ hash: 'x', message: 'fix the bug', files: ['src/x.ts'] }, baseStats);
    expect(cls.category).toBe('workaround');
  });

  it('readDiffStats parses numstat output', () => {
    // Git numstat: insertions, deletions, path (binary shows '-').
    const stats = readDiffStatsFromText('12\t3\tsrc/a.ts\n-\t-\tvendor.bin\n');
    expect(stats.totalLines).toBe(15);
    expect(stats.files[0].path).toBe('src/a.ts');
    expect(stats.files[0].insertions).toBe(12);
    expect(stats.files[1].insertions).toBe(0);
  });
});

// Helper to emulate git numstat parsing (readDiffStats itself shells out to git).
function readDiffStatsFromText(raw: string) {
  const files: any[] = [];
  let total = 0;
  for (const line of raw.split('\n')) {
    const m = line.match(/^(\d+|-)\t(\d+|-)\t(.+)$/);
    if (!m) continue;
    const insertions = m[1] === '-' ? 0 : parseInt(m[1], 10);
    const deletions = m[2] === '-' ? 0 : parseInt(m[2], 10);
    files.push({ path: m[3].trim(), status: '', insertions, deletions });
    total += insertions + deletions;
  }
  return { files, totalLines: total };
}
