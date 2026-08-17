import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { parseTranscript } from '../../src/capture/transcript.js';

describe('transcript import (M1)', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'coster-transcript-'));
  });
  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('extracts decisions and workarounds from a Claude jsonl export', () => {
    const jsonl = [
      JSON.stringify({ role: 'user', content: 'should we cache?' }),
      JSON.stringify({ role: 'assistant', content: 'We decided to use Redis for caching to avoid DB load.' }),
      JSON.stringify({ role: 'assistant', content: 'There was a bug in the parser that dropped empty lines; fixed with a guard.' }),
      JSON.stringify({ role: 'user', content: 'nice' }),
    ].join('\n');

    const file = path.join(tmpDir, 'claude.jsonl');
    fs.writeFileSync(file, jsonl);

    const candidates = parseTranscript(file, 'claude');
    const categories = candidates.map((c) => c.category);
    expect(categories).toContain('decision');
    expect(categories).toContain('workaround');
    expect(candidates.every((c) => c.source === 'import')).toBe(true);
  });

  it('parses an OpenCode-style json messages array', () => {
    const ocode = JSON.stringify({
      messages: [
        { role: 'user', content: 'preference?' },
        { role: 'assistant', content: 'I prefer using pnpm over npm for speed.' },
      ],
    });
    const file = path.join(tmpDir, 'opencode.json');
    fs.writeFileSync(file, ocode);

    const candidates = parseTranscript(file, 'opencode');
    expect(candidates.some((c) => c.category === 'preference')).toBe(true);
  });

  it('deduplicates identical sentences', () => {
    const jsonl = [
      JSON.stringify({ role: 'assistant', content: 'We decided to use Postgres.' }),
      JSON.stringify({ role: 'assistant', content: 'We decided to use Postgres.' }),
    ].join('\n');
    const file = path.join(tmpDir, 'dup.jsonl');
    fs.writeFileSync(file, jsonl);

    const candidates = parseTranscript(file, 'claude');
    const decisions = candidates.filter((c) => c.content.includes('Postgres'));
    expect(decisions.length).toBe(1);
  });
});
