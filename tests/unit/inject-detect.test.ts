import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { detectActiveTool } from '../../src/inject/detect.js';

function mkTmp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'coster-detect-'));
}

describe('detectActiveTool', () => {
  it('returns null when no markers are present', () => {
    const dir = mkTmp();
    try {
      expect(detectActiveTool(dir)).toBeNull();
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('detects claude-code via CLAUDE.md', () => {
    const dir = mkTmp();
    try {
      fs.writeFileSync(path.join(dir, 'CLAUDE.md'), 'x');
      expect(detectActiveTool(dir)).toBe('claude-code');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('detects opencode via AGENTS.md', () => {
    const dir = mkTmp();
    try {
      fs.writeFileSync(path.join(dir, 'AGENTS.md'), 'x');
      expect(detectActiveTool(dir)).toBe('opencode');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('detects cursor via .cursorrules', () => {
    const dir = mkTmp();
    try {
      fs.writeFileSync(path.join(dir, '.cursorrules'), 'x');
      expect(detectActiveTool(dir)).toBe('cursor');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('detects copilot via instructions file', () => {
    const dir = mkTmp();
    try {
      fs.mkdirSync(path.join(dir, '.github'), { recursive: true });
      fs.writeFileSync(path.join(dir, '.github', 'copilot-instructions.md'), 'x');
      expect(detectActiveTool(dir)).toBe('copilot');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
