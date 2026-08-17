import fs from 'fs';
import path from 'path';
import { Storage } from '../../core/storage.js';
import { generateExports, ExportResult } from '../../core/export.js';
import { loadConfig, saveConfig } from '../../core/config.js';
import { discoverMissingTools } from '../../inject/detect.js';
import { getToolDefinition } from '../../inject/registry.js';
import { printInfo } from './output.js';
import { buildEmbeddings } from '../../embed/build.js';

const SILENT = process.env.COSTER_SILENT === '1';

/**
 * Shared project-sync routine used by both the `sync` command and the daemon.
 * Optionally auto-discovers newly added assistant tools, regenerates the
 * enabled tool memory files, and (if configured) refreshes the semantic index.
 */
export function syncProject(
  projectPath: string,
  storage: Storage,
  opts: { tool?: string; discover?: boolean; dryRun?: boolean; silent?: boolean } = {}
): ExportResult[] {
  const silent = opts.silent ?? SILENT;
  const discover = opts.discover !== false;

  if (discover) {
    const config = loadConfig(projectPath);
    const enabledNames = config.tools.filter((t) => t.enabled).map((t) => t.name);
    const missing = discoverMissingTools(projectPath, enabledNames);
    for (const tool of missing) {
      const existing = config.tools.find((t) => t.name === tool);
      if (existing) {
        existing.enabled = true;
      } else {
        const def = getToolDefinition(tool);
        config.tools.push({
          name: tool,
          enabled: true,
          exportPath: def ? def.defaultPath : `${tool}.md`,
          tokenBudget: 10000,
        });
      }
      if (!silent) printInfo(`Auto-enabled ${tool} (detected marker file).`);
    }
    if (missing.length) saveConfig(projectPath, config);
  }

  const results = generateExports(storage, projectPath, {
    toolFilter: opts.tool,
    dryRun: opts.dryRun,
  });

  // Best-effort semantic index refresh (no-op if disabled or model missing).
  if (!opts.dryRun) {
    const config = loadConfig(projectPath);
    if (config.embeddings.enabled && config.embeddings.autoBuild) {
      buildEmbeddings(projectPath).catch(() => {
        /* keep sync resilient: indexing failures must not break exports */
      });
    }
  }

  return results;
}
