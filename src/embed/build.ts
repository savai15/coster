import { Storage } from '../core/storage.js';
import { loadConfig } from '../core/config.js';
import { createEmbedder, fetchModel, isModelPresent } from './embedder.js';

export interface BuildResult {
  status: 'ok' | 'disabled' | 'model-missing' | 'empty';
  embedded: number;
}

/**
 * (Re)compute embeddings for every memory and store them. No-op (with a clear
 * status) when embeddings are disabled or the model is not downloaded yet.
 * Does NOT download the model — use `ensureModelAndBuild` for that.
 */
export async function buildEmbeddings(projectPath: string): Promise<BuildResult> {
  const config = loadConfig(projectPath);
  if (!config.embeddings.enabled) {
    return { status: 'disabled', embedded: 0 };
  }
  if (!isModelPresent(config.embeddings)) {
    return { status: 'model-missing', embedded: 0 };
  }

  const storage = await Storage.create(projectPath);
  try {
    const memories = storage.getAllMemories();
    if (memories.length === 0) {
      return { status: 'empty', embedded: 0 };
    }
    const embedder = createEmbedder(config.embeddings);
    const vectors = await embedder.embed(memories.map((m) => m.content));
    for (let i = 0; i < memories.length; i++) {
      storage.upsertVector(memories[i].id, vectors[i]);
    }
    storage.save();
    return { status: 'ok', embedded: memories.length };
  } finally {
    storage.close();
  }
}

/**
 * One-shot "make it work" path used by the CLI: download the model if missing
 * (requires network, once), then build. Throws on download/embed failure.
 */
export async function ensureModelAndBuild(
  projectPath: string,
  onProgress?: (p: { status: string; loaded?: number; total?: number; file?: string }) => void
): Promise<BuildResult> {
  const config = loadConfig(projectPath);
  if (!config.embeddings.enabled) return { status: 'disabled', embedded: 0 };

  if (!isModelPresent(config.embeddings)) {
    onProgress?.({ status: 'fetching' });
    await fetchModel(config.embeddings, onProgress);
  }
  return buildEmbeddings(projectPath);
}
