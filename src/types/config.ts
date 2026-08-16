import { z } from 'zod';

export const ToolConfigSchema = z.object({
  name: z.string(),
  enabled: z.boolean(),
  exportPath: z.string(),
  tokenBudget: z.number().int().min(1000).max(100000),
});

export type ToolConfig = z.infer<typeof ToolConfigSchema>;

export const QualityConfigSchema = z.object({
  minScore: z.number().min(0).max(7),
  maxTokens: z.number().int().min(50).max(1000),
  autoCleanup: z.boolean(),
});

export type QualityConfig = z.infer<typeof QualityConfigSchema>;

export const LifecycleConfigSchema = z.object({
  recapTTL: z.number().int().min(1).max(365),
  investigationTTL: z.number().int().min(1).max(365),
  workaroundTTL: z.number().int().min(1).max(365),
  autoArchive: z.boolean(),
});

export type LifecycleConfig = z.infer<typeof LifecycleConfigSchema>;

export const HooksConfigSchema = z.object({
  git: z.boolean(),
  shell: z.boolean(),
  postCommit: z.boolean(),
  postCheckout: z.boolean(),
});

export type HooksConfig = z.infer<typeof HooksConfigSchema>;

export const CosterConfigSchema = z.object({
  version: z.number().int().min(1),
  created_at: z.string().datetime(),
  project: z.object({
    name: z.string(),
    path: z.string(),
  }),
  tools: z.array(ToolConfigSchema),
  quality: QualityConfigSchema,
  lifecycle: LifecycleConfigSchema,
  hooks: HooksConfigSchema,
  autoInject: z.boolean(),
});

export type CosterConfig = z.infer<typeof CosterConfigSchema>;

export const defaultConfig: CosterConfig = {
  version: 1,
  created_at: new Date().toISOString(),
  project: {
    name: '',
    path: '',
  },
  tools: [
    { name: 'claude-code', enabled: true, exportPath: 'CLAUDE.md', tokenBudget: 17000 },
    { name: 'opencode', enabled: true, exportPath: 'AGENTS.md', tokenBudget: 15000 },
    { name: 'cursor', enabled: true, exportPath: '.cursorrules', tokenBudget: 12000 },
    { name: 'copilot', enabled: true, exportPath: '.github/copilot-instructions.md', tokenBudget: 8000 },
    { name: 'windsurf', enabled: true, exportPath: '.windsurf/rules/coster.md', tokenBudget: 10000 },
    { name: 'codex', enabled: true, exportPath: '.codex/memory.md', tokenBudget: 10000 },
    { name: 'cline', enabled: true, exportPath: '.clinerules', tokenBudget: 10000 },
    { name: 'continue', enabled: true, exportPath: '.continue/rules/coster.md', tokenBudget: 10000 },
    { name: 'kiro', enabled: true, exportPath: '.kiro/steering/coster.md', tokenBudget: 10000 },
  ],
  quality: {
    minScore: 4,
    maxTokens: 200,
    autoCleanup: true,
  },
  lifecycle: {
    recapTTL: 30,
    investigationTTL: 90,
    workaroundTTL: 90,
    autoArchive: true,
  },
  hooks: {
    git: false,
    shell: false,
    postCommit: true,
    postCheckout: true,
  },
  autoInject: true,
};
