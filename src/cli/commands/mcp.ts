import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import { runMcpServer } from '../../mcp/server.js';
import { printInfo, printError, printSuccess } from '../utils/output.js';

const SILENT = process.env.COSTER_SILENT === '1';

function serverDef(): Record<string, unknown> {
  return { command: 'npx', args: ['-y', 'coster', 'mcp'] };
}

/**
 * Parse JSON, tolerating the `//` line and `/* *\/` block comments used by
 * opencode.jsonc. Falls through to throwing on genuinely invalid input so the
 * caller can skip that file rather than corrupting it.
 */
function parseTolerant(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    const stripped = text
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:"])\/\/.*$/gm, '$1');
    return JSON.parse(stripped);
  }
}

type UpsertResult = 'added' | 'exists' | 'skipped';

function upsertMcpFile(filePath: string, def: Record<string, unknown>): UpsertResult {
  let obj: any = {};
  if (fs.existsSync(filePath)) {
    try {
      obj = parseTolerant(fs.readFileSync(filePath, 'utf-8'));
    } catch {
      if (!SILENT) printError(`Could not parse ${filePath}; skipping MCP registration there.`);
      return 'skipped';
    }
  }
  obj.mcpServers = obj.mcpServers || {};
  if (obj.mcpServers.coster && JSON.stringify(obj.mcpServers.coster) === JSON.stringify(def)) {
    return 'exists';
  }
  obj.mcpServers.coster = def;
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2));
  return 'added';
}

/**
 * Register Coster as an MCP server for detected assistants. Writes the standard
 * `.mcp.json` (Claude Code, Cursor, VS Code, Cline, Windsurf) and, if present,
 * merges into `opencode.jsonc`. Idempotent: never duplicates the entry.
 */
export function registerMcp(projectPath: string): void {
  try {
    const def = serverDef();
    const targets: string[] = ['.mcp.json'];
    const opencodePath = path.join(projectPath, 'opencode.jsonc');
    if (fs.existsSync(opencodePath)) targets.push('opencode.jsonc');

    let added = 0;
    let exists = 0;
    for (const t of targets) {
      const r = upsertMcpFile(path.join(projectPath, t), def);
      if (r === 'added') added++;
      else if (r === 'exists') exists++;
    }
    if (added && !SILENT) printSuccess(`Registered Coster MCP server in ${added} file(s).`);
    else if (exists && !SILENT) printInfo('Coster MCP server already registered.');
  } catch (err) {
    if (!SILENT) printError(`MCP registration skipped: ${err instanceof Error ? err.message : String(err)}`);
  }
}

function removeMcpFromFile(filePath: string): boolean {
  if (!fs.existsSync(filePath)) return false;
  try {
    const obj = parseTolerant(fs.readFileSync(filePath, 'utf-8'));
    if (obj.mcpServers && obj.mcpServers.coster) {
      delete obj.mcpServers.coster;
      if (Object.keys(obj.mcpServers).length === 0) delete obj.mcpServers;
      fs.writeFileSync(filePath, JSON.stringify(obj, null, 2));
      return true;
    }
  } catch {
    if (!SILENT) printError(`Could not parse ${filePath}; skipping.`);
  }
  return false;
}

export function unregisterMcp(projectPath: string): number {
  let removed = 0;
  for (const f of ['.mcp.json', 'opencode.jsonc']) {
    if (removeMcpFromFile(path.join(projectPath, f))) removed++;
  }
  return removed;
}

export function mcpCommand(program: Command): void {
  program
    .command('mcp')
    .description('Start the Coster MCP server (stdio transport) for AI coding assistants')
    .option('-p, --project <path>', 'Project path to serve (defaults to current directory)')
    .action(async (options) => {
      try {
        await runMcpServer(options.project || process.cwd());
      } catch (error) {
        console.error('Failed to start MCP server:', error);
        process.exitCode = 1;
      }
    });

  program
    .command('mcp-install')
    .description('Register Coster as an MCP server for detected AI assistants (idempotent, cross-tool)')
    .action(() => {
      registerMcp(process.cwd());
    });

  program
    .command('mcp-remove')
    .description('Remove Coster MCP server registration')
    .action(() => {
      const removed = unregisterMcp(process.cwd());
      if (removed && !SILENT) printSuccess(`Removed Coster MCP from ${removed} file(s).`);
      else if (!SILENT) printInfo('No Coster MCP registration found.');
    });
}
