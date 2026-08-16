import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';

const cliPath = path.resolve(process.cwd(), 'dist', 'index.cjs');

let repoDir: string;

function run(args: string, cwd: string): string {
  return execSync(`node ${cliPath} ${args}`, { cwd, encoding: 'utf-8' });
}

describe('hooks command (git integration)', () => {
  beforeAll(() => {
    if (!fs.existsSync(cliPath)) {
      throw new Error('dist/index.cjs not built. Run `npm run build` before integration tests.');
    }
  });

  beforeAll(() => {
    repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'coster-hooks-'));
    execSync('git init -q', { cwd: repoDir });
    execSync('git config user.email "test@coster.dev"', { cwd: repoDir });
    execSync('git config user.name "Coster Test"', { cwd: repoDir });
  });

  afterEach(() => {
    // attempt uninstall to reset state
    try {
      run('hooks uninstall --force', repoDir);
    } catch {
      /* ignore */
    }
  });

  afterAll(() => {
    fs.rmSync(repoDir, { recursive: true, force: true });
  });

  it('installs git hook scripts and sets hooksPath', () => {
    run('init', repoDir);
    const out = run('hooks install --force', repoDir);
    expect(out).toContain('Hooks installed');

    const hooksDir = path.join(repoDir, '.coster', 'hooks');
    expect(fs.existsSync(path.join(hooksDir, 'post-commit'))).toBe(true);
    expect(fs.existsSync(path.join(hooksDir, 'post-checkout'))).toBe(true);

    const hooksPath = execSync('git config core.hooksPath', { cwd: repoDir, encoding: 'utf-8' }).trim();
    expect(fs.realpathSync(hooksPath)).toBe(fs.realpathSync(hooksDir));
  });

  it('lists installed hooks', () => {
    run('init', repoDir);
    run('hooks install --force', repoDir);
    const out = run('hooks list', repoDir);
    expect(out).toContain('post-commit');
    expect(out).toContain('post-checkout');
  });

  it('uninstalls and clears git config', () => {
    run('init', repoDir);
    run('hooks install --force', repoDir);
    const out = run('hooks uninstall --force', repoDir);
    expect(out).toContain('uninstalled');

    const hooksDir = path.join(repoDir, '.coster', 'hooks');
    expect(fs.existsSync(path.join(hooksDir, 'post-commit'))).toBe(false);
    // git config core.hooksPath should be unset (command fails)
    let configSet = true;
    try {
      execSync('git config core.hooksPath', { cwd: repoDir, stdio: 'pipe' });
    } catch {
      configSet = false;
    }
    expect(configSet).toBe(false);
  });
});
