import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';

const cliPath = path.resolve(process.cwd(), 'dist', 'index.cjs');
let projectDir: string;

function run(args: string, cwd: string): string {
  return execSync(`node ${cliPath} ${args}`, { cwd, encoding: 'utf-8' });
}

describe('session command', () => {
  beforeAll(() => {
    if (!fs.existsSync(cliPath)) {
      throw new Error('dist/index.cjs not built. Run `npm run build` before integration tests.');
    }
    projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'coster-session-cli-'));
    run('init', projectDir);
  });

  afterAll(() => {
    fs.rmSync(projectDir, { recursive: true, force: true });
  });

  it('starts a session and injects a memory file', () => {
    run('capture --text "Always use 2-space indentation" --category convention --no-quality', projectDir);
    run('session start', projectDir);

    const claudePath = path.join(projectDir, 'CLAUDE.md');
    expect(fs.existsSync(claudePath)).toBe(true);
    const content = fs.readFileSync(claudePath, 'utf-8');
    expect(content).toContain('2-space indentation');
  });

  it('lists the active session', () => {
    const out = run('session list --json --active', projectDir);
    const sessions = JSON.parse(out);
    expect(Array.isArray(sessions)).toBe(true);
    expect(sessions.length).toBeGreaterThan(0);
    expect(sessions[0].endedAt ?? null).toBeNull();
  });

  it('ends the session', () => {
    run('session end --summary "Worked on indentation"', projectDir);
    const out = run('session list --json --active', projectDir);
    const active = JSON.parse(out);
    expect(active.length).toBe(0);
  });
});
