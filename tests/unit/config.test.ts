import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { loadConfig, saveConfig, configPath } from '../../src/core/config.js';
import { defaultConfig } from '../../src/types/index.js';

describe('Config', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'coster-config-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns default config when no file exists', () => {
    const config = loadConfig(tmpDir);
    expect(config.tools.length).toBe(9);
    expect(config.hooks.git).toBe(false);
    expect(config.autoInject).toBe(true);
  });

  it('saves and loads config round-trip', () => {
    const config = { ...defaultConfig, autoInject: false };
    saveConfig(tmpDir, config);
    expect(fs.existsSync(configPath(tmpDir))).toBe(true);
    const loaded = loadConfig(tmpDir);
    expect(loaded.autoInject).toBe(false);
    expect(loaded.tools.length).toBe(9);
  });

  it('merges partial file over defaults', () => {
    fs.mkdirSync(path.join(tmpDir, '.coster'), { recursive: true });
    fs.writeFileSync(configPath(tmpDir), JSON.stringify({ autoInject: false }));
    const loaded = loadConfig(tmpDir);
    expect(loaded.autoInject).toBe(false);
    expect(loaded.tools.length).toBe(9);
  });

  it('falls back to defaults on invalid JSON', () => {
    fs.mkdirSync(path.join(tmpDir, '.coster'), { recursive: true });
    fs.writeFileSync(configPath(tmpDir), '{ not valid json');
    const loaded = loadConfig(tmpDir);
    expect(loaded.tools.length).toBe(9);
  });
});
