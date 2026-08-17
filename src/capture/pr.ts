import { execSync } from 'child_process';
import { MemoryCategory } from '../types/index.js';

export interface PrCandidate {
  category: MemoryCategory;
  content: string;
  importance: number;
  tags: string[];
  source: 'pr';
  metadata: { pr: string };
}

interface GhPr {
  number: number;
  url: string;
  title: string;
}

/**
 * Summarize recently merged PRs into memory candidates using the user's own
 * `gh` CLI (no Coster API key). Throws if `gh` is missing or unauthenticated.
 */
export function summarizeMergedPrs(cwd: string, limit: number): PrCandidate[] {
  const gh = (args: string): string => {
    try {
      return execSync(`gh ${args}`, {
        cwd,
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();
    } catch (e: any) {
      throw new Error(`\`gh\` CLI unavailable or not authenticated: ${e?.message ?? e}`);
    }
  };

  const listRaw = gh(`pr list --state merged --limit ${limit} --json number,url,title`);
  let list: GhPr[] = [];
  try {
    list = JSON.parse(listRaw);
  } catch {
    return [];
  }

  const out: PrCandidate[] = [];
  for (const pr of list) {
    let files: string[] = [];
    try {
      const view = JSON.parse(gh(`pr view ${pr.number} --json title,body,files,mergedAt`));
      files = (view.files ?? []).map((f: any) => f.path);
    } catch {
      /* skip view on failure */
    }
    const fileList = files.slice(0, 8).join(', ') + (files.length > 8 ? '…' : '');
    out.push({
      category: 'recap',
      content: `Merged PR #${pr.number}: ${pr.title}. Files: ${fileList || 'none'}`,
      importance: 0.5,
      tags: ['pr', `#${pr.number}`],
      source: 'pr',
      metadata: { pr: pr.url },
    });
  }
  return out;
}
