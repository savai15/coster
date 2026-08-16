import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { detectStack } from '../../src/capture/detect.js';

describe('detectStack', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'coster-detect-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('detects TypeScript/JavaScript from package.json', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), '{}');
    const stack = detectStack(tmpDir);
    expect(stack.language).toBe('TypeScript/JavaScript');
  });

  it('detects Rust from Cargo.toml', () => {
    fs.writeFileSync(path.join(tmpDir, 'Cargo.toml'), '');
    const stack = detectStack(tmpDir);
    expect(stack.language).toBe('Rust');
  });

  it('detects Go from go.mod', () => {
    fs.writeFileSync(path.join(tmpDir, 'go.mod'), '');
    const stack = detectStack(tmpDir);
    expect(stack.language).toBe('Go');
  });

  it('detects Python from requirements.txt', () => {
    fs.writeFileSync(path.join(tmpDir, 'requirements.txt'), '');
    const stack = detectStack(tmpDir);
    expect(stack.language).toBe('Python');
  });

  it('detects React framework', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
      dependencies: { react: '^18.0.0' },
    }));
    const stack = detectStack(tmpDir);
    expect(stack.framework).toBe('React');
  });

  it('detects Next.js framework', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
      dependencies: { next: '^14.0.0' },
    }));
    const stack = detectStack(tmpDir);
    expect(stack.framework).toBe('Next.js');
  });

  it('detects Vite build system', () => {
    fs.writeFileSync(path.join(tmpDir, 'vite.config.ts'), '');
    const stack = detectStack(tmpDir);
    expect(stack.buildSystem).toBe('Vite');
  });

  it('detects pnpm package manager', () => {
    fs.writeFileSync(path.join(tmpDir, 'pnpm-lock.yaml'), '');
    const stack = detectStack(tmpDir);
    expect(stack.packageManager).toBe('pnpm');
  });

  it('detects npm package manager', () => {
    fs.writeFileSync(path.join(tmpDir, 'package-lock.json'), '');
    const stack = detectStack(tmpDir);
    expect(stack.packageManager).toBe('npm');
  });

  it('detects Vitest test framework', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
      devDependencies: { vitest: '^1.0.0' },
    }));
    const stack = detectStack(tmpDir);
    expect(stack.testFramework).toBe('Vitest');
  });

  it('returns Unknown for empty directory', () => {
    const stack = detectStack(tmpDir);
    expect(stack.language).toBe('Unknown');
    expect(stack.framework).toBe('Unknown');
    expect(stack.buildSystem).toBe('Unknown');
    expect(stack.packageManager).toBe('Unknown');
    expect(stack.testFramework).toBe('Unknown');
  });

  it('handles non-existent directory', () => {
    const stack = detectStack('/nonexistent/path');
    expect(stack.language).toBe('Unknown');
  });
});
