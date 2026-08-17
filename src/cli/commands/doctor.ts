import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { loadConfig } from '../../core/config.js';
import { CosterConfigSchema } from '../../types/index.js';
import { listAvailableTools } from '../../inject/detect.js';
import { isGitRepo, hooksDir } from './hooks.js';
import { Storage } from '../../core/storage.js';
import { printInfo } from '../utils/output.js';

interface Check {
  name: string;
  status: 'OK' | 'WARN' | 'ERROR';
  detail: string;
  fix?: string;
}

const SILENT = process.env.COSTER_SILENT === '1';

export function doctorCommand(program: Command): void {
  program
    .command('doctor')
    .description('Check Coster health and environment')
    .action(async () => {
      const cwd = process.cwd();
      const checks: Check[] = [];

      const nodeMajor = parseInt(process.version.replace(/^v/, ''), 10);
      checks.push({
        name: 'Node >= 18',
        status: nodeMajor >= 18 ? 'OK' : 'ERROR',
        detail: process.version,
        fix: nodeMajor >= 18 ? undefined : 'Upgrade Node to >= 18.',
      });

      const costerDir = path.join(cwd, '.coster');
      const initialized = fs.existsSync(costerDir);
      checks.push({
        name: 'Initialized',
        status: initialized ? 'OK' : 'WARN',
        detail: initialized ? 'yes' : 'no',
        fix: initialized ? undefined : 'Run `coster init`.',
      });

      if (initialized) {
        const config = loadConfig(cwd);
        const parsed = CosterConfigSchema.safeParse(config);
        checks.push({
          name: 'Config valid',
          status: parsed.success ? 'OK' : 'ERROR',
          detail: parsed.success ? 'yes' : 'invalid',
          fix: parsed.success ? undefined : 'Fix or delete .coster/config.json.',
        });

        let storageOk = false;
        let storageDetail = '';
        try {
          const s = await Storage.create(cwd);
          storageOk = true;
          storageDetail = 'ok';
          s.close();
        } catch (e) {
          storageDetail = e instanceof Error ? e.message : String(e);
        }
        checks.push({
          name: 'Database',
          status: storageOk ? 'OK' : 'ERROR',
          detail: storageDetail,
          fix: storageOk ? undefined : 'Run `coster init` to recreate.',
        });

        const git = isGitRepo(cwd);
        checks.push({
          name: 'Git repo',
          status: git ? 'OK' : 'WARN',
          detail: git ? 'yes' : 'no',
        });
        if (git) {
          const hooksPresent = fs.existsSync(path.join(hooksDir(cwd), 'post-commit'));
          const hooksStatus: 'OK' | 'WARN' = config.hooks.git
            ? hooksPresent
              ? 'OK'
              : 'WARN'
            : 'OK';
          checks.push({
            name: 'Git hooks',
            status: hooksStatus,
            detail: config.hooks.git ? (hooksPresent ? 'installed' : 'configured but missing') : 'disabled',
            fix: config.hooks.git && !hooksPresent ? 'Run `coster hooks install`.' : undefined,
          });
        }

        const mcpJson = path.join(cwd, '.mcp.json');
        let mcpOk = false;
        if (fs.existsSync(mcpJson)) {
          try {
            const o = JSON.parse(fs.readFileSync(mcpJson, 'utf-8'));
            mcpOk = !!(o.mcpServers && o.mcpServers.coster);
          } catch {
            /* ignore */
          }
        }
        checks.push({
          name: 'MCP registered',
          status: mcpOk ? 'OK' : 'WARN',
          detail: mcpOk ? 'yes' : 'no',
          fix: mcpOk ? undefined : 'Run `coster mcp-install`.',
        });

        const missing = listAvailableTools(cwd).filter(
          (t) => !config.tools.find((c) => c.name === t)
        );
        if (missing.length) {
          checks.push({
            name: 'Tool discovery',
            status: 'WARN',
            detail: `unconfigured: ${missing.join(', ')}`,
            fix: 'Run `coster sync` to auto-enable.',
          });
        } else {
          checks.push({
            name: 'Tool discovery',
            status: 'OK',
            detail: 'all detected tools configured',
          });
        }
      }

      let ffmpeg = false;
      try {
        execSync('ffmpeg -version', { stdio: ['ignore', 'ignore', 'ignore'] });
        ffmpeg = true;
      } catch {
        /* ignore */
      }
      checks.push({
        name: 'ffmpeg (optional)',
        status: ffmpeg ? 'OK' : 'WARN',
        detail: ffmpeg ? 'present' : 'missing',
        fix: ffmpeg ? undefined : 'Optional; only used for promo video generation.',
      });

      const errorCount = checks.filter((c) => c.status === 'ERROR').length;

      if (!SILENT) {
        console.log('Coster doctor:\n');
        for (const c of checks) {
          const tag = c.status === 'OK' ? 'OK  ' : c.status === 'WARN' ? 'WARN' : 'ERR ';
          let line = `  [${tag}] ${c.name.padEnd(18)} : ${c.detail}`;
          if (c.fix) line += `  -> ${c.fix}`;
          console.log(line);
        }
      }

      if (errorCount > 0) process.exitCode = 1;
    });
}
