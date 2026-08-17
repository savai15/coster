import { EmbeddingsConfig } from '../types/index.js';

const BGE_QUERY_PREFIX = 'Represent this sentence for searching relevant passages: ';

export interface Embedder {
  /** Embed a batch of texts into L2-normalized vectors (one per input). */
  embed(texts: string[], opts?: { isQuery?: boolean }): Promise<number[][]>;
  readonly dim: number;
}

/**
 * Deterministic, dependency-free embedder used for tests and offline fallbacks.
 * Produces a stable `dim`-length vector from a hash of the text — NOT semantic,
 * but good enough to exercise the hybrid-search plumbing without a model.
 */
export class FakeEmbedder implements Embedder {
  readonly dim: number;
  constructor(dim = 384) {
    this.dim = dim;
  }
  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((t) => fakeVector(t, this.dim));
  }
}

function fakeVector(text: string, dim: number): number[] {
  const vec = new Array(dim).fill(0);
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  for (let i = 0; i < dim; i++) {
    h ^= (h << 13) | (h >>> 19);
    vec[i] = (h % 1000) / 1000 - 0.5;
  }
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}

interface ProgressCb {
  (progress: { status: string; loaded?: number; total?: number; file?: string }): void;
}

const fs = require('fs') as typeof import('fs');
const path = require('path') as typeof import('path');

/** Local read path transformers.js uses when allowRemoteModels=false: <modelDir>/<Org>/<Name>. */
function localModelDir(modelDir: string, model: string): string {
  return path.join(modelDir, ...model.split('/'));
}

/** Where transformers.js caches a download: <modelDir>/models--Org--Name/snapshots/<hash>/. */
function hubSnapshotDir(modelDir: string, model: string): string | null {
  const [org, name] = model.split('/');
  const base = path.join(modelDir, `models--${org}--${name}`, 'snapshots');
  if (!fs.existsSync(base)) return null;
  const subs = fs
    .readdirSync(base)
    .filter((f: string) => fs.statSync(path.join(base, f)).isDirectory());
  return subs.length ? path.join(base, subs[0]) : null;
}

function copyRecursive(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyRecursive(s, d);
    else fs.copyFileSync(s, d);
  }
}

/**
 * Local transformer embedder backed by @xenova/transformers (ONNX, WASM runtime).
 * Runs fully offline once the model is present in `config.modelDir`. When the
 * model is missing it throws a clear, actionable error.
 */
export class TransformersEmbedder implements Embedder {
  readonly dim: number;
  private cfg: EmbeddingsConfig;
  private extractorPromise: Promise<any> | null = null;
  private onProgress: ProgressCb | null;

  constructor(cfg: EmbeddingsConfig, onProgress?: ProgressCb) {
    this.cfg = cfg;
    this.dim = cfg.dim;
    this.onProgress = onProgress ?? null;
  }

  private async getExtractor(): Promise<any> {
    if (!this.extractorPromise) {
      this.extractorPromise = (async () => {
        const mod = await import('@xenova/transformers');
        const env = (mod as any).env;
        // Never reach out to the network; only use the local model dir.
        env.allowRemoteModels = false;
        env.localModelPath = this.cfg.modelDir;
        const pipeline = mod.pipeline;
        this.onProgress?.({ status: 'loading' });
        const extractor = await pipeline('feature-extraction', this.cfg.model);
        this.onProgress?.({ status: 'ready' });
        return extractor;
      })();
    }
    return this.extractorPromise;
  }

  async embed(texts: string[], opts?: { isQuery?: boolean }): Promise<number[][]> {
    if (texts.length === 0) return [];
    const prepared = texts.map((t) =>
      opts?.isQuery ? `${BGE_QUERY_PREFIX}${t}` : t
    );
    const extractor = await this.getExtractor();
    const output = await extractor(prepared, {
      pooling: 'mean',
      normalize: true,
    });
    return output.tolist() as number[][];
  }
}

export function createEmbedder(cfg: EmbeddingsConfig, onProgress?: ProgressCb): Embedder {
  return new TransformersEmbedder(cfg, onProgress);
}

/**
 * Download the configured model into `cfg.modelDir` (one-time network step) and
 * relocate it into the `localModelPath` layout the offline loader expects.
 * Throws if offline or the model id is invalid.
 */
export async function fetchModel(
  cfg: EmbeddingsConfig,
  onProgress?: ProgressCb
): Promise<void> {
  const mod = await import('@xenova/transformers');
  const env = (mod as any).env;
  env.allowRemoteModels = true;
  env.cacheDir = cfg.modelDir;
  env.localModelPath = cfg.modelDir;
  const pipeline = mod.pipeline;
  onProgress?.({ status: 'downloading' });
  await pipeline('feature-extraction', cfg.model, {
    progress_callback: (p: any) => {
      onProgress?.({
        status: 'downloading',
        loaded: p.loaded,
        total: p.total,
        file: p.file,
      });
    },
  });
  // transformers.js caches in a hub-layout dir; copy it into the local read path.
  const snapshot = hubSnapshotDir(cfg.modelDir, cfg.model);
  if (snapshot) {
    copyRecursive(snapshot, localModelDir(cfg.modelDir, cfg.model));
  }
  onProgress?.({ status: 'downloaded' });
}

/** True when the model is present in the offline read path. */
export function isModelPresent(cfg: EmbeddingsConfig): boolean {
  const dir = localModelDir(cfg.modelDir, cfg.model);
  if (!fs.existsSync(dir)) return false;
  let found = false;
  const walk = (d: string) => {
    if (found) return;
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.onnx')) found = true;
    }
  };
  walk(dir);
  return found;
}
