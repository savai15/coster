import { Storage } from '../../core/storage.js';
import { generateExports } from '../../core/export.js';
import { loadConfig } from '../../core/config.js';
import { printInfo } from './output.js';

const SILENT = process.env.COSTER_SILENT === '1';

/**
 * Regenerate tool-specific memory files after a capture/edit/delete, but only
 * when the user has `autoInject` enabled. Never throws — a sync failure must
 * not block the original capture.
 */
export function syncAfterCapture(storage: Storage, projectPath: string): void {
  try {
    const config = loadConfig(projectPath);
    if (!config.autoInject) return;
    const results = generateExports(storage, projectPath, {});
    if (SILENT) return;
    for (const r of results) {
      if (r.written) {
        printInfo(`Synced ${r.tool} -> ${r.path}`);
      }
    }
  } catch {
    // swallow — sync is best-effort
  }
}
