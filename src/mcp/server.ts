import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { Storage } from '../core/storage.js';
import { MemoryCategory, MemorySource } from '../types/index.js';
import { generateExports } from '../core/export.js';
import { getToolDefinition } from '../inject/registry.js';
import { loadConfig } from '../core/config.js';
import { createEmbedder, isModelPresent } from '../embed/embedder.js';
import { hybridSearch } from '../search/hybrid.js';
import { curateContext, renderRecallMarkdown } from '../inject/curate.js';

const CATEGORIES = [
  'preference',
  'convention',
  'decision',
  'investigation',
  'workaround',
  'recap',
  'mistake',
] as const;

const SOURCES = ['git-hook', 'shell-hook', 'manual', 'auto'] as const;

function textResult(text: string) {
  return { content: [{ type: 'text' as const, text }] };
}

function errorResult(text: string) {
  return { content: [{ type: 'text' as const, text }], isError: true };
}

export async function runMcpServer(projectPath?: string): Promise<void> {
  const root = projectPath || process.cwd();

  const getStorage = async () => Storage.create(root);

  const server = new McpServer({
    name: 'coster',
    version: '1.0.0',
  });

  server.registerTool(
    'capture_memory',
    {
      title: 'Capture a memory',
      description:
        'Store a new durable context memory (preference, decision, workaround, etc.) in the local Coster store.',
      inputSchema: {
        content: z.string().min(1).describe('The memory text'),
        category: z.enum(CATEGORIES).describe('Memory category'),
        source: z.enum(SOURCES).optional().describe('Where the memory came from'),
        tags: z.array(z.string()).optional().describe('Optional tags'),
        importance: z.number().min(0).max(1).optional().describe('Importance 0-1'),
      },
    },
    async (args) => {
      const storage = await getStorage();
      const now = new Date().toISOString();
      try {
        const memory = storage.createMemory({
          content: args.content,
          category: args.category as MemoryCategory,
          source: (args.source ?? 'manual') as MemorySource,
          tags: args.tags ?? [],
          importance: args.importance ?? 0.5,
          createdAt: now,
          updatedAt: now,
          accessedAt: now,
          accessCount: 0,
          metadata: {},
        });
        return textResult(JSON.stringify(memory, null, 2));
      } finally {
        storage.close();
      }
    }
  );

  server.registerTool(
    'search_memories',
    {
      title: 'Search memories',
      description: 'Search stored memories by keyword and meaning (hybrid keyword + semantic).',
      inputSchema: {
        query: z.string().min(1).describe('Search query'),
        category: z.enum(CATEGORIES).optional().describe('Filter by category'),
        limit: z.number().int().min(1).max(200).optional().describe('Max results'),
      },
    },
    async (args) => {
      const storage = await getStorage();
      try {
        const config = loadConfig(root);
        let embedder;
        if (config.embeddings.enabled && isModelPresent(config.embeddings)) {
          try {
            embedder = createEmbedder(config.embeddings);
          } catch {
            embedder = undefined;
          }
        }
        const hits = await hybridSearch(storage, args.query, {
          category: args.category as MemoryCategory | undefined,
          limit: args.limit ?? 10,
          embedder,
        });
        for (const { memory } of hits) {
          storage.recordAccess(memory.id);
        }
        return textResult(JSON.stringify(hits.map((h) => h.memory), null, 2));
      } finally {
        storage.close();
      }
    }
  );

  server.registerTool(
    'list_memories',
    {
      title: 'List memories',
      description: 'List all stored memories, optionally filtered by category.',
      inputSchema: {
        category: z.enum(CATEGORIES).optional().describe('Filter by category'),
        limit: z.number().int().min(1).max(1000).optional().describe('Max results'),
      },
    },
    async (args) => {
      const storage = await getStorage();
      try {
        let memories = storage.getAllMemories(args.category as MemoryCategory | undefined);
        if (args.limit) {
          memories = memories.slice(0, args.limit);
        }
        return textResult(JSON.stringify(memories, null, 2));
      } finally {
        storage.close();
      }
    }
  );

  server.registerTool(
    'get_context',
    {
      title: 'Get tool context',
      description:
        'Generate the tool-specific context export (e.g. CLAUDE.md, AGENTS.md) for an AI coding assistant from stored memories.',
      inputSchema: {
        tool: z
          .string()
          .optional()
          .describe('Tool id (claude-code, opencode, cursor, ...). Omit for all enabled tools.'),
        focus: z
          .string()
          .optional()
          .describe('Topic to focus the context on (decay + optional semantic ranking)'),
        dryRun: z.boolean().optional().describe('Preview without writing files'),
      },
    },
    async (args) => {
      const storage = await getStorage();
      try {
        if (args.focus) {
          const list = await curateContext(storage, root, { focus: args.focus });
          for (const p of list) storage.recordAccess(p.memory.id);
          if (list.length === 0) return textResult('# No relevant memories found.');
          return textResult(renderRecallMarkdown(list));
        }
        const results = generateExports(storage, root, {
          toolFilter: args.tool,
          dryRun: args.dryRun ?? false,
        });
        if (results.length === 0) {
          return textResult('# No enabled tools matched.');
        }
        const body = results
          .map((r) => `# ${r.tool} -> ${r.path}\n\n${r.content}`)
          .join('\n\n');
        return textResult(body);
      } finally {
        storage.close();
      }
    }
  );

  server.registerTool(
    'recall',
    {
      title: 'Recall relevant memories',
      description:
        'Recall the most relevant stored memories for a topic, file, or phrase, ranked by decayed importance and (optionally) semantic similarity.',
      inputSchema: {
        focus: z.string().min(1).describe('Topic, file path, or phrase to recall memories for'),
        limit: z.number().int().min(1).max(500).optional().describe('Max memories to return'),
        semantic: z
          .boolean()
          .optional()
          .describe('Allow semantic ranking when an embedding model is present (default true)'),
      },
    },
    async (args) => {
      const storage = await getStorage();
      try {
        const list = await curateContext(storage, root, {
          focus: args.focus,
          useSemantic: args.semantic,
          maxMemories: args.limit,
        });
        for (const p of list) storage.recordAccess(p.memory.id);
        if (list.length === 0) return textResult('# No relevant memories found.');
        return textResult(renderRecallMarkdown(list));
      } finally {
        storage.close();
      }
    }
  );

  server.registerTool(
    'update_memory',
    {
      title: 'Update a memory',
      description: 'Update an existing memory by id.',
      inputSchema: {
        id: z.string().describe('Memory id'),
        content: z.string().optional(),
        category: z.enum(CATEGORIES).optional(),
        importance: z.number().min(0).max(1).optional(),
        tags: z.array(z.string()).optional(),
      },
    },
    async (args) => {
      const storage = await getStorage();
      try {
        const updated = storage.updateMemory(args.id, {
          content: args.content,
          category: args.category as MemoryCategory | undefined,
          importance: args.importance,
          tags: args.tags,
        });
        if (!updated) {
          return errorResult(`Memory not found: ${args.id}`);
        }
        return textResult(JSON.stringify(updated, null, 2));
      } finally {
        storage.close();
      }
    }
  );

  server.registerTool(
    'delete_memory',
    {
      title: 'Delete a memory',
      description: 'Delete a memory by id.',
      inputSchema: {
        id: z.string().describe('Memory id'),
      },
    },
    async (args) => {
      const storage = await getStorage();
      try {
        const ok = storage.deleteMemory(args.id);
        if (!ok) {
          return errorResult(`Memory not found: ${args.id}`);
        }
        return textResult(`Deleted ${args.id}`);
      } finally {
        storage.close();
      }
    }
  );

  server.registerResource(
    'memory',
    new ResourceTemplate('memory://{id}', { list: undefined }),
    {
      mimeType: 'application/json',
      description: 'A single stored memory by id',
    },
    async (uri, variables) => {
      const storage = await getStorage();
      try {
        const memory = storage.getMemory(String(variables.id));
        return {
          contents: [
            {
              uri: uri.href,
              text: memory ? JSON.stringify(memory, null, 2) : '{}',
              mimeType: 'application/json',
            },
          ],
        };
      } finally {
        storage.close();
      }
    }
  );

  server.registerResource(
    'context',
    new ResourceTemplate('context://{tool}', { list: undefined }),
    {
      mimeType: 'text/markdown',
      description: 'Tool-specific generated context export',
    },
    async (uri, variables) => {
      const storage = await getStorage();
      try {
        const tool = String(variables.tool);
        const def = getToolDefinition(tool);
        if (!def) {
          return {
            contents: [
              { uri: uri.href, text: `# Unknown tool: ${tool}`, mimeType: 'text/markdown' },
            ],
          };
        }
        const results = generateExports(storage, root, { toolFilter: tool });
        const text = results[0]?.content ?? `# No memories for ${tool}`;
        return {
          contents: [{ uri: uri.href, text, mimeType: 'text/markdown' }],
        };
      } finally {
        storage.close();
      }
    }
  );

  server.registerResource(
    'recall',
    new ResourceTemplate('recall://{topic}', { list: undefined }),
    {
      mimeType: 'text/markdown',
      description: 'Curated, relevance-ranked memories for a given topic',
    },
    async (uri, variables) => {
      const storage = await getStorage();
      try {
        const topic = decodeURIComponent(String(variables.topic));
        const list = await curateContext(storage, root, { focus: topic });
        for (const p of list) storage.recordAccess(p.memory.id);
        const text = list.length ? renderRecallMarkdown(list) : '# No relevant memories found.';
        return {
          contents: [{ uri: uri.href, text, mimeType: 'text/markdown' }],
        };
      } finally {
        storage.close();
      }
    }
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
