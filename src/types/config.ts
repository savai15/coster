import { z } from 'zod';
import os from 'os';
import path from 'path';

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
  decayHalfLifeDays: z.number().int().min(1).max(3650),
  decayMinImportance: z.number().min(0).max(1),
  consolidateSimilarity: z.number().min(0).max(1),
});

export type LifecycleConfig = z.infer<typeof LifecycleConfigSchema>;

export const SchedulerConfigSchema = z.object({
  enabled: z.boolean(),
  decayEveryHours: z.number().int().min(1).max(24 * 30),
  archiveEveryHours: z.number().int().min(1).max(24 * 30),
  consolidateEveryHours: z.number().int().min(1).max(24 * 365),
});

export type SchedulerConfig = z.infer<typeof SchedulerConfigSchema>;

export const HooksConfigSchema = z.object({
  git: z.boolean(),
  shell: z.boolean(),
  postCommit: z.boolean(),
  postCheckout: z.boolean(),
  prepareCommitMsg: z.boolean(),
});

export type HooksConfig = z.infer<typeof HooksConfigSchema>;

export const CommitPolicySchema = z.object({
  enabled: z.boolean(),
  minDiffLines: z.number().int().min(1).max(100000),
  signalGlobs: z.array(z.string()),
  fixKeywords: z.array(z.string()),
});

export type CommitPolicy = z.infer<typeof CommitPolicySchema>;

export const ShellCaptureSchema = z.object({
  enabled: z.boolean(),
});

export type ShellCapture = z.infer<typeof ShellCaptureSchema>;

export const PrCaptureSchema = z.object({
  enabled: z.boolean(),
  limit: z.number().int().min(1).max(500),
});

export type PrCapture = z.infer<typeof PrCaptureSchema>;

export const CaptureConfigSchema = z.object({
  commitPolicy: CommitPolicySchema,
  shell: ShellCaptureSchema,
  pr: PrCaptureSchema,
});

export type CaptureConfig = z.infer<typeof CaptureConfigSchema>;

export const EmbeddingsConfigSchema = z.object({
  enabled: z.boolean(),
  model: z.string(),
  dim: z.number().int().min(1).max(4096),
  modelDir: z.string(),
  autoBuild: z.boolean(),
});

export type EmbeddingsConfig = z.infer<typeof EmbeddingsConfigSchema>;

export const InjectionConfigSchema = z.object({
  mode: z.enum(['curated', 'all']),
  useSemantic: z.boolean(),
  semanticWeight: z.number().min(0).max(1),
  maxMemories: z.number().int().min(1).max(2000),
  proactive: z.boolean(),
});

export type InjectionConfig = z.infer<typeof InjectionConfigSchema>;

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
  capture: CaptureConfigSchema,
  embeddings: EmbeddingsConfigSchema,
  scheduler: SchedulerConfigSchema,
  injection: InjectionConfigSchema,
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
    { name: 'coster', enabled: true, exportPath: 'COSTER.md', tokenBudget: 12000 },
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
    decayHalfLifeDays: 180,
    decayMinImportance: 0.2,
    consolidateSimilarity: 0.92,
  },
  hooks: {
    git: false,
    shell: false,
    postCommit: true,
    postCheckout: true,
    prepareCommitMsg: false,
  },
  capture: {
    commitPolicy: {
      enabled: true,
      minDiffLines: 120,
      signalGlobs: [
        'CLAUDE.md',
        'AGENTS.md',
        '**/*.rules',
        '**/*.rule',
        '**/*.config.*',
        'package.json',
        'package-lock.json',
        'tsconfig*.json',
        '**/migrations/**',
        'Dockerfile',
        'Makefile',
        '.env*',
        '**/.cursorrules',
        '**/.windsurf/**',
        '**/.clinerules',
      ],
      fixKeywords: ['fix', 'bug', 'hotfix', 'workaround', 'revert', 'patch'],
    },
    shell: { enabled: false },
    pr: { enabled: false, limit: 20 },
  },
  autoInject: true,
  embeddings: {
    enabled: true,
    model: 'Xenova/bge-base-en-v1.5',
    dim: 768,
    modelDir: path.join(os.homedir(), '.coster', 'models'),
    autoBuild: true,
  },
  scheduler: {
    enabled: false,
    decayEveryHours: 24,
    archiveEveryHours: 24,
    consolidateEveryHours: 168,
  },
  injection: {
    mode: 'curated',
    useSemantic: true,
    semanticWeight: 0.4,
    maxMemories: 200,
    proactive: true,
  },
};
