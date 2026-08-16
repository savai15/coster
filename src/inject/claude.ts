import { ProjectContext } from '../types/index.js';
import { BaseGenerator } from './base.js';

export class ClaudeGenerator extends BaseGenerator {
  constructor(tokenBudget: number = 17000) {
    super(tokenBudget, 'claude-code');
  }

  generate(context: ProjectContext): string {
    const prioritized = this.budget.prioritize(context.memories);
    const grouped = this.groupByCategory(prioritized);

    let content = `# ${context.name}\n\n`;

    content += `## Project Overview\n`;
    content += `- Language: ${context.stack.language}\n`;
    content += `- Framework: ${context.stack.framework}\n`;
    content += `- Build System: ${context.stack.buildSystem}\n`;
    content += `- Package Manager: ${context.stack.packageManager}\n\n`;

    if (grouped.decision?.length) {
      content += `## Architecture Decisions\n`;
      content += this.formatMemoryList(grouped.decision) + '\n\n';
    }

    if (grouped.convention?.length) {
      content += `## Coding Conventions\n`;
      content += this.formatMemoryList(grouped.convention) + '\n\n';
    }

    if (grouped.workaround?.length) {
      content += `## Known Workarounds\n`;
      content += this.formatMemoryList(grouped.workaround) + '\n\n';
    }

    if (grouped.investigation?.length) {
      content += `## Active Investigations\n`;
      content += this.formatMemoryList(grouped.investigation) + '\n\n';
    }

    if (grouped.preference?.length) {
      content += `## Preferences\n`;
      content += this.formatMemoryList(grouped.preference) + '\n\n';
    }

    if (grouped.mistake?.length) {
      content += `## Known Mistakes to Avoid\n`;
      content += this.formatMemoryList(grouped.mistake) + '\n\n';
    }

    if (grouped.recap?.length) {
      content += `## Recent Activity\n`;
      content += this.formatMemoryList(grouped.recap) + '\n\n';
    }

    return content;
  }
}
