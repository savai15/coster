import { Command } from 'commander';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';
import chokidar from 'chokidar';
import { Storage } from '../../core/storage.js';
import { loadConfig } from '../../core/config.js';
import { syncProject } from '../utils/syncProject.js';
import { resolveProjectPath, assertInitialized } from '../utils/project.js';
import { printInfo, printError } from '../utils/output.js';
import { runLifecycle } from '../../lifecycle/run.js';
import { curateContext } from '../../inject/curate.js';

const SILENT = process.env.COSTER_SILENT === '1';
const DEBOUNCE_MS = 1500;

function pidPath(projectPath: string): string {
  return path.join(projectPath, '.coster', 'daemon.pid');
}

function writePid(projectPath: string): void {
  fs.writeFileSync(pidPath(projectPath), String(process.pid));
}

function readPid(projectPath: string): number | null {
  try {
    const raw = fs.readFileSync(pidPath(projectPath), 'utf-8').trim();
    return raw ? parseInt(raw, 10) : null;
  } catch {
    return null;
  }
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** Path to the compiled CLI entry script (works in both CJS and ESM bundles). */
function cliEntry(): string {
  let dir: string;
  try {
    dir = path.dirname(fileURLToPath(import.meta.url));
  } catch {
    dir = __dirname;
  }
  // dist/cli/commands -> dist; the CLI binary is index.cjs
  return path.resolve(dir, '..', '..', 'index.cjs');
}

function taskName(projectPath: string): string {
  return `CosterDaemon-${path.basename(projectPath).replace(/[^a-z0-9]/gi, '_')}`;
}

/** Set up periodic lifecycle maintenance per the config schedule. Returns timers. */
function startScheduler(projectPath: string): NodeJS.Timeout[] {
  const config = loadConfig(projectPath);
  const timers: NodeJS.Timeout[] = [];
  const hours = (h: number) => Math.max(1, Math.round(h * 60 * 60 * 1000));

  if (config.scheduler.enabled) {
    timers.push(
      setInterval(
        () => {
          runLifecycle(projectPath, { steps: ['archive', 'decay'], silent: true }).catch(() => {});
        },
        hours(config.scheduler.archiveEveryHours)
      )
    );
    timers.push(
      setInterval(
        () => {
          runLifecycle(projectPath, { steps: ['consolidate'], silent: true }).catch(() => {});
        },
        hours(config.scheduler.consolidateEveryHours)
      )
    );
  }
  return timers;
}

function installServiceCommand(projectPath: string): { ok: boolean; message: string } {
  const nodeExe = process.execPath;
  const entry = cliEntry();
  const tr = `${JSON.stringify(nodeExe)} ${JSON.stringify(entry)} daemon start --project ${JSON.stringify(projectPath)}`;

  if (os.platform() === 'win32') {
    try {
      execFileSync(
        'schtasks',
        ['/Create', '/TN', taskName(projectPath), '/SC', 'ONLOGON', '/TR', tr, '/F'],
        { stdio: 'ignore' }
      );
      return { ok: true, message: `Windows task "${taskName(projectPath)}" created (runs on login).` };
    } catch (err) {
      return { ok: false, message: `schtasks failed: ${err instanceof Error ? err.message : String(err)}` };
    }
  }

  if (os.platform() === 'darwin') {
    const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>${taskName(projectPath)}</string>
  <key>ProgramArguments</key>
  <array><string>${nodeExe}</string><string>${entry}</string><string>daemon</string><string>start</string><string>--project</string><string>${projectPath}</string></array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
</dict></plist>`;
    const dest = path.join(os.homedir(), 'Library', 'LaunchAgents', `${taskName(projectPath)}.plist`);
    return {
      ok: true,
      message: `Write this launchd plist to ${dest} and run:\n  launchctl load ${dest}\n\n${plist}`,
    };
  }

  // linux systemd user unit (template)
  const unit = `[Unit]
Description=Coster daemon for ${projectPath}

[Service]
ExecStart=${nodeExe} ${entry} daemon start --project ${projectPath}
Restart=on-failure

[Install]
WantedBy=default.target`;
  const dest = path.join(os.homedir(), '.config', 'systemd', 'user', `${taskName(projectPath)}.service`);
  return {
    ok: true,
    message: `Write this unit to ${dest} then:\n  systemctl --user enable --now ${taskName(projectPath)}\n\n${unit}`,
  };
}

/** Best-effort removal of the OS service installed by install-service. */
export function uninstallServiceCommand(projectPath: string): void {
  const name = taskName(projectPath);
  if (os.platform() === 'win32') {
    try {
      execFileSync('schtasks', ['/Delete', '/TN', name, '/F'], { stdio: 'ignore' });
    } catch {
      /* ignore */
    }
  }
}

/** Stop a running daemon for the project (best-effort). */
export function stopDaemon(projectPath: string): void {
  const pid = readPid(projectPath);
  if (pid !== null && isAlive(pid)) {
    try {
      process.kill(pid);
    } catch {
      /* ignore */
    }
  }
  try {
    fs.unlinkSync(pidPath(projectPath));
  } catch {
    /* ignore */
  }
}

export function daemonCommand(program: Command): void {
  const daemon = program
    .command('daemon')
    .description('Run the file-watch daemon that keeps assistant context files in sync');

  daemon
    .command('start')
    .description('Watch the project for changes and auto-sync (foreground; background it, or install a service)')
    .option('-p, --project <path>', 'project root')
    .action(async (options) => {
      try {
        const projectPath = resolveProjectPath(options.project);
        if (!assertInitialized(projectPath)) return;
        const costerDir = path.join(projectPath, '.coster');

        const existing = readPid(projectPath);
        if (existing !== null && isAlive(existing)) {
          printError(`Daemon already running (pid ${existing}).`);
          process.exitCode = 1;
          return;
        }

        writePid(projectPath);
        if (!SILENT) printInfo(`Coster daemon started (pid ${process.pid}). Watching ${projectPath} …`);

        const watcher = chokidar.watch(projectPath, {
          ignored: /(^|[\/\\])(node_modules|\.git|dist)([\/\\]|$)/,
          ignoreInitial: true,
          persistent: true,
        });

        const config = loadConfig(projectPath);
        const timers = startScheduler(projectPath);

        let timer: NodeJS.Timeout | null = null;
        const trigger = (filePath?: string) => {
          if (timer) clearTimeout(timer);
          timer = setTimeout(async () => {
            try {
              const storage = await Storage.create(projectPath);
              syncProject(projectPath, storage, { silent: true });
              if (
                filePath &&
                config.injection.proactive &&
                config.embeddings.enabled &&
                !SILENT
              ) {
                try {
                  const focus = path.basename(filePath);
                  const list = await curateContext(storage, projectPath, {
                    focus,
                    useSemantic: config.injection.useSemantic,
                    maxMemories: 2,
                  });
                  if (list.length) {
                    printInfo(`💡 Relevant memory for ${focus}: ${list[0].memory.content}`);
                  }
                } catch {
                  /* best-effort recall hint */
                }
              }
              storage.close();
            } catch {
              // best-effort; never crash the watcher
            }
          }, DEBOUNCE_MS);
        };

        watcher.on('all', (_event, p) => trigger(p));
        watcher.on('error', () => {
          /* ignore watch errors */
        });

        const shutdown = () => {
          try {
            fs.unlinkSync(pidPath(projectPath));
          } catch {
            /* ignore */
          }
          for (const t of timers) clearInterval(t);
          watcher.close();
          process.exit(0);
        };
        process.on('SIGINT', shutdown);
        process.on('SIGTERM', shutdown);
        // Process stays alive while the watcher runs.
      } catch (err) {
        printError(`Failed to start daemon: ${err instanceof Error ? err.message : String(err)}`);
        process.exitCode = 1;
      }
    });

  daemon
    .command('stop')
    .description('Stop a running daemon')
    .option('-p, --project <path>', 'project root')
    .action((options) => {
      const projectPath = resolveProjectPath(options.project);
      const pid = readPid(projectPath);
      if (pid === null || !isAlive(pid)) {
        if (!SILENT) printInfo('No running daemon found.');
        try {
          fs.unlinkSync(pidPath(projectPath));
        } catch {
          /* ignore */
        }
        return;
      }
      try {
        process.kill(pid);
        if (!SILENT) printInfo(`Stopped daemon (pid ${pid}).`);
      } catch {
        if (!SILENT) printError('Could not stop daemon.');
      }
      try {
        fs.unlinkSync(pidPath(projectPath));
      } catch {
        /* ignore */
      }
    });

  daemon
    .command('status')
    .description('Show whether the daemon is running')
    .option('-p, --project <path>', 'project root')
    .action((options) => {
      const projectPath = resolveProjectPath(options.project);
      const pid = readPid(projectPath);
      if (pid !== null && isAlive(pid)) {
        if (!SILENT) printInfo(`Daemon running (pid ${pid}).`);
      } else {
        if (!SILENT) printInfo('Daemon not running.');
      }
    });

  daemon
    .command('install-service')
    .description('Install an OS service so the daemon starts on login')
    .option('-p, --project <path>', 'project root')
    .action((options) => {
      const projectPath = resolveProjectPath(options.project);
      if (!assertInitialized(projectPath)) return;
      const res = installServiceCommand(projectPath);
      if (res.ok) printInfo(res.message);
      else printError(res.message);
    });

  daemon
    .command('uninstall-service')
    .description('Remove the OS service installed by install-service')
    .option('-p, --project <path>', 'project root')
    .action((options) => {
      const projectPath = resolveProjectPath(options.project);
      const name = taskName(projectPath);
      uninstallServiceCommand(projectPath);
      if (os.platform() === 'win32') {
        printInfo(`Removed Windows task "${name}".`);
      } else {
        printInfo(`Remove the service manually: ${name} (launchctl/systemctl --user disable).`);
      }
    });
}
