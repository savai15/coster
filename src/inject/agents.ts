import { ProjectContext } from '../types/index.js';
import { BaseGenerator } from './base.js';

export class AgentsGenerator extends BaseGenerator {
  constructor(tokenBudget: number = 15000) {
    super(tokenBudget, 'opencode');
  }

  generate(context: ProjectContext): string {
    const prioritized = this.budget.prioritize(context.memories);
    const grouped = this.groupByCategory(prioritized);

    let content = `# AGENTS.md\n\n`;

    content += `## Project Overview\n`;
    content += `This is a ${context.stack.language} project using ${context.stack.framework}.\n\n`;

    content += `## Setup\n`;
    content += `- Install dependencies: \`${this.getInstallCommand(context.stack.packageManager)}\`\n`;
    content += `- Run dev server: \`${this.getDevCommand(context.stack.packageManager)}\`\n`;
    content += `- Run tests: \`${this.getTestCommand(context.stack.packageManager)}\`\n\n`;

    if (grouped.convention?.length) {
      content += `## Code Style\n`;
      content += this.formatMemoryList(grouped.convention) + '\n\n';
    }

    if (grouped.decision?.length) {
      content += `## Architecture\n`;
      content += this.formatMemoryList(grouped.decision) + '\n\n';
    }

    if (grouped.workaround?.length) {
      content += `## Important Notes\n`;
      content += grouped.workaround.map(m => `- ⚠️ ${m.memory.content}`).join('\n') + '\n\n';
    }

    if (grouped.mistake?.length) {
      content += `## Mistakes to Avoid\n`;
      content += this.formatMemoryList(grouped.mistake) + '\n\n';
    }

    return content;
  }

  private getInstallCommand(packageManager: string): string {
    const commands: Record<string, string> = {
      npm: 'npm install',
      pnpm: 'pnpm install',
      yarn: 'yarn install',
      bun: 'bun install',
    };
    return commands[packageManager] || 'npm install';
  }

  private getDevCommand(packageManager: string): string {
    const commands: Record<string, string> = {
      npm: 'npm run dev',
      pnpm: 'pnpm dev',
      yarn: 'yarn dev',
      bun: 'bun dev',
    };
    return commands[packageManager] || 'npm run dev';
  }

  private getTestCommand(packageManager: string): string {
    const commands: Record<string, string> = {
      npm: 'npm test',
      pnpm: 'pnpm test',
      yarn: 'yarn test',
      bun: 'bun test',
    };
    return commands[packageManager] || 'npm test';
  }
}
