import { ProjectContext } from '../types/index.js';
import { BaseGenerator } from './base.js';

export class CosterGenerator extends BaseGenerator {
  constructor(tokenBudget: number = 12000) {
    super(tokenBudget, 'coster');
  }

  generate(context: ProjectContext): string {
    const prioritized = this.budget.prioritize(context.memories);
    const grouped = this.groupByCategory(prioritized);

    let content = `# ${context.name}\n\n`;
    content += `> This file is generated and maintained by [Coster](https://www.npmjs.com/package/coster).\n`;
    content += `> Hand-written notes outside the managed region are preserved on every sync.\n\n`;

    content += `## Project Overview\n`;
    content += `- Language: ${context.stack.language}\n`;
    content += `- Framework: ${context.stack.framework}\n`;
    content += `- Build System: ${context.stack.buildSystem}\n`;
    content += `- Package Manager: ${context.stack.packageManager}\n`;
    content += `- Test Framework: ${context.stack.testFramework}\n\n`;

    const sections: [string, string][] = [
      ['decision', 'Architecture Decisions'],
      ['convention', 'Coding Conventions'],
      ['workaround', 'Known Workarounds'],
      ['investigation', 'Active Investigations'],
      ['preference', 'Preferences'],
      ['mistake', 'Known Mistakes to Avoid'],
      ['recap', 'Recent Activity'],
    ];

    for (const [cat, title] of sections) {
      const list = grouped[cat];
      if (list?.length) {
        content += `## ${title}\n`;
        content += this.formatMemoryList(list) + '\n\n';
      }
    }

    return content;
  }
}
