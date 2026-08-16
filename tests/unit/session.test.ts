import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { Storage } from '../../src/core/storage.js';
import { Session } from '../../src/types/index.js';

describe('Storage session methods', () => {
  let tmpDir: string;
  let storage: Storage;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'coster-session-'));
    fs.mkdirSync(path.join(tmpDir, '.coster'), { recursive: true });
    storage = await Storage.create(tmpDir);
  });

  afterEach(() => {
    storage.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function newSession(): Session {
    return {
      id: 'session-1',
      startedAt: new Date().toISOString(),
      filesChanged: [],
      decisionsMade: [],
    };
  }

  it('creates and retrieves a session', () => {
    storage.createSession(newSession());
    const sessions = storage.getSessions();
    expect(sessions.length).toBe(1);
    expect(sessions[0].id).toBe('session-1');
  });

  it('returns active session', () => {
    storage.createSession(newSession());
    const active = storage.getActiveSession();
    expect(active).not.toBeNull();
    expect(active!.id).toBe('session-1');
  });

  it('returns null when no active session', () => {
    expect(storage.getActiveSession()).toBeNull();
  });

  it('updates a session with merged arrays', () => {
    storage.createSession(newSession());
    storage.updateSession('session-1', { filesChanged: ['a.ts', 'b.ts'] });
    storage.updateSession('session-1', { filesChanged: ['b.ts', 'c.ts'] });
    const active = storage.getActiveSession()!;
    expect(active.filesChanged.sort()).toEqual(['a.ts', 'b.ts', 'c.ts']);
  });

  it('ends a session', () => {
    storage.createSession(newSession());
    storage.updateSession('session-1', { endedAt: new Date().toISOString() });
    expect(storage.getActiveSession()).toBeNull();
    expect(storage.getSessions().length).toBe(1);
  });

  it('returns null updating unknown session', () => {
    expect(storage.updateSession('nope', { summary: 'x' })).toBeNull();
  });
});
