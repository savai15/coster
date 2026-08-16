import { Memory } from '../types/index.js';

export interface QualityResult {
  score: number;
  passed: boolean;
  reasons: string[];
}

export class QualityGate {
  private minScore: number;

  constructor(minScore: number = 4) {
    this.minScore = minScore;
  }

  evaluate(memory: Memory, existingMemories: Memory[]): QualityResult {
    const reasons: string[] = [];
    let score = 0;

    if (this.checkSpecificity(memory.content)) {
      score += 1;
      reasons.push('Specific to project');
    } else {
      reasons.push('Too generic');
    }

    if (this.checkActionability(memory.content)) {
      score += 1;
      reasons.push('Actionable');
    } else {
      reasons.push('Not actionable');
    }

    if (this.checkCurrency(memory.updatedAt)) {
      score += 1;
      reasons.push('Current');
    } else {
      reasons.push('Outdated');
    }

    if (this.checkUniqueness(memory, existingMemories)) {
      score += 1;
      reasons.push('Unique');
    } else {
      reasons.push('Duplicate');
    }

    if (this.checkEvidence(memory)) {
      score += 1;
      reasons.push('Has evidence');
    } else {
      reasons.push('No evidence');
    }

    if (this.checkRelevance(memory)) {
      score += 1;
      reasons.push('Relevant');
    } else {
      reasons.push('Not relevant');
    }

    if (this.checkConciseness(memory.content)) {
      score += 1;
      reasons.push('Concise');
    } else {
      reasons.push('Too verbose');
    }

    return {
      score,
      passed: score >= this.minScore,
      reasons,
    };
  }

  private checkSpecificity(content: string): boolean {
    const genericPhrases = [
      'good code',
      'best practices',
      'write better',
      'code well',
      'do good',
      'be better',
      'improve quality',
      'write clean',
      'follow standards',
      'use common sense',
    ];
    
    const lowerContent = content.toLowerCase();
    return !genericPhrases.some(phrase => lowerContent.includes(phrase));
  }

  private checkActionability(content: string): boolean {
    const actionVerbs = [
      'run',
      'use',
      'prefer',
      'avoid',
      'check',
      'update',
      'create',
      'delete',
      'modify',
      'implement',
      'follow',
      'ensure',
      'always',
      'never',
      'must',
      'should',
    ];
    
    const lowerContent = content.toLowerCase();
    return actionVerbs.some(verb => lowerContent.includes(verb));
  }

  private checkCurrency(updatedAt: string): boolean {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return new Date(updatedAt) > thirtyDaysAgo;
  }

  private checkUniqueness(memory: Memory, existing: Memory[]): boolean {
    if (existing.length === 0) {
      return true;
    }

    return !existing.some(e => 
      this.calculateSimilarity(memory.content, e.content) > 0.8
    );
  }

  private checkEvidence(memory: Memory): boolean {
    const evidenceMarkers = [
      'git blame',
      'file:',
      'commit',
      'issue #',
      'pr #',
      'pull request',
      'link:',
      'reference:',
      'based on',
      'according to',
      'see ',
      'ref:',
    ];
    
    const lowerContent = memory.content.toLowerCase();
    const hasMarkers = evidenceMarkers.some(marker => lowerContent.includes(marker));
    const isGitHook = memory.source === 'git-hook';
    
    return hasMarkers || isGitHook;
  }

  private checkRelevance(memory: Memory): boolean {
    const relevantCategories = ['decision', 'workaround', 'investigation'];
    if (relevantCategories.includes(memory.category)) {
      return true;
    }

    return memory.importance >= 0.5;
  }

  private checkConciseness(content: string): boolean {
    const tokenCount = Math.ceil(content.length / 4);
    return tokenCount <= 200;
  }

  private calculateSimilarity(a: string, b: string): number {
    const setA = new Set(a.toLowerCase().split(/\s+/));
    const setB = new Set(b.toLowerCase().split(/\s+/));
    const intersection = new Set([...setA].filter(x => setB.has(x)));
    const union = new Set([...setA, ...setB]);
    
    if (union.size === 0) {
      return 0;
    }
    
    return intersection.size / union.size;
  }
}
