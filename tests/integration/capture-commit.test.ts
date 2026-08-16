import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';

const cliPath = path.resolve(process.cwd(), 'dist', 'index.cjs');
let repoDir: string;

function run(args: string, cwd: string): string {
  return execSync(`node ${cliPath} ${args}`, { cwd, encoding: 'utf-8' });
}

describe('capture commit (git hook flow)', () => {
  beforeAll(() => {
    if (!fs.existsSync(cliPath)) {
      throw new Error('dist/index.cjs not built. Run `npm run build` before integration tests.');
    }
    repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'coster-commit-'));
    execSync('git init -q', { cwd: repoDir });
    execSync('git config user.email "test@coster.dev"', { cwd: repoDir });
    execSync('git config user.name "Coster Test"', { cwd: repoDir });
    run('init', repoDir);
  });

  afterAll(() => {
    fs.rmSync(repoDir, { recursive: true, force: true });
  });

  it('captures a memory from commit with a cost directive', () => {
    fs.writeFileSync(path.join(repoDir, 'config.json'), '{"db":"postgres"}');
    execSync('git add -A', { cwd: repoDir });
    execSync('git commit -q -m "Add config" -m "cost:decision: Use PostgreSQL for the primary database"', { cwd: repoDir });

    run('capture commit', repoDir);

    const out = run('list --json -c decision', repoDir);
    const memories = JSON.parse(out);
    expect(Array.isArray(memories)).toBe(true);
    const match = memories.find((m: any) => m.content.includes('PostgreSQL'));
    expect(match).toBeTruthy();
    expect(match.source).toBe('git-hook');
  });

  it('records commit into a session even without directive', () => {
    fs.writeFileSync(path.join(repoDir, 'readme.txt'), 'hello');
    execSync('git add -A', { cwd: repoDir });
    execSync('git commit -q -m "docs: update readme"', { cwd: repoDir });

    run('capture commit', repoDir);

    const out = run('session list --json', repoDir);
    const sessions = JSON.parse(out);
    expect(sessions.length).toBeGreaterThan(0);
    const files = sessions.flatMap((s: any) => s.filesChanged);
    expect(files).toContain('readme.txt');
  });
});
