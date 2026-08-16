import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

describe('CLI Commands', () => {
  const testDir = path.join(__dirname, '../fixtures/cli-test');
  const cliPath = path.join(__dirname, '../../dist/index.cjs');

  beforeEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should show help', () => {
    const output = execSync(`node ${cliPath} --help`, { encoding: 'utf-8' });
    expect(output).toContain('coster');
    expect(output).toContain('init');
    expect(output).toContain('capture');
    expect(output).toContain('search');
    expect(output).toContain('list');
  });

  it('should initialize project', () => {
    execSync(`node ${cliPath} init`, { cwd: testDir, encoding: 'utf-8' });
    expect(fs.existsSync(path.join(testDir, '.coster'))).toBe(true);
    expect(fs.existsSync(path.join(testDir, '.coster', 'config.json'))).toBe(true);
  });

  it('should capture memory', () => {
    execSync(`node ${cliPath} init`, { cwd: testDir, encoding: 'utf-8' });
    const output = execSync(
      `node ${cliPath} capture --text "Test memory" --no-quality`,
      { cwd: testDir, encoding: 'utf-8' }
    );
    expect(output).toContain('Memory captured successfully');
  });

  it('should list memories', () => {
    execSync(`node ${cliPath} init`, { cwd: testDir, encoding: 'utf-8' });
    execSync(
      `node ${cliPath} capture --text "Test memory" --no-quality`,
      { cwd: testDir, encoding: 'utf-8' }
    );
    const output = execSync(`node ${cliPath} list`, { cwd: testDir, encoding: 'utf-8' });
    expect(output).toContain('Test memory');
  });
});
