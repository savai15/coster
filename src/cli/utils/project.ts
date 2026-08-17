import fs from 'fs';
import path from 'path';
import { printError } from './output.js';

/** Resolve the project root from an option or the current working directory. */
export function resolveProjectPath(project?: string): string {
  return project ? path.resolve(project) : process.cwd();
}

/** Ensure the project is initialized; print an error and set exit code if not. */
export function assertInitialized(projectPath: string): boolean {
  if (!fs.existsSync(path.join(projectPath, '.coster'))) {
    printError('Not initialized. Run `coster init` first.');
    process.exitCode = 1;
    return false;
  }
  return true;
}
