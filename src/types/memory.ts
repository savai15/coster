import { z } from 'zod';

export const MemoryCategorySchema = z.enum([
  'preference',
  'convention',
  'decision',
  'investigation',
  'workaround',
  'recap',
  'mistake',
]);

export type MemoryCategory = z.infer<typeof MemoryCategorySchema>;

export const MemorySourceSchema = z.enum(['git-hook', 'shell-hook', 'manual', 'auto']);

export type MemorySource = z.infer<typeof MemorySourceSchema>;

export const MemorySchema = z.object({
  id: z.string().uuid(),
  category: MemoryCategorySchema,
  content: z.string().min(1).max(10000),
  importance: z.number().min(0).max(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  accessedAt: z.string().datetime(),
  accessCount: z.number().int().min(0),
  tags: z.array(z.string()),
  source: MemorySourceSchema,
  metadata: z.record(z.unknown()).optional(),
});

export type Memory = z.infer<typeof MemorySchema>;

export const CreateMemorySchema = MemorySchema.omit({ id: true });
export type CreateMemory = z.infer<typeof CreateMemorySchema>;

export const UpdateMemorySchema = MemorySchema.partial().required({ id: true });
export type UpdateMemory = z.infer<typeof UpdateMemorySchema>;
