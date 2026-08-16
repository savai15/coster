import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync, ExecSyncOptions } from 'child_process';
import { Storage } from '../../src/core/storage.js';

const cliPath = path.resolve(__dirname, '../../dist/index.cjs');

function mkTmp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'coster-qol2-'));
}

function run(tmp: string, args: string, opts: Partial<ExecSyncOptions> = {}): string {
  const full: ExecSyncOptions = { cwd: tmp, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'], ...opts };
  try {
    return execSync(`node "${cliPath}" ${args}`, full).toString();
  } catch (e: any) {
    return (e.stdout?.toString() ?? '') + '\n' + (e.stderr?.toString() ?? '');
  }
}

describe('QoL: note / show / completion', () => {
  let tmp: string;
  beforeEach(() => {
    tmp = mkTmp();
    run(tmp, 'init --minimal');
  });
  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('note auto-categorizes and syncs a portable COSTER.md', () => {
    const out = run(tmp, 'note "decided to standardize on feature flags"');
    expect(out).toContain('Captured (decision)');
    expect(fs.existsSync(path.join(tmp, 'COSTER.md'))).toBe(true);
    const coster = fs.readFileSync(path.join(tmp, 'COSTER.md'), 'utf-8');
    expect(coster).toContain('COSTER:START');
    expect(coster).toContain('standardize on feature flags');
  });

  it('note infers workaround category', async () => {
    const out = run(tmp, 'note "found a bug in parser, use workaround X"');
    expect(out).toContain('Captured (workaround)');
    const storage = await Storage.create(tmp);
    try {
      const memories = storage.getAllMemories();
      expect(memories.some((m) => m.category === 'workaround')).toBe(true);
    } finally {
      await storage.close();
    }
  });

  it('show prints generated memory for a tool', () => {
    run(tmp, 'note "decided to use Postgres for the primary store"');
    const out = run(tmp, 'show coster');
    expect(out).toContain('COSTER');
    expect(out).toContain('Postgres');
  });

  it('completion outputs a shell script', () => {
    const bash = run(tmp, 'completion bash');
    expect(bash).toContain('_coster');
    const zsh = run(tmp, 'completion zsh');
    expect(zsh).toContain('compdef _coster');
    const fish = run(tmp, 'completion fish');
    expect(fish).toContain('complete -c coster');
    const pwsh = run(tmp, 'completion pwsh');
    expect(pwsh).toContain('Register-ArgumentCompleter');
  });

  it('completion errors on unknown shell', () => {
    const out = run(tmp, 'completion tcsh');
    expect(out.toLowerCase()).toContain('unsupported shell');
  });
});

describe('QoL: portable init fallback', () => {
  let tmp: string;
  beforeEach(() => {
    tmp = mkTmp();
  });
  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('plain init generates a portable COSTER.md even with no detected tool', () => {
    run(tmp, 'init');
    expect(fs.existsSync(path.join(tmp, 'COSTER.md'))).toBe(true);
    const coster = fs.readFileSync(path.join(tmp, 'COSTER.md'), 'utf-8');
    expect(coster).toContain('This file is generated and maintained by');
  });

  it('--tool restricts generated files to that tool plus portable COSTER.md', () => {
    run(tmp, 'init --tool claude-code');
    expect(fs.existsSync(path.join(tmp, 'CLAUDE.md'))).toBe(true);
    expect(fs.existsSync(path.join(tmp, 'AGENTS.md'))).toBe(false);
    expect(fs.existsSync(path.join(tmp, 'COSTER.md'))).toBe(true);
  });
});
