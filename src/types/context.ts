import { z } from 'zod';
import { MemorySchema } from './memory.js';

export const StackInfoSchema = z.object({
  language: z.string(),
  framework: z.string(),
  buildSystem: z.string(),
  packageManager: z.string(),
  testFramework: z.string(),
});

export type StackInfo = z.infer<typeof StackInfoSchema>;

export const SessionSchema = z.object({
  id: z.string().uuid(),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime().optional(),
  summary: z.string().optional(),
  filesChanged: z.array(z.string()),
  decisionsMade: z.array(z.string()),
});

export type Session = z.infer<typeof SessionSchema>;

export const ProjectContextSchema = z.object({
  path: z.string(),
  name: z.string(),
  stack: StackInfoSchema,
  memories: z.array(MemorySchema),
  sessions: z.array(SessionSchema),
  lastUpdated: z.string().datetime(),
});

export type ProjectContext = z.infer<typeof ProjectContextSchema>;
