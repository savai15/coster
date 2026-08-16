import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import { Storage } from '../../core/storage.js';
import { isGitRepo } from '../../capture/git.js';
import { detectActiveTool } from '../../inject/detect.js';
import { hooksDir } from './hooks.js';
import { printInfo, printError } from '../utils/output.js';

export function statusCommand(program: Command): void {
  program
    .command('status')
    .description('Show Coster health and environment (doctor)')
    .action(async () => {
      try {
        const cwd = process.cwd();
        const costerDir = path.join(cwd, '.coster');
        const initialized = fs.existsSync(costerDir);
        const git = isGitRepo(cwd);
        const detected = detectActiveTool(cwd);

        const rows: (string | number)[][] = [];

        rows.push(['Initialized', initialized ? 'YES' : 'NO']);
        rows.push(['Git repository', git ? 'YES' : 'NO']);
        rows.push(['Detected tool', detected ?? 'none']);
        rows.push(['Hooks directory', fs.existsSync(hooksDir(cwd)) ? 'present' : 'missing']);

        let memoryCount = 0;
        let dbSize = 0;
        if (initialized) {
          const storage = await Storage.create(cwd);
          try {
            memoryCount = storage.getAllMemories().length;
          } finally {
            await storage.close();
          }
          const dbPath = path.join(costerDir, 'coster.db');
          if (fs.existsSync(dbPath)) {
            dbSize = fs.statSync(dbPath).size;
          }
        }
        rows.push(['Memories', memoryCount]);
        rows.push(['Database size', dbSize > 0 ? `${(dbSize / 1024).toFixed(1)} KB` : 'empty']);

        if (!initialized) {
          printError('Coster is not initialized in this project. Run `coster init`.');
          process.exitCode = 1;
          return;
        }

        printInfo('Coster status:\n');
        for (const [k, v] of rows) {
          console.log(`  ${String(k).padEnd(18)} : ${v}`);
        }
      } catch (error) {
        printError(`Failed to read status: ${error}`);
        process.exitCode = 1;
      }
    });
}
