import { ProjectContext } from '../types/index.js';
import { BaseGenerator } from './base.js';

export class CopilotGenerator extends BaseGenerator {
  constructor(tokenBudget: number = 8000) {
    super(tokenBudget, 'copilot');
  }

  generate(context: ProjectContext): string {
    const prioritized = this.budget.prioritize(context.memories);
    const grouped = this.groupByCategory(prioritized);

    let content = `# GitHub Copilot Instructions\n\n`;

    content += `## Project Context\n`;
    content += `This is a ${context.stack.language} project using ${context.stack.framework}.\n\n`;

    if (grouped.convention?.length) {
      content += `## Coding Guidelines\n`;
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

    return content;
  }
}
