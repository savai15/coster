import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import { loadConfig, saveConfig } from '../../core/config.js';
import { CosterConfig } from '../../types/index.js';

const SILENT = process.env.COSTER_SILENT === '1';
const MARKER_START = '# >>> coster shell integration >>>';
const MARKER_END = '# <<< coster shell integration <<<';

const POST_COMMIT_SCRIPT = `#!/bin/sh
# Coster auto-capture hook (installed by \`coster hooks install\`)
# Fails gracefully so it never blocks git operations.
coster capture commit >/dev/null 2>&1 || true
`;

const POST_CHECKOUT_SCRIPT = `#!/bin/sh
# Coster checkout hook (installed by \`coster hooks install\`)
coster capture checkout >/dev/null 2>&1 || true
`;

const PREPARE_COMMIT_MSG_SCRIPT = `#!/bin/sh
# Coster prepare-commit-msg hook (installed by \`coster hooks install --prepare-msg\`)
# Appends a cost: trailer when the staged change is "signal-rich". Opt-in; safe no-op otherwise.
coster capture prepare-msg "$1" >/dev/null 2>&1 || true
`;

export interface InstallHooksResult {
  git: boolean;
  shell: boolean;
  hooksDir: string;
}

export function hooksDir(projectPath: string): string {
  return path.join(projectPath, '.coster', 'hooks');
}

function writeHook(dir: string, name: string, content: string): void {
  const filePath = path.join(dir, name);
  fs.writeFileSync(filePath, content);
  try {
    fs.chmodSync(filePath, 0o755);
  } catch {
    // best effort (Windows)
  }
}

function setGitHooksPath(projectPath: string, value: string | null): boolean {
  try {
    if (value === null) {
      execSync('git config --unset core.hooksPath', {
        cwd: projectPath,
        stdio: ['ignore', 'ignore', 'ignore'],
      });
    } else {
      execSync(`git config core.hooksPath "${value}"`, {
        cwd: projectPath,
        stdio: ['ignore', 'ignore', 'ignore'],
      });
    }
    return true;
  } catch {
    return false;
  }
}

function getGitHooksPath(projectPath: string): string | null {
  try {
    const out = execSync('git config core.hooksPath', {
      cwd: projectPath,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return out.trim() || null;
  } catch {
    return null;
  }
}

export function isGitRepo(projectPath: string): boolean {
  try {
    const out = execSync('git rev-parse --is-inside-work-tree', {
      cwd: projectPath,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return out.trim() === 'true';
  } catch {
    return false;
  }
}

function shellRcPath(): string | null {
  if (process.platform === 'win32') {
    try {
      const out = execSync('powershell -NoProfile -Command "$PROFILE"', {
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      const p = out.trim();
      return p || null;
    } catch {
      const home = os.homedir();
      return path.join(home, 'Documents', 'WindowsPowerShell', 'Microsoft.PowerShell_profile.ps1');
    }
  }

  const home = os.homedir();
  const zsh = path.join(home, '.zshrc');
  if (fs.existsSync(zsh)) return zsh;
  return path.join(home, '.bashrc');
}

function shellBlock(powerShell: boolean): string {
  const logEnv = powerShell
    ? '$env:COSTER_SHELL_LOG = Join-Path $HOME ".coster-shell.log"'
    : 'export COSTER_SHELL_LOG="$HOME/.coster-shell.log"';

  if (powerShell) {
    return [
      MARKER_START,
      logEnv,
      '$env:COSTER_ACTIVE="1"',
      'coster session start --silent | Out-Null',
      '$costerOrigPrompt = $function:prompt',
      'function prompt {',
      '  $c = $LASTEXITCODE',
      '  $cmd = (Get-History -Count 1).CommandLine',
      '  if ($cmd) { "$c`t$cmd" | Out-File -Append -FilePath $env:COSTER_SHELL_LOG }',
      '  & $costerOrigPrompt',
      '}',
      MARKER_END,
    ].join('\n') + '\n';
  }

  return [
    MARKER_START,
    logEnv,
    'export COSTER_ACTIVE=1',
    'coster session start --silent >/dev/null 2>&1 || true',
    'coster_shell_log() {',
    '  local code=$?',
    '  local cmd=$(history 1 | sed "s/^[[:space:]]*[0-9]*[[:space:]]*//")',
    '  if [ -n "$cmd" ]; then echo "$code\\t$cmd" >> "$COSTER_SHELL_LOG"; fi',
    '}',
    'PROMPT_COMMAND="coster_shell_log; ${PROMPT_COMMAND}"',
    MARKER_END,
  ].join('\n') + '\n';
}

function installShell(config: CosterConfig): boolean {
  const rc = shellRcPath();
  if (!rc) {
    if (!SILENT) console.log('Could not determine shell rc file; skipping shell integration.');
    return false;
  }

  const isPs = process.platform === 'win32';
  const block = shellBlock(isPs);

  let content = '';
  if (fs.existsSync(rc)) {
    content = fs.readFileSync(rc, 'utf-8');
  }

  if (content.includes(MARKER_START)) {
    if (!SILENT) console.log(`Shell integration already present in ${rc}`);
    return true;
  }

  const dir = path.dirname(rc);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.appendFileSync(rc, `\n${block}`);
  if (!SILENT) console.log(`Shell integration added to ${rc}`);
  config.hooks.shell = true;
  return true;
}

function uninstallShell(config: CosterConfig): void {
  const rc = shellRcPath();
  if (!rc || !fs.existsSync(rc)) {
    config.hooks.shell = false;
    return;
  }

  const content = fs.readFileSync(rc, 'utf-8');
  if (!content.includes(MARKER_START)) {
    config.hooks.shell = false;
    return;
  }

  const filtered = content
    .split('\n')
    .filter(line => line !== MARKER_START && line !== MARKER_END)
    .filter((line, i, arr) => {
      const inBlock = arr.indexOf(MARKER_START) !== -1 &&
        i > arr.indexOf(MARKER_START) && i < arr.indexOf(MARKER_END);
      return !inBlock;
    })
    .join('\n');

  fs.writeFileSync(rc, filtered);
  if (!SILENT) console.log(`Shell integration removed from ${rc}`);
  config.hooks.shell = false;
}

export function installHooks(
  projectPath: string,
  opts: { shell?: boolean; force?: boolean; prepareMsg?: boolean } = {}
): InstallHooksResult {
  const dir = hooksDir(projectPath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const postCommit = path.join(dir, 'post-commit');
  const postCheckout = path.join(dir, 'post-checkout');
  const prepareMsg = path.join(dir, 'prepare-commit-msg');

  if (fs.existsSync(postCommit) && !opts.force) {
    if (!SILENT) console.log('post-commit hook already exists (use --force to overwrite).');
  } else {
    writeHook(dir, 'post-commit', POST_COMMIT_SCRIPT);
  }

  if (fs.existsSync(postCheckout) && !opts.force) {
    if (!SILENT) console.log('post-checkout hook already exists (use --force to overwrite).');
  } else {
    writeHook(dir, 'post-checkout', POST_CHECKOUT_SCRIPT);
  }

  const config = loadConfig(projectPath);
  if (opts.prepareMsg) {
    config.hooks.prepareCommitMsg = true;
  }

  const wantPrepare = opts.prepareMsg || config.hooks.prepareCommitMsg;
  if (wantPrepare) {
    if (fs.existsSync(prepareMsg) && !opts.force) {
      if (!SILENT) console.log('prepare-commit-msg hook already exists (use --force to overwrite).');
    } else {
      writeHook(dir, 'prepare-commit-msg', PREPARE_COMMIT_MSG_SCRIPT);
    }
  }

  let git = false;
  if (isGitRepo(projectPath)) {
    const absHooks = path.resolve(dir);
    const ok = setGitHooksPath(projectPath, absHooks);
    if (ok) {
      config.hooks.git = true;
      config.hooks.postCommit = true;
      config.hooks.postCheckout = true;
      if (!SILENT) console.log(`Git core.hooksPath set to ${absHooks}`);
      git = true;
    } else if (!SILENT) {
      console.log('Warning: could not set git core.hooksPath (not a git repo or git unavailable).');
    }
  } else if (!SILENT) {
    console.log('Not a git repository; hook scripts written but core.hooksPath not set.');
  }

  let shell = false;
  if (opts.shell) {
    shell = installShell(config);
  }

  saveConfig(projectPath, config);

  return { git, shell, hooksDir: dir };
}

export function uninstallHooks(projectPath: string): void {
  const config = loadConfig(projectPath);

  uninstallShell(config);

  if (config.hooks.git) {
    const current = getGitHooksPath(projectPath);
    const absHooks = path.resolve(hooksDir(projectPath));
    if (current && path.resolve(current) === absHooks) {
      setGitHooksPath(projectPath, null);
    }
    config.hooks.git = false;
    config.hooks.postCommit = false;
    config.hooks.postCheckout = false;
  }

  for (const name of ['post-commit', 'post-checkout']) {
    const scriptPath = path.join(hooksDir(projectPath), name);
    if (fs.existsSync(scriptPath)) {
      try {
        fs.unlinkSync(scriptPath);
      } catch {
        /* best effort */
      }
    }
  }

  saveConfig(projectPath, config);
}

export function hooksCommand(program: Command): void {
  const hooks = program.command('hooks').description('Manage git and shell hooks');

  hooks
    .command('install')
    .description('Install git hooks (and shell integration with --shell)')
    .option('--shell', 'Also install shell integration')
    .option('--prepare-msg', 'Also install prepare-commit-msg hook (appends cost: trailer for signal-rich commits)')
    .option('-f, --force', 'Overwrite existing hook scripts')
    .action((options) => {
      const projectPath = process.cwd();
      installHooks(projectPath, { shell: options.shell, force: options.force, prepareMsg: options.prepareMsg });
      if (!SILENT) console.log('Hooks installed. Coster will now auto-capture on commits.');
    });

  hooks
    .command('uninstall')
    .description('Remove git hooks and shell integration')
    .option('-f, --force', 'Force (ignored, kept for idempotency)')
    .action((options) => {
      const projectPath = process.cwd();
      uninstallHooks(projectPath);
      if (!SILENT) console.log('Hooks uninstalled.');
    });

  hooks
    .command('list')
    .description('Show installed hooks')
    .action(() => {
      const projectPath = process.cwd();
      const dir = hooksDir(projectPath);
      const config = loadConfig(projectPath);

       const postCommit = fs.existsSync(path.join(dir, 'post-commit'));
       const postCheckout = fs.existsSync(path.join(dir, 'post-checkout'));
       const prepareMsg = fs.existsSync(path.join(dir, 'prepare-commit-msg'));
       const gitHooksPath = isGitRepo(projectPath) ? getGitHooksPath(projectPath) : '(not a git repo)';

       if (!SILENT) {
         console.log('Coster hooks status:');
         console.log('  post-commit script :', postCommit ? 'installed' : 'missing');
         console.log('  post-checkout script:', postCheckout ? 'installed' : 'missing');
         console.log('  prepare-msg script :', prepareMsg ? 'installed' : 'missing');
         console.log('  git core.hooksPath :', gitHooksPath);
         console.log('  shell integration  :', config.hooks.shell ? 'enabled' : 'disabled');
       }
    });
}
