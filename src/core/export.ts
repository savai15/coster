import fs from 'fs';
import path from 'path';
import { Storage } from './storage.js';
import { detectStack } from '../capture/detect.js';
import { getConfig } from './config.js';
import { TOOL_REGISTRY, generateForTool } from '../inject/registry.js';
import { ProjectContext } from '../types/index.js';

export interface ExportResult {
  tool: string;
  path: string;
  content: string;
  written: boolean;
}

export interface GenerateExportsOptions {
  toolFilter?: string;
  dryRun?: boolean;
}

// Coster-managed region markers. Everything between them is owned by Coster and is
// regenerated on each `sync`; user content outside the markers is preserved.
const MARKER_START = '<!-- COSTER:START -->';
const MARKER_END = '<!-- COSTER:END -->';

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const BLOCK_RE = new RegExp(`${escapeRegex(MARKER_START)}[\\s\\S]*?${escapeRegex(MARKER_END)}`);

function stripManagedBlock(existing: string): string {
  return existing.replace(BLOCK_RE, '').replace(/\n{3,}/g, '\n\n').trimEnd();
}

function withManagedBlock(existing: string, content: string): string {
  const base = stripManagedBlock(existing);
  const block = `${MARKER_START}\n${content}\n${MARKER_END}`;
  return base ? `${base}\n\n${block}\n` : `${block}\n`;
}

function buildContext(storage: Storage, projectPath: string): ProjectContext {
  const memories = storage.getAllMemories();
  const stack = detectStack(projectPath);
  return {
    path: projectPath,
    name: path.basename(projectPath),
    stack,
    memories,
    sessions: [],
    lastUpdated: new Date().toISOString(),
  };
}

export function generateExports(
  storage: Storage,
  projectPath: string,
  options: GenerateExportsOptions = {}
): ExportResult[] {
  const config = getConfig(projectPath);
  const context = buildContext(storage, projectPath);
  const results: ExportResult[] = [];

  const tools = config.tools.filter((t) => t.enabled);

  for (const tool of tools) {
    if (options.toolFilter && tool.name !== options.toolFilter) {
      continue;
    }

    const def = TOOL_REGISTRY[tool.name] ?? null;
    if (!def) {
      continue;
    }

    let content: string;
    try {
      content = generateForTool(tool.name, context, tool.tokenBudget, {
        decayHalfLifeDays: config.lifecycle.decayHalfLifeDays,
        decayMinImportance: config.lifecycle.decayMinImportance,
        mode: config.injection.mode,
      });
    } catch {
      continue;
    }

    const outputPath = tool.exportPath || def.defaultPath;
    const fullPath = path.join(projectPath, outputPath);

    if (options.dryRun) {
      results.push({ tool: tool.name, path: outputPath, content, written: false });
      continue;
    }

    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const existing = fs.existsSync(fullPath) ? fs.readFileSync(fullPath, 'utf-8') : '';
    const finalContent = withManagedBlock(existing, content);
    fs.writeFileSync(fullPath, finalContent);
    results.push({ tool: tool.name, path: outputPath, content: finalContent, written: true });
  }

  return results;
}
