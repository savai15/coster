import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { listAvailableTools, discoverMissingTools } from '../../src/inject/detect.js';

describe('tool discovery (M0)', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'coster-tools-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('lists every tool that has a marker file present', () => {
    fs.writeFileSync(path.join(tmpDir, 'AGENTS.md'), '');
    fs.writeFileSync(path.join(tmpDir, '.codex'), '');
    const tools = listAvailableTools(tmpDir);
    expect(tools).toContain('opencode');
    expect(tools).toContain('codex');
  });

  it('returns an empty array when no markers are present', () => {
    expect(listAvailableTools(tmpDir)).toEqual([]);
  });

  it('discovers tools present on disk but not enabled in config', () => {
    fs.writeFileSync(path.join(tmpDir, '.cursorrules'), '');
    fs.writeFileSync(path.join(tmpDir, 'CLAUDE.md'), '');
    const enabled = ['claude-code', 'coster'];
    const missing = discoverMissingTools(tmpDir, enabled);
    expect(missing).toContain('cursor');
    expect(missing).not.toContain('claude-code');
    expect(missing).not.toContain('coster');
  });
});
