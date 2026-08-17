import { ProjectContext } from '../types/index.js';
import { ClaudeGenerator } from './claude.js';
import { AgentsGenerator } from './agents.js';
import { CursorGenerator } from './cursor.js';
import { CopilotGenerator } from './copilot.js';
import { WindsurfGenerator } from './windsurf.js';
import { CodexGenerator } from './codex.js';
import { ClineGenerator } from './cline.js';
import { ContinueGenerator } from './continue.js';
import { KiroGenerator } from './kiro.js';
import { CosterGenerator } from './coster.js';
import { BaseGenerator } from './base.js';
import { PriorityOptions } from './priority.js';

export interface ToolDefinition {
  name: string;
  generator: new (tokenBudget: number, toolName: string, opts?: PriorityOptions) => BaseGenerator;
  defaultPath: string;
}

export const TOOL_REGISTRY: Record<string, ToolDefinition> = {
  'claude-code': { name: 'claude-code', generator: ClaudeGenerator, defaultPath: 'CLAUDE.md' },
  opencode: { name: 'opencode', generator: AgentsGenerator, defaultPath: 'AGENTS.md' },
  cursor: { name: 'cursor', generator: CursorGenerator, defaultPath: '.cursorrules' },
  copilot: { name: 'copilot', generator: CopilotGenerator, defaultPath: '.github/copilot-instructions.md' },
  windsurf: { name: 'windsurf', generator: WindsurfGenerator, defaultPath: '.windsurf/rules/coster.md' },
  codex: { name: 'codex', generator: CodexGenerator, defaultPath: '.codex/memory.md' },
  cline: { name: 'cline', generator: ClineGenerator, defaultPath: '.clinerules' },
  continue: { name: 'continue', generator: ContinueGenerator, defaultPath: '.continue/rules/coster.md' },
  kiro: { name: 'kiro', generator: KiroGenerator, defaultPath: '.kiro/steering/coster.md' },
  coster: { name: 'coster', generator: CosterGenerator, defaultPath: 'COSTER.md' },
};

export function getToolDefinition(name: string): ToolDefinition | null {
  return TOOL_REGISTRY[name] ?? null;
}

export function generateForTool(
  name: string,
  context: ProjectContext,
  tokenBudget: number,
  opts: PriorityOptions = {}
): string {
  const def = getToolDefinition(name);
  if (!def) {
    throw new Error(`Unknown tool: ${name}`);
  }
  const generator = new def.generator(tokenBudget, name, opts);
  return generator.generate(context);
}
