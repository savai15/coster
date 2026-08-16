import { describe, it, expect } from 'vitest';
import { TOOL_REGISTRY, getToolDefinition, generateForTool } from '../../src/inject/registry.js';
import { ProjectContext, Memory } from '../../src/types/index.js';

function ctx(): ProjectContext {
  const now = new Date().toISOString();
  const memory: Memory = {
    id: 'm1',
    category: 'convention',
    content: 'Use 2-space indentation',
    importance: 0.8,
    createdAt: now,
    updatedAt: now,
    accessedAt: now,
    accessCount: 0,
    tags: ['style'],
    source: 'manual',
  };
  return {
    path: '/tmp',
    name: 'test',
    stack: {
      language: 'TypeScript',
      framework: 'React',
      buildSystem: 'Vite',
      packageManager: 'npm',
      testFramework: 'Vitest',
    },
    memories: [memory],
    sessions: [],
    lastUpdated: now,
  };
}

describe('Tool registry', () => {
  it('registers all 10 tools', () => {
    expect(Object.keys(TOOL_REGISTRY).length).toBe(10);
  });

  it('returns definition by name', () => {
    expect(getToolDefinition('claude-code')?.defaultPath).toBe('CLAUDE.md');
    expect(getToolDefinition('opencode')?.defaultPath).toBe('AGENTS.md');
    expect(getToolDefinition('windsurf')?.defaultPath).toBe('.windsurf/rules/coster.md');
    expect(getToolDefinition('kiro')?.defaultPath).toBe('.kiro/steering/coster.md');
  });

  it('returns null for unknown', () => {
    expect(getToolDefinition('nope')).toBeNull();
  });

  it('generates content for each tool', () => {
    for (const name of Object.keys(TOOL_REGISTRY)) {
      const out = generateForTool(name, ctx(), 10000);
      expect(typeof out).toBe('string');
      expect(out.length).toBeGreaterThan(0);
    }
  });

  it('throws on unknown tool generation', () => {
    expect(() => generateForTool('nope', ctx(), 1000)).toThrow();
  });
});
