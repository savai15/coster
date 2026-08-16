import { ProjectContext } from '../types/index.js';
import { BaseGenerator } from './base.js';

export class ClineGenerator extends BaseGenerator {
  constructor(tokenBudget: number = 10000) {
    super(tokenBudget, 'cline');
  }

  generate(context: ProjectContext): string {
    const prioritized = this.budget.prioritize(context.memories);
    const grouped = this.groupByCategory(prioritized);

    let content = '';

    Object.entries(grouped).forEach(([category, memories]) => {
      content += `## ${category.charAt(0).toUpperCase() + category.slice(1)}\n\n`;
      content += this.formatMemoryList(memories) + '\n\n';
    });

    return content;
  }
}
