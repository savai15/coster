import { describe, it, expect } from 'vitest';
import { ClaudeGenerator } from '../../src/inject/claude.js';
import { AgentsGenerator } from '../../src/inject/agents.js';
import { CursorGenerator } from '../../src/inject/cursor.js';
import { CopilotGenerator } from '../../src/inject/copilot.js';
import { ProjectContext } from '../../src/types/index.js';

function createContext(overrides: Partial<ProjectContext> = {}): ProjectContext {
  return {
    path: '/test/project',
    name: 'test-project',
    stack: {
      language: 'TypeScript',
      framework: 'React',
      buildSystem: 'Vite',
      packageManager: 'pnpm',
      testFramework: 'Vitest',
    },
    memories: [
      {
        id: '1',
        category: 'decision',
        content: 'Use PostgreSQL for database',
        importance: 0.9,
        accessCount: 50,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: '2',
        category: 'convention',
        content: 'Use 2-space indentation',
        importance: 0.8,
        accessCount: 30,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: '3',
        category: 'workaround',
        content: 'Memory leak workaround exists',
        importance: 0.7,
        accessCount: 20,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    sessions: [],
    lastUpdated: new Date().toISOString(),
    ...overrides,
  };
}

describe('ClaudeGenerator', () => {
  it('generates valid markdown', () => {
    const generator = new ClaudeGenerator();
    const output = generator.generate(createContext());
    expect(output).toContain('# test-project');
    expect(output).toContain('## Architecture Decisions');
    expect(output).toContain('## Coding Conventions');
    expect(output).toContain('Use PostgreSQL for database');
  });

  it('handles empty memories', () => {
    const generator = new ClaudeGenerator();
    const output = generator.generate(createContext({ memories: [] }));
    expect(output).toContain('# test-project');
    expect(output).not.toContain('## Architecture Decisions');
  });
});

describe('AgentsGenerator', () => {
  it('generates valid markdown', () => {
    const generator = new AgentsGenerator();
    const output = generator.generate(createContext());
    expect(output).toContain('# AGENTS.md');
    expect(output).toContain('## Project Overview');
    expect(output).toContain('## Setup');
    expect(output).toContain('pnpm install');
  });

  it('includes install commands', () => {
    const generator = new AgentsGenerator();
    const output = generator.generate(createContext());
    expect(output).toContain('pnpm install');
    expect(output).toContain('pnpm dev');
    expect(output).toContain('pnpm test');
  });
});

describe('CursorGenerator', () => {
  it('generates MDC format', () => {
    const generator = new CursorGenerator();
    const output = generator.generate(createContext());
    expect(output).toContain('---');
    expect(output).toContain('description:');
    expect(output).toContain('globs:');
    expect(output).toContain('alwaysApply:');
  });
});

describe('CopilotGenerator', () => {
  it('generates valid markdown', () => {
    const generator = new CopilotGenerator();
    const output = generator.generate(createContext());
    expect(output).toContain('# GitHub Copilot Instructions');
    expect(output).toContain('## Coding Guidelines');
  });
});
