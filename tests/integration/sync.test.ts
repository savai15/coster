import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { Storage } from '../../src/core/storage.js';
import { ClaudeGenerator } from '../../src/inject/claude.js';
import { AgentsGenerator } from '../../src/inject/agents.js';
import { detectStack } from '../../src/capture/detect.js';

describe('sync integration', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'coster-sync-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('generates CLAUDE.md from memories', async () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), '{}');
    const storage = await Storage.create(tmpDir);

    storage.createMemory({
      category: 'decision',
      content: 'Use PostgreSQL',
      importance: 0.9,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      accessedAt: new Date().toISOString(),
      accessCount: 0,
      tags: [],
      source: 'manual',
    });

    const memories = storage.getAllMemories();
    const stack = detectStack(tmpDir);

    const generator = new ClaudeGenerator();
    const output = generator.generate({
      path: tmpDir,
      name: 'test-project',
      stack,
      memories,
      sessions: [],
      lastUpdated: new Date().toISOString(),
    });

    fs.writeFileSync(path.join(tmpDir, 'CLAUDE.md'), output);

    expect(fs.existsSync(path.join(tmpDir, 'CLAUDE.md'))).toBe(true);
    expect(output).toContain('Use PostgreSQL');

    storage.close();
  });

  it('generates AGENTS.md from memories', async () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), '{}');
    const storage = await Storage.create(tmpDir);

    storage.createMemory({
      category: 'convention',
      content: 'Use 2-space indentation',
      importance: 0.8,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      accessedAt: new Date().toISOString(),
      accessCount: 0,
      tags: [],
      source: 'manual',
    });

    const memories = storage.getAllMemories();
    const stack = detectStack(tmpDir);

    const generator = new AgentsGenerator();
    const output = generator.generate({
      path: tmpDir,
      name: 'test-project',
      stack,
      memories,
      sessions: [],
      lastUpdated: new Date().toISOString(),
    });

    fs.writeFileSync(path.join(tmpDir, 'AGENTS.md'), output);

    expect(fs.existsSync(path.join(tmpDir, 'AGENTS.md'))).toBe(true);
    expect(output).toContain('Use 2-space indentation');

    storage.close();
  });

  it('handles empty memories gracefully', async () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), '{}');
    const storage = await Storage.create(tmpDir);

    const memories = storage.getAllMemories();
    const stack = detectStack(tmpDir);

    const generator = new ClaudeGenerator();
    const output = generator.generate({
      path: tmpDir,
      name: 'test-project',
      stack,
      memories,
      sessions: [],
      lastUpdated: new Date().toISOString(),
    });

    expect(output).toContain('# test-project');
    expect(output).not.toContain('## Architecture Decisions');

    storage.close();
  });
});
