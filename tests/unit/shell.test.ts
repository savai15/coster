import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { parseShellLog } from '../../src/capture/shell.js';

describe('shell log capture (M1)', () => {
  let logPath: string;

  beforeEach(() => {
    logPath = path.join(os.tmpdir(), `coster-shell-${Date.now()}.log`);
  });
  afterEach(() => {
    fs.rmSync(logPath, { force: true });
  });

  it('keeps failures and notable commands, drops noise', () => {
    fs.writeFileSync(
      logPath,
      ['0\tnpm install express', '0\tfoobar baz', '0\tgit status', '2\tdocker compose up'].join('\n') + '\n'
    );

    const candidates = parseShellLog(logPath);
    const contents = candidates.map((c) => c.content);
    expect(contents.some((c) => c.includes('npm install express'))).toBe(true);
    expect(contents.some((c) => c.includes('git status'))).toBe(true);
    expect(contents.some((c) => c.includes('docker compose up'))).toBe(true);
    // "foobar baz" succeeded and is not a notable command -> excluded
    expect(contents.some((c) => c.includes('foobar'))).toBe(false);
    expect(candidates.find((c) => c.content.includes('foobar'))).toBeUndefined();
  });

  it('tags failures as mistakes', () => {
    fs.writeFileSync(logPath, '1\tnpm run build\n');
    const candidates = parseShellLog(logPath);
    expect(candidates[0].category).toBe('mistake');
  });
});
