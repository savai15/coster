import { Command } from 'commander';
import { loadConfig, saveConfig } from '../../core/config.js';
import { CosterConfig } from '../../types/index.js';
import { printJson, printError, printInfo } from '../utils/output.js';

type Json = Record<string, any>;

function coerce(raw: string): string | number | boolean {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (raw !== '' && !Number.isNaN(Number(raw))) return Number(raw);
  return raw;
}

function getConfigValue(config: CosterConfig, key: string): unknown {
  const parts = key.split('.');
  if (parts[0] === 'tools' && parts.length >= 2) {
    const tool = (config.tools as Json[]).find((t) => t.name === parts[1]);
    if (!tool) return undefined;
    return parts.length > 2 ? tool[parts[2]] : tool;
  }
  return parts.reduce<unknown>((o, k) => (o == null ? undefined : (o as Json)[k]), config);
}

function setConfigValue(config: CosterConfig, key: string, value: unknown): void {
  const parts = key.split('.');
  if (parts[0] === 'tools' && parts.length >= 3) {
    const tool = (config.tools as Json[]).find((t) => t.name === parts[1]);
    if (!tool) {
      throw new Error(`Unknown tool: ${parts[1]}`);
    }
    tool[parts[2]] = value;
    return;
  }
  const last = parts.pop()!;
  let cur: Json = config as Json;
  for (const k of parts) {
    if (cur[k] == null || typeof cur[k] !== 'object') cur[k] = {};
    cur = cur[k];
  }
  cur[last] = value;
}

export function configCommand(program: Command): void {
  const configCmd = program.command('config').description('View and modify Coster configuration');

  configCmd
    .command('get <key>')
    .description('Get a config value (e.g. quality.minScore, tools.opencode.enabled)')
    .action((key: string) => {
      try {
        const config = loadConfig(process.cwd());
        const value = getConfigValue(config, key);
        if (value === undefined) {
          printError(`Unknown config key: ${key}`);
          process.exitCode = 1;
          return;
        }
        if (typeof value === 'object') {
          printJson(value);
        } else {
          console.log(String(value));
        }
      } catch (error) {
        printError(`Failed to read config: ${error}`);
        process.exitCode = 1;
      }
    });

  configCmd
    .command('set <key> <value>')
    .description('Set a config value (e.g. quality.minScore 5, tools.opencode.enabled false)')
    .action((key: string, value: string) => {
      try {
        const config = loadConfig(process.cwd());
        setConfigValue(config, key, coerce(value));
        saveConfig(process.cwd(), config);
        printInfo(`Set ${key} = ${value}`);
      } catch (error) {
        printError(`Failed to set config: ${error}`);
        process.exitCode = 1;
      }
    });

  configCmd
    .command('list')
    .alias('show')
    .description('Show the full configuration')
    .option('--json', 'Output as JSON')
    .action((options) => {
      try {
        const config = loadConfig(process.cwd());
        if (options.json) {
          printJson(config);
        } else {
          printInfo('Coster configuration:');
          console.log(JSON.stringify(config, null, 2));
        }
      } catch (error) {
        printError(`Failed to read config: ${error}`);
        process.exitCode = 1;
      }
    });
}
