import { ProjectContext } from '../types/index.js';
import { BaseGenerator } from './base.js';

export class CursorGenerator extends BaseGenerator {
  constructor(tokenBudget: number = 12000) {
    super(tokenBudget, 'cursor');
  }

  generate(context: ProjectContext): string {
    const prioritized = this.budget.prioritize(context.memories);
    const grouped = this.groupByCategory(prioritized);

    let content = '';

    content += this.generateMDC('global', 'Global rules that always apply',
      ['*'], true, this.getGlobalRules(context));

    Object.entries(grouped).forEach(([category, memories]) => {
      const globPattern = this.getGlobPattern(category, context.stack.language);
      const rules = this.formatMemoryList(memories);
      content += this.generateMDC(category, `${category} rules`,
        [globPattern], false, rules);
    });

    return content;
  }

  private generateMDC(
    name: string,
    description: string,
    globs: string[],
    alwaysApply: boolean,
    content: string
  ): string {
    return `---
description: ${description}
globs: ${JSON.stringify(globs)}
alwaysApply: ${alwaysApply}
---

${content}

`;
  }

  private getGlobalRules(context: ProjectContext): string {
    return `- Project uses ${context.stack.language} with ${context.stack.framework}
- Build system: ${context.stack.buildSystem}
- Package manager: ${context.stack.packageManager}`;
  }

  private getGlobPattern(category: string, language: string): string {
    const extensions: Record<string, string> = {
      TypeScript: 'ts,tsx',
      JavaScript: 'js,jsx',
      Python: 'py',
      Rust: 'rs',
      Go: 'go',
      'TypeScript/JavaScript': 'ts,tsx,js,jsx',
    };
    const ext = extensions[language] || 'ts,tsx';
    return `src/**/*.${ext}`;
  }
}
