import { execSync } from 'child_process';
import { MemoryCategory } from '../types/index.js';

export interface GitCommit {
  hash: string;
  message: string;
  files: string[];
}

export interface GitCheckout {
  from: string;
  to: string;
}

const VALID_CATEGORIES: MemoryCategory[] = [
  'preference',
  'convention',
  'decision',
  'investigation',
  'workaround',
  'recap',
  'mistake',
];

function runGit(args: string, cwd: string): string | null {
  try {
    return execSync(`git ${args}`, {
      cwd,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
}

export function isGitRepo(cwd: string): boolean {
  return runGit('rev-parse --is-inside-work-tree', cwd) === 'true';
}

export function readGitCommit(cwd: string): GitCommit | null {
  const hash = runGit('rev-parse HEAD', cwd);
  if (!hash) {
    return null;
  }

  const message = runGit('log -1 --pretty=%B', cwd) ?? '';
  const filesRaw = runGit('show --name-only --format= HEAD', cwd);
  const files = filesRaw ? filesRaw.split('\n').map(f => f.trim()).filter(Boolean) : [];

  return { hash, message, files };
}

export function readGitCheckout(cwd: string): GitCheckout | null {
  const branch = runGit('rev-parse --abbrev-ref HEAD', cwd);
  if (!branch) {
    return null;
  }
  // Git passes previous and current ref on stdin for post-checkout; we approximate
  // by reporting the current branch as both (caller treats it as "now on <branch>").
  return { from: branch, to: branch };
}

export interface CostDirective {
  category: MemoryCategory;
  content: string;
}

const DIRECTIVE_RE = /^cost:([a-z]+):\s*(.+)$/im;

export function parseCostDirective(message: string): CostDirective | null {
  const match = message.match(DIRECTIVE_RE);
  if (!match) {
    return null;
  }

  const category = match[1].toLowerCase() as MemoryCategory;
  const content = match[2].trim();

  if (!VALID_CATEGORIES.includes(category) || !content) {
    return null;
  }

  return { category, content };
}
