import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { Storage } from '../../src/core/storage.js';
import { generateExports } from '../../src/core/export.js';

function tmpProject(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'coster-export-'));
}

async function seed(projectPath: string): Promise<Storage> {
  const storage = await Storage.create(projectPath);
  storage.createMemory({
    category: 'decision',
    content: 'Use sql.js for offline storage',
    importance: 0.9,
    tags: ['storage'],
    source: 'manual',
  });
  return storage;
}

describe('generateExports non-destructive injection', () => {
  let projectPath: string;
  let storage: Storage;

  beforeEach(async () => {
    projectPath = tmpProject();
    storage = await seed(projectPath);
  });

  afterEach(() => {
    storage.close();
    fs.rmSync(projectPath, { recursive: true, force: true });
  });

  it('preserves existing file content outside the managed block', () => {
    const agentsPath = path.join(projectPath, 'AGENTS.md');
    fs.writeFileSync(agentsPath, '# My Project\n\nThis is my own content.\n');

    generateExports(storage, projectPath);
    const out = fs.readFileSync(agentsPath, 'utf-8');

    expect(out).toContain('# My Project');
    expect(out).toContain('This is my own content.');
    expect(out).toContain('<!-- COSTER:START -->');
    expect(out).toContain('<!-- COSTER:END -->');
    expect(out.indexOf('# My Project')).toBeLessThan(out.indexOf('<!-- COSTER:START -->'));
  });

  it('is idempotent: re-syncing does not duplicate the managed block', () => {
    const agentsPath = path.join(projectPath, 'AGENTS.md');
    fs.writeFileSync(agentsPath, 'USER HEADER\n');

    generateExports(storage, projectPath);
    generateExports(storage, projectPath);
    const out = fs.readFileSync(agentsPath, 'utf-8');

    expect(out.match(/<!-- COSTER:START -->/g)?.length).toBe(1);
    expect(out.match(/<!-- COSTER:END -->/g)?.length).toBe(1);
    expect(out).toContain('USER HEADER');
  });

  it('overwrites only the managed block when memories change', () => {
    const agentsPath = path.join(projectPath, 'AGENTS.md');
    fs.writeFileSync(agentsPath, 'HEADER\n');

    generateExports(storage, projectPath);
    expect(fs.readFileSync(agentsPath, 'utf-8')).toContain('Use sql.js');

    storage.createMemory({
      category: 'decision',
      content: 'Prefer tsup for builds',
      importance: 0.8,
      tags: ['build'],
      source: 'manual',
    });
    generateExports(storage, projectPath);

    const second = fs.readFileSync(agentsPath, 'utf-8');
    expect(second).toContain('Use sql.js');
    expect(second).toContain('Prefer tsup');
    expect(second.match(/<!-- COSTER:START -->/g)?.length).toBe(1);
  });
});
