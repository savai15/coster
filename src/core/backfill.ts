import { execSync } from 'child_process';
import { Storage } from './storage.js';
import { parseCostDirective } from '../capture/git.js';

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

/**
 * Scan git history for `cost:<category>: <content>` directives and import them as
 * memories. Skips commits already imported (by recorded commit hash). Returns the
 * number of memories created.
 */
export function backfillMemories(storage: Storage, cwd: string, limit = 200): number {
  const hashOutput = runGit(`rev-list --max-count=${limit} --all`, cwd);
  if (!hashOutput) {
    return 0;
  }

  const hashes = hashOutput.split('\n').map((h) => h.trim()).filter(Boolean);

  const existing = new Set(
    storage
      .getAllMemories()
      .map((m) => m.metadata?.commit)
      .filter((c): c is string => typeof c === 'string')
  );

  let created = 0;
  for (const hash of hashes) {
    if (existing.has(hash)) {
      continue;
    }

    const message = runGit(`log -1 --pretty=%B ${hash}`, cwd) ?? '';
    const directive = parseCostDirective(message);
    if (!directive) {
      continue;
    }

    const filesRaw = runGit(`show --name-only --format= ${hash}`, cwd);
    const files = filesRaw ? filesRaw.split('\n').map((f) => f.trim()).filter(Boolean) : [];

    const now = new Date().toISOString();
    storage.createMemory({
      category: directive.category,
      content: directive.content,
      importance: 0.8,
      createdAt: now,
      updatedAt: now,
      accessedAt: now,
      accessCount: 0,
      tags: ['git-backfill'],
      source: 'auto',
      metadata: { commit: hash, files },
    });
    created++;
  }

  return created;
}
