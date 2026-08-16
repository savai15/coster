import fs from 'fs';
import path from 'path';
import { CosterConfig, defaultConfig } from '../types/index.js';

const CONFIG_FILE = 'config.json';

export function configPath(projectPath: string): string {
  return path.join(projectPath, '.coster', CONFIG_FILE);
}

export function loadConfig(projectPath: string): CosterConfig {
  const filePath = configPath(projectPath);

  if (!fs.existsSync(filePath)) {
    return { ...defaultConfig };
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    return { ...defaultConfig, ...parsed };
  } catch {
    return { ...defaultConfig };
  }
}

export function saveConfig(projectPath: string, config: CosterConfig): void {
  const costerDir = path.join(projectPath, '.coster');
  if (!fs.existsSync(costerDir)) {
    fs.mkdirSync(costerDir, { recursive: true });
  }
  fs.writeFileSync(configPath(projectPath), JSON.stringify(config, null, 2));
}

export function getConfig(projectPath: string): CosterConfig {
  return loadConfig(projectPath);
}
