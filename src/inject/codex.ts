import { ProjectContext } from '../types/index.js';
import { BaseGenerator } from './base.js';

export class CodexGenerator extends BaseGenerator {
  constructor(tokenBudget: number = 10000) {
    super(tokenBudget, 'codex');
  }

  generate(context: ProjectContext): string {
    const prioritized = this.budget.prioritize(context.memories);
    const grouped = this.groupByCategory(prioritized);

    let content = `# Project Memory\n\n`;

    if (grouped.decision?.length) {
      content += `## Architecture\n`;
      content += this.formatMemoryList(grouped.decision) + '\n\n';
    }

    if (grouped.convention?.length) {
      content += `## Conventions\n`;
      content += this.formatMemoryList(grouped.convention) + '\n\n';
    }

    if (grouped.workaround?.length) {
      content += `## Workarounds\n`;
      content += this.formatMemoryList(grouped.workaround) + '\n\n';
    }

    return content;
  }
}
