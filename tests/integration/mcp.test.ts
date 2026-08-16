import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn, ChildProcess } from 'child_process';
import { Storage } from '../../src/core/storage.js';

const cliPath = path.resolve(__dirname, '../../dist/index.cjs');

interface McpClient {
  request: (obj: Record<string, unknown>) => Promise<any>;
  notify: (obj: Record<string, unknown>) => void;
  kill: () => void;
}

function startServer(projectPath: string): McpClient {
  const child: ChildProcess = spawn('node', [cliPath, 'mcp', '--project', projectPath], {
    stdio: ['pipe', 'pipe', 'inherit'],
  });
  let buf = '';
  const handlers = new Map<number, (msg: any) => void>();

  child.stdout!.on('data', (d) => {
    buf += d.toString();
    let idx: number;
    while ((idx = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 1);
      if (!line) continue;
      try {
        const msg = JSON.parse(line);
        if (typeof msg.id === 'number' && handlers.has(msg.id)) {
          const h = handlers.get(msg.id)!;
          handlers.delete(msg.id);
          h(msg);
        }
      } catch {
        /* ignore non-json */
      }
    }
  });

  const request = (obj: Record<string, unknown>) =>
    new Promise<any>((resolve, reject) => {
      const id = obj.id as number;
      const timer = setTimeout(() => reject(new Error(`timeout waiting for id ${id}`)), 5000);
      handlers.set(id, (msg) => {
        clearTimeout(timer);
        resolve(msg);
      });
      child.stdin!.write(JSON.stringify(obj) + '\n');
    });

  const notify = (obj: Record<string, unknown>) => {
    child.stdin!.write(JSON.stringify(obj) + '\n');
  };

  return {
    request,
    notify,
    kill: () => child.kill(),
  };
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('mcp server integration', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'coster-mcp-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('initializes, lists tools, and captures/reads memories over stdio', async () => {
    const storage = await Storage.create(tmpDir);
    storage.createMemory({
      category: 'convention',
      content: 'Use async/await',
      importance: 0.7,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      accessedAt: new Date().toISOString(),
      accessCount: 0,
      tags: [],
      source: 'manual',
    });
    storage.close();

    const client = startServer(tmpDir);
    await wait(400);

    const init = await client.request({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'test', version: '1.0' },
      },
    });
    expect(init.result.serverInfo.name).toBe('coster');

    client.notify({ jsonrpc: '2.0', method: 'notifications/initialized' });
    await wait(200);

    const list = await client.request({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
    const names = list.result.tools.map((t: any) => t.name);
    expect(names).toContain('capture_memory');
    expect(names).toContain('search_memories');
    expect(names).toContain('get_context');

    const call = await client.request({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'capture_memory',
        arguments: { content: 'Prefer composition over inheritance', category: 'convention' },
      },
    });
    expect(call.result.content[0].text).toContain('"id"');

    const search = await client.request({
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: { name: 'search_memories', arguments: { query: 'composition' } },
    });
    expect(search.result.content[0].text).toContain('composition');

    const ctx = await client.request({
      jsonrpc: '2.0',
      id: 5,
      method: 'tools/call',
      params: { name: 'get_context', arguments: { tool: 'claude-code', dryRun: true } },
    });
    expect(ctx.result.content[0].text).toContain('composition');

    client.kill();
  });
});
