import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import { Storage } from '../../core/storage.js';
import { loadConfig } from '../../core/config.js';
import { isModelPresent } from '../../embed/embedder.js';
import { ensureModelAndBuild, buildEmbeddings } from '../../embed/build.js';
import { printInfo, printError, printSuccess } from '../utils/output.js';

function progress(p: { status: string; loaded?: number; total?: number; file?: string }): void {
  if (p.file && p.total) {
    const pct = Math.min(100, Math.round(((p.loaded ?? 0) / p.total) * 100));
    printInfo(`  ${p.file}: ${pct}%`);
  } else if (p.status === 'downloaded') {
    printSuccess('Model downloaded.');
  }
}

export function embeddingsCommand(program: Command): void {
  const cmd = program
    .command('embeddings')
    .description('Manage local semantic-search embeddings (offline; model fetched once)');

  cmd
    .command('fetch')
    .description('Download the embedding model once (requires network). Runtime search stays offline.')
    .action(async () => {
      try {
        const config = loadConfig(process.cwd());
        if (!config.embeddings.enabled) {
          printError('Embeddings are disabled in config (set embeddings.enabled true).');
          process.exitCode = 1;
          return;
        }
        if (isModelPresent(config.embeddings)) {
          printInfo(`Model already present at ${path.join(config.embeddings.modelDir, config.embeddings.model)}`);
          return;
        }
        printInfo(`Downloading ${config.embeddings.model} …`);
        await ensureModelAndBuild(process.cwd(), progress);
        printSuccess('Done. Semantic search is ready.');
      } catch (err) {
        printError(`Model fetch failed: ${err instanceof Error ? err.message : String(err)}`);
        process.exitCode = 1;
      }
    });

  cmd
    .command('build')
    .description('Build/update the vector index for all memories. Auto-fetches the model if missing.')
    .action(async () => {
      try {
        printInfo('Building semantic index …');
        const result = await ensureModelAndBuild(process.cwd(), progress);
        if (result.status === 'disabled') {
          printInfo('Embeddings disabled — nothing to do.');
        } else if (result.status === 'empty') {
          printInfo('No memories to embed yet.');
        } else {
          printSuccess(`Embedded ${result.embedded} memories.`);
        }
      } catch (err) {
        printError(`Build failed: ${err instanceof Error ? err.message : String(err)}`);
        process.exitCode = 1;
      }
    });

  cmd
    .command('status')
    .description('Show embedding/model/index state')
    .action(async () => {
      try {
        const config = loadConfig(process.cwd());
        const storage = await Storage.create(process.cwd());
        const total = storage.getAllMemories().length;
        const indexed = storage.vectorCount();
        storage.close();

        const modelPath = path.join(config.embeddings.modelDir, config.embeddings.model);
        printInfo(`Embeddings enabled : ${config.embeddings.enabled}`);
        printInfo(`Model             : ${config.embeddings.model} (${config.embeddings.dim}d)`);
        printInfo(`Model present     : ${isModelPresent(config.embeddings)} (${modelPath})`);
        printInfo(`Auto-build (daemon): ${config.embeddings.autoBuild}`);
        printInfo(`Indexed memories   : ${indexed} / ${total}`);
        if (config.embeddings.enabled && indexed < total) {
          printInfo('Run `coster embeddings build` to index the rest.');
        }
      } catch (err) {
        printError(`Status failed: ${err instanceof Error ? err.message : String(err)}`);
        process.exitCode = 1;
      }
    });

  cmd
    .command('clear')
    .description('Delete all stored vectors (revert to keyword-only search)')
    .action(async () => {
      try {
        const storage = await Storage.create(process.cwd());
        storage.clearVectors();
        storage.close();
        printSuccess('Cleared vector index. Search is now keyword-only.');
      } catch (err) {
        printError(`Clear failed: ${err instanceof Error ? err.message : String(err)}`);
        process.exitCode = 1;
      }
    });
}
