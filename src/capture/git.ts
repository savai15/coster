import { execSync } from 'child_process';
import { MemoryCategory, CommitPolicy } from '../types/index.js';

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

export interface GitDiffFile {
  path: string;
  status: string;
  insertions: number;
  deletions: number;
}

export interface GitDiffStats {
  files: GitDiffFile[];
  totalLines: number;
}

/** Read line-count stats for the committed HEAD (staged=false) or staged changes (staged=true). */
export function readDiffStats(cwd: string, staged = false): GitDiffStats {
  const range = staged ? '--staged' : 'HEAD';
  const raw = runGit(`diff --numstat ${range}`, cwd);
  const files: GitDiffFile[] = [];
  let totalLines = 0;
  if (raw) {
    for (const line of raw.split('\n')) {
      const m = line.match(/^(\d+|-)\t(\d+|-)\t(.+)$/);
      if (!m) continue;
      const insertions = m[1] === '-' ? 0 : parseInt(m[1], 10);
      const deletions = m[2] === '-' ? 0 : parseInt(m[2], 10);
      files.push({ path: m[3].trim(), status: '', insertions, deletions });
      totalLines += insertions + deletions;
    }
  }
  return { files, totalLines };
}

function globMatch(pattern: string, file: string): boolean {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*\//g, '(?:.+\\/)?')
    .replace(/\*\*/g, '.*')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '.');
  return new RegExp(`^${escaped}$`).test(file);
}

/**
 * Decide whether a commit is worth auto-capturing as a memory without an
 * explicit `cost:` directive. Signal-rich = touches rule/config files, is a
 * large diff, or its message mentions fix/bug keywords.
 */
export function signalRichPolicy(commit: GitCommit, stats: GitDiffStats, policy: CommitPolicy): boolean {
  if (!policy.enabled) return false;
  const msg = commit.message.toLowerCase();
  if (policy.fixKeywords.some((k) => msg.includes(k))) return true;
  if (stats.totalLines >= policy.minDiffLines) return true;
  if (stats.files.some((f) => policy.signalGlobs.some((g) => globMatch(g, f.path)))) return true;
  return false;
}

/**
 * Derive a memory category, human-readable content, and importance from a
 * commit. Used for signal-rich auto-capture (no `cost:` directive present).
 */
export function classifyCommit(commit: GitCommit, stats: GitDiffStats): {
  category: MemoryCategory;
  content: string;
  importance: number;
} {
  const msg = commit.message.toLowerCase();
  const subject = commit.message.split('\n')[0].trim() || '(no subject)';
  const files = stats.files.map((f) => f.path);

  const ruleFile = files.some((f) =>
    /(CLAUDE\.md|AGENTS\.md|\.rules?$|config\.|tsconfig|package\.json|migrations|Dockerfile|Makefile|\.env)/i.test(f)
  );
  const fixish = /\b(fix|bug|hotfix|revert|patch|workaround)\b/.test(msg);

  let category: MemoryCategory = 'recap';
  if (ruleFile) category = 'decision';
  else if (fixish) category = 'workaround';

  const fileList = files.slice(0, 8).join(', ') + (files.length > 8 ? '…' : '');
  const content = `Commit ${commit.hash.substring(0, 8)}: ${subject}. Files: ${fileList || 'none'}`;

  let importance = 0.45;
  if (stats.totalLines >= 200) importance = 0.7;
  else if (stats.totalLines >= 120) importance = 0.6;

  return { category, content, importance };
}
