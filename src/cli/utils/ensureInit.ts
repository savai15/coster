import fs from 'fs';
import path from 'path';
import { runBootstrap } from '../commands/init.js';

const SILENT = process.env.COSTER_SILENT === '1';

/**
 * Ensure a project is initialized before a command runs. If `.coster/` is
 * missing, perform a one-time auto-bootstrap so the rest of Coster "just works"
 * (set-and-forget). Auto-bootstrap is portable (no tool prompt) in non-interactive
 * contexts such as git hooks, and may prompt for a target tool in a TTY.
 */
export async function ensureInitialized(projectPath: string): Promise<void> {
  const costerDir = path.join(projectPath, '.coster');
  if (fs.existsSync(costerDir)) {
    return;
  }

  if (!SILENT) {
    console.log('Coster not initialized here — running one-time auto-setup…');
  }
  await runBootstrap({}, true);
}
