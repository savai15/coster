import fs from 'fs';
import path from 'path';

const MARKERS: { tool: string; files: string[] }[] = [
  { tool: 'claude-code', files: ['.claude', 'CLAUDE.md'] },
  { tool: 'opencode', files: ['AGENTS.md'] },
  { tool: 'cursor', files: ['.cursorrules', '.cursor'] },
  { tool: 'copilot', files: ['.github/copilot-instructions.md', '.vscode'] },
  { tool: 'windsurf', files: ['.windsurf'] },
  { tool: 'codex', files: ['.codex'] },
  { tool: 'cline', files: ['.clinerules', '.cline'] },
  { tool: 'continue', files: ['.continue'] },
  { tool: 'kiro', files: ['.kiro'] },
];

/**
 * Detect which AI coding assistant is in use in the given project directory.
 * Returns the tool id (e.g. 'claude-code') or null if none is detected.
 */
export function detectActiveTool(cwd: string): string | null {
  for (const { tool, files } of MARKERS) {
    if (files.some((f) => fs.existsSync(path.join(cwd, f)))) {
      return tool;
    }
  }
  return null;
}

/**
 * Return every known AI assistant tool that has a marker file present in cwd.
 * Unlike detectActiveTool (first match only), this lists all detected tools.
 */
export function listAvailableTools(cwd: string): string[] {
  const found: string[] = [];
  for (const { tool, files } of MARKERS) {
    if (files.some((f) => fs.existsSync(path.join(cwd, f)))) {
      found.push(tool);
    }
  }
  return found;
}

/**
 * Tools that have a marker present in cwd but are not yet enabled in config.
 */
export function discoverMissingTools(cwd: string, enabledNames: string[]): string[] {
  return listAvailableTools(cwd).filter((t) => !enabledNames.includes(t));
}
