import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync, ExecSyncOptions } from 'child_process';

const cliPath = path.resolve(__dirname, '../../dist/index.cjs');

function mkTmp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'coster-autoinit-'));
}
function run(tmp: string, args: string, opts: Partial<ExecSyncOptions> = {}): string {
  const full: ExecSyncOptions = { cwd: tmp, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'], ...opts };
  try {
    return execSync(`node "${cliPath}" ${args}`, full).toString();
  } catch (e: any) {
    return (e.stdout?.toString() ?? '') + '\n' + (e.stderr?.toString() ?? '');
  }
}

describe('M0 zero-config foundations', () => {
  let tmp: string;
  beforeEach(() => {
    tmp = mkTmp();
  });
  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('auto-initializes on the first command and captures the memory', () => {
    const out = run(tmp, 'note "decided to use feature flags"');
    expect(out).toContain('auto-setup');
    expect(fs.existsSync(path.join(tmp, '.coster', 'config.json'))).toBe(true);
    expect(fs.existsSync(path.join(tmp, 'COSTER.md'))).toBe(true);
    const list = JSON.parse(run(tmp, 'memory list --json'));
    expect(list.length).toBe(1);
    expect(list[0].content).toBe('decided to use feature flags');
  });

  it('doctor reports health with no ERROR after init', () => {
    run(tmp, 'init');
    run(tmp, 'mcp-install');
    const out = run(tmp, 'doctor');
    expect(out).toContain('Coster doctor');
    expect(out).toContain('Initialized');
    expect(out).toContain('MCP registered');
    expect(out).not.toContain('[ERR ');
  });

  it('mcp-install is idempotent (single coster entry)', () => {
    run(tmp, 'init');
    run(tmp, 'mcp-install');
    run(tmp, 'mcp-install');
    const mcp = JSON.parse(fs.readFileSync(path.join(tmp, '.mcp.json'), 'utf-8'));
    expect(mcp.mcpServers.coster).toBeDefined();
    expect(mcp.mcpServers.coster.command).toBe('npx');
    const costerKeys = Object.keys(mcp.mcpServers).filter((k) => k === 'coster');
    expect(costerKeys.length).toBe(1);
  });

  it('sync auto-enables a newly detected assistant tool', () => {
    fs.writeFileSync(path.join(tmp, 'AGENTS.md'), '# project\n');
    run(tmp, 'init');
    // User later adds a Codex workspace; sync should pick it up automatically.
    fs.mkdirSync(path.join(tmp, '.codex'), { recursive: true });
    fs.writeFileSync(path.join(tmp, '.codex', 'memory.md'), '');
    const out = run(tmp, 'sync');
    expect(out).toContain('Auto-enabled codex');
    const cfg = JSON.parse(fs.readFileSync(path.join(tmp, '.coster', 'config.json'), 'utf-8'));
    expect(cfg.tools.find((t: any) => t.name === 'codex').enabled).toBe(true);
  });

  it('mcp-remove deletes the coster entry', () => {
    run(tmp, 'init');
    expect(fs.existsSync(path.join(tmp, '.mcp.json'))).toBe(true);
    run(tmp, 'mcp-remove');
    const mcp = JSON.parse(fs.readFileSync(path.join(tmp, '.mcp.json'), 'utf-8'));
    expect(mcp.mcpServers?.coster).toBeUndefined();
  });
});
