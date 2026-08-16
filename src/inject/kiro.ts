import { ProjectContext } from '../types/index.js';
import { BaseGenerator } from './base.js';

export class KiroGenerator extends BaseGenerator {
  constructor(tokenBudget: number = 10000) {
    super(tokenBudget, 'kiro');
  }

  generate(context: ProjectContext): string {
    const prioritized = this.budget.prioritize(context.memories);
    const grouped = this.groupByCategory(prioritized);

    let content = '';

    if (grouped.decision?.length) {
      content += `# Architecture Decisions\n\n`;
      content += this.formatMemoryList(grouped.decision) + '\n\n';
    }

    if (grouped.convention?.length) {
      content += `# Conventions\n\n`;
      content += this.formatMemoryList(grouped.convention) + '\n\n';
    }

    return content;
  }
}
