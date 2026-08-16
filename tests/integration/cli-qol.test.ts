import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync, ExecSyncOptions } from 'child_process';
import { Storage } from '../../src/core/storage.js';

const cliPath = path.resolve(__dirname, '../../dist/index.cjs');

function mkTmp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'coster-qol-'));
}

function run(tmp: string, args: string, opts: Partial<ExecSyncOptions> = {}): string {
  const full: ExecSyncOptions = { cwd: tmp, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'], ...opts };
  try {
    return execSync(`node "${cliPath}" ${args}`, full).toString();
  } catch (e: any) {
    return (e.stdout?.toString() ?? '') + '\n' + (e.stderr?.toString() ?? '');
  }
}

describe('CLI quality-of-life commands', () => {
  let tmp: string;
  beforeEach(() => {
    tmp = mkTmp();
  });
  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('config get/set/list works', () => {
    run(tmp, 'init');
    const before = run(tmp, 'config get quality.minScore').trim();
    expect(before).toBe('4');
    run(tmp, 'config set quality.minScore 6');
    const after = run(tmp, 'config get quality.minScore').trim();
    expect(after).toBe('6');
    const listOut = run(tmp, 'config list');
    expect(listOut).toContain('quality');
  });

  it('memory add/list/show/edit/delete works', () => {
    run(tmp, 'init');
    run(tmp, 'memory add -c decision -t "Use feature flags" --tags release,xp');
    const list = run(tmp, 'memory list --json');
    const memories = JSON.parse(list);
    expect(memories.length).toBe(1);
    const id = memories[0].id;

    const show = JSON.parse(run(tmp, `memory show ${id}`));
    expect(show.content).toBe('Use feature flags');
    expect(show.tags).toEqual(['release', 'xp']);

    run(tmp, `memory edit ${id} -t "Use feature flags (v2)"`);
    const edited = JSON.parse(run(tmp, `memory show ${id}`));
    expect(edited.content).toBe('Use feature flags (v2)');

    run(tmp, `memory delete ${id}`);
    const after = JSON.parse(run(tmp, 'memory list --json'));
    expect(after.length).toBe(0);
  });

  it('search records access and stats reflects it', () => {
    run(tmp, 'init');
    run(tmp, 'memory add -c convention -t "We use TypeScript strict mode"');
    const before = JSON.parse(run(tmp, 'stats --json')).totalAccess;
    expect(before).toBe(0);
    run(tmp, 'search "TypeScript"');
    const after = JSON.parse(run(tmp, 'stats --json')).totalAccess;
    expect(after).toBe(1);
  });

  it('status reports initialized project', () => {
    run(tmp, 'init');
    const out = run(tmp, 'status');
    expect(out).toContain('Initialized');
    expect(out).toContain('Memories');
  });
});

describe('init --auto bootstrap', () => {
  let tmp: string;
  beforeEach(() => {
    tmp = mkTmp();
    execSync('git init -q', { cwd: tmp });
    execSync('git config user.email t@t.com', { cwd: tmp });
    execSync('git config user.name t', { cwd: tmp });
  });
  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('installs hooks, syncs, and backfills from git history', async () => {
    fs.writeFileSync(path.join(tmp, 'AGENTS.md'), '# project\n');
    fs.writeFileSync(path.join(tmp, 'file.txt'), 'hi');
    execSync('git add -A && git commit -q -m "initial"', { cwd: tmp });
    fs.writeFileSync(path.join(tmp, 'file.txt'), 'changed');
    execSync('git add -A', { cwd: tmp });
    execSync('git commit -q -m "cost:decision: Standardize on feature flags"', { cwd: tmp });

    const out = run(tmp, 'init --auto');
    expect(out).toContain('Git repo:        yes');
    expect(out).toContain('Detected tool:   opencode');
    expect(out).toContain('Backfill:        imported 1');

    const storage = await Storage.create(tmp);
    try {
      const memories = storage.getAllMemories();
      expect(memories.length).toBe(1);
      expect(memories[0].category).toBe('decision');
      expect(memories[0].content).toBe('Standardize on feature flags');
      expect(memories[0].source).toBe('auto');
    } finally {
      await storage.close();
    }
  });
});
