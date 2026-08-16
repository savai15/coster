import { ProjectContext } from '../types/index.js';
import { BaseGenerator } from './base.js';

export class ContinueGenerator extends BaseGenerator {
  constructor(tokenBudget: number = 10000) {
    super(tokenBudget, 'continue');
  }

  generate(context: ProjectContext): string {
    const prioritized = this.budget.prioritize(context.memories);
    const grouped = this.groupByCategory(prioritized);

    let content = '';

    content += `# Always Active\n\n`;
    if (grouped.decision?.length) {
      content += this.formatMemoryList(grouped.decision) + '\n\n';
    }

    Object.entries(grouped).forEach(([category, memories]) => {
      if (category !== 'decision') {
        content += `# ${category.charAt(0).toUpperCase() + category.slice(1)}\n\n`;
        content += this.formatMemoryList(memories) + '\n\n';
      }
    });

    return content;
  }
}
