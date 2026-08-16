import { Command } from 'commander';

const COMMANDS = [
  'init', 'capture', 'search', 'list', 'sync', 'restore', 'hooks',
  'session', 'cleanup', 'mcp', 'config', 'status', 'stats', 'memory',
  'note', 'setup', 'show', 'completion',
];

function bashScript(): string {
  return `# Coster shell completion for bash
_coster() {
  local cur prev
  COMPREPLY=()
  cur="\${COMP_WORDS[COMP_CWORD]}"
  prev="\${COMP_WORDS[COMP_CWORD-1]}"
  if [ "$COMP_CWORD" -eq 1 ]; then
    COMPREPLY=( $(compgen -W "${COMMANDS.join(' ')}" -- "$cur") )
    return 0
  fi
}
complete -F _coster coster
`;
}

function zshScript(): string {
  return `# Coster shell completion for zsh
_coster() {
  local -a commands
  commands=( ${COMMANDS.map((c) => `'${c}'`).join(' ')} )
  if (( CURRENT == 2 )); then
    _describe 'command' commands
  fi
}
compdef _coster coster
`;
}

function fishScript(): string {
  return `# Coster shell completion for fish
complete -c coster -f
${COMMANDS.map((c) => `complete -c coster -n 'not __fish_seen_subcommand_from ${COMMANDS.join(' ')}' -a '${c}'`).join('\n')}
`;
}

function pwshScript(): string {
  return `# Coster shell completion for PowerShell
Register-ArgumentCompleter -Native -CommandName coster -ScriptBlock {
  param($wordToComplete, $commandAst, $cursorPosition)
  $commands = @('${COMMANDS.join("', '")}')
  $commands | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object {
    [System.Management.Automation.CompletionResult]::new($_, $_, 'ParameterValue', $_)
  }
}
`;
}

export function completionCommand(program: Command): void {
  program
    .command('completion <shell>')
    .description('Generate shell completion script (bash, zsh, fish, pwsh)')
    .action((shell: string) => {
      const map: Record<string, () => string> = {
        bash: bashScript,
        zsh: zshScript,
        fish: fishScript,
        pwsh: pwshScript,
        powershell: pwshScript,
      };

      const gen = map[shell.toLowerCase()];
      if (!gen) {
        console.error(`Unsupported shell: ${shell}. Supported: bash, zsh, fish, pwsh`);
        process.exitCode = 1;
        return;
      }

      process.stdout.write(gen());
    });
}
