import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { Storage } from '../../src/core/storage.js';
import { curateContext } from '../../src/inject/curate.js';

function tmpProject(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'coster-curate-'));
}

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

describe('curateContext', () => {
  let projectPath: string;
  let storage: Storage;

  beforeEach(async () => {
    projectPath = tmpProject();
    storage = await Storage.create(projectPath);
  });

  afterEach(() => {
    storage.close();
    fs.rmSync(projectPath, { recursive: true, force: true });
  });

  it('ranks a recent memory above an aged-but-important one (decay)', async () => {
    storage.createMemory({
      category: 'decision',
      content: 'Old but very important decision',
      importance: 1.0,
      tags: ['x'],
      source: 'manual',
      createdAt: isoDaysAgo(730),
      updatedAt: isoDaysAgo(730),
      accessedAt: isoDaysAgo(730),
      accessCount: 0,
      metadata: {},
    });
    storage.createMemory({
      category: 'convention',
      content: 'Recent convention we just agreed on',
      importance: 0.5,
      tags: ['x'],
      source: 'manual',
      createdAt: isoDaysAgo(1),
      updatedAt: isoDaysAgo(1),
      accessedAt: isoDaysAgo(1),
      accessCount: 0,
      metadata: {},
    });

    const list = await curateContext(storage, projectPath, { useSemantic: false });
    expect(list.length).toBeGreaterThanOrEqual(2);
    expect(list[0].memory.content).toBe('Recent convention we just agreed on');
  });

  it('respects maxMemories cap', async () => {
    for (let i = 0; i < 20; i++) {
      storage.createMemory({
        category: 'convention',
        content: `memory number ${i}`,
        importance: 0.5,
        tags: ['x'],
        source: 'manual',
      });
    }
    const list = await curateContext(storage, projectPath, { useSemantic: false, maxMemories: 5 });
    expect(list.length).toBe(5);
  });
});
