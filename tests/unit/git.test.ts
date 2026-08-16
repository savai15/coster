import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import {
  parseCostDirective,
  readGitCommit,
  readGitCheckout,
  isGitRepo,
  GitCommit,
} from '../../src/capture/git.js';

describe('parseCostDirective', () => {
  it('parses a valid directive', () => {
    const result = parseCostDirective('cost:decision: Use PostgreSQL for auth');
    expect(result).toEqual({ category: 'decision', content: 'Use PostgreSQL for auth' });
  });

  it('parses with leading whitespace', () => {
    const result = parseCostDirective('fix: stuff\n\ncost:convention: Use 2-space indent');
    expect(result).toEqual({ category: 'convention', content: 'Use 2-space indent' });
  });

  it('returns null when absent', () => {
    expect(parseCostDirective('just a normal commit message')).toBeNull();
  });

  it('returns null for invalid category', () => {
    expect(parseCostDirective('cost:banana: something')).toBeNull();
  });

  it('returns null for empty content', () => {
    expect(parseCostDirective('cost:decision:')).toBeNull();
  });
});

describe('git reading (temp repo)', () => {
  let repoDir: string;

  beforeEach(() => {
    repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'coster-git-'));
    execSync('git init -q', { cwd: repoDir });
    execSync('git config user.email "test@coster.dev"', { cwd: repoDir });
    execSync('git config user.name "Coster Test"', { cwd: repoDir });
  });

  afterEach(() => {
    fs.rmSync(repoDir, { recursive: true, force: true });
  });

  it('detects git repo', () => {
    expect(isGitRepo(repoDir)).toBe(true);
    expect(isGitRepo(path.join(os.tmpdir()))).toBe(false);
  });

  it('reads commit hash, message and files', () => {
    fs.writeFileSync(path.join(repoDir, 'a.txt'), 'hello');
    execSync('git add -A', { cwd: repoDir });
    execSync('git commit -q -m "cost:decision: Use PostgreSQL"', { cwd: repoDir });

    const commit: GitCommit | null = readGitCommit(repoDir);
    expect(commit).not.toBeNull();
    expect(commit!.hash).toMatch(/^[0-9a-f]{7,40}$/);
    expect(commit!.message).toContain('Use PostgreSQL');
    expect(commit!.files).toContain('a.txt');
  });

  it('reads checkout branch', () => {
    fs.writeFileSync(path.join(repoDir, 'seed.txt'), 'seed');
    execSync('git add -A', { cwd: repoDir });
    execSync('git commit -q -m "initial"', { cwd: repoDir });
    const checkout = readGitCheckout(repoDir);
    expect(checkout).not.toBeNull();
    expect(['master', 'main']).toContain(checkout!.to);
  });
});
