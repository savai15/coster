import fs from 'fs';
import { MemoryCategory } from '../types/index.js';

export interface ShellCandidate {
  category: MemoryCategory;
  content: string;
  importance: number;
  tags: string[];
  source: 'shell';
}

const NOTABLE_CMD =
  /\b(npm|pnpm|yarn|pip|pip3|cargo|go|docker|podman|git|make|brew|apt|apt-get|kubectl|terraform|helm)\b/i;
const FAILURE_HINT = /error|exception|fail|denied|not found|no such|traceback|fatal/i;

/**
 * Parse a shell log (one entry per line: `<exitCode>\t<command>`) into candidate
 * memories. Keeps failures and notable commands (installs, git, docker, ...).
 */
export function parseShellLog(logPath: string): ShellCandidate[] {
  const raw = fs.readFileSync(logPath, 'utf-8');
  const out: ShellCandidate[] = [];
  const seen = new Set<string>();

  for (const line of raw.split('\n')) {
    const m = line.match(/^(\d+)\t(.*)$/);
    if (!m) continue;
    const code = parseInt(m[1], 10);
    const cmd = m[2].trim();
    if (!cmd) continue;

    const isFailure = code !== 0;
    const isNotable = NOTABLE_CMD.test(cmd) || FAILURE_HINT.test(cmd);
    if (!isFailure && !isNotable) continue;

    const key = cmd.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const category: MemoryCategory = isFailure ? 'mistake' : 'convention';
    const content = isFailure
      ? `Shell command failed (exit ${code}): ${cmd}`
      : `Shell command used: ${cmd}`;
    out.push({
      category,
      content,
      importance: isFailure ? 0.5 : 0.45,
      tags: ['shell'],
      source: 'shell',
    });
  }

  return out;
}
