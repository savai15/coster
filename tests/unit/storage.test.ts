import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Storage } from '../../src/core/storage.js';
import fs from 'fs';
import path from 'path';

describe('Storage', () => {
  let storage: Storage;
  const testDir = path.join(__dirname, '../fixtures/test-project');

  beforeEach(async () => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testDir, { recursive: true });
    fs.mkdirSync(path.join(testDir, '.coster'), { recursive: true });
    storage = await Storage.create(testDir);
  });

  afterEach(() => {
    storage.close();
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('createMemory', () => {
    it('should create a memory with all fields', () => {
      const memory = storage.createMemory({
        category: 'convention',
        content: 'Use 2-space indentation',
        importance: 0.8,
        tags: ['style', 'indentation'],
        source: 'manual',
      });

      expect(memory).toBeDefined();
      expect(memory.id).toBeDefined();
      expect(memory.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      expect(memory.category).toBe('convention');
      expect(memory.content).toBe('Use 2-space indentation');
      expect(memory.importance).toBe(0.8);
      expect(memory.tags).toEqual(['style', 'indentation']);
      expect(memory.source).toBe('manual');
    });

    it('should set timestamps correctly', () => {
      const before = new Date().toISOString();
      const memory = storage.createMemory({
        category: 'convention',
        content: 'Test memory',
        importance: 0.5,
        tags: [],
        source: 'manual',
      });
      const after = new Date().toISOString();

      expect(memory.createdAt >= before).toBe(true);
      expect(memory.createdAt <= after).toBe(true);
      expect(memory.updatedAt).toBe(memory.createdAt);
      expect(memory.accessedAt).toBe(memory.createdAt);
      expect(memory.accessCount).toBe(0);
    });

    it('should handle empty tags', () => {
      const memory = storage.createMemory({
        category: 'convention',
        content: 'Test memory',
        importance: 0.5,
        tags: [],
        source: 'manual',
      });

      expect(memory.tags).toEqual([]);
    });
  });

  describe('getMemory', () => {
    it('should retrieve a memory by id', () => {
      const created = storage.createMemory({
        category: 'convention',
        content: 'Test memory',
        importance: 0.5,
        tags: [],
        source: 'manual',
      });

      const retrieved = storage.getMemory(created.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.content).toBe('Test memory');
    });

    it('should return null for non-existent id', () => {
      const retrieved = storage.getMemory('550e8400-e29b-41d4-a716-446655440000');
      expect(retrieved).toBeNull();
    });
  });

  describe('updateMemory', () => {
    it('should update memory fields', () => {
      const created = storage.createMemory({
        category: 'convention',
        content: 'Original content',
        importance: 0.5,
        tags: [],
        source: 'manual',
      });

      const updated = storage.updateMemory(created.id, {
        content: 'Updated content',
        importance: 0.9,
      });

      expect(updated).toBeDefined();
      expect(updated?.content).toBe('Updated content');
      expect(updated?.importance).toBe(0.9);
      expect(updated?.updatedAt).toBeDefined();
      expect(new Date(updated!.updatedAt).getTime()).toBeGreaterThan(0);
    });

    it('should return null for non-existent id', () => {
      const updated = storage.updateMemory('550e8400-e29b-41d4-a716-446655440000', {
        content: 'Updated',
      });
      expect(updated).toBeNull();
    });
  });

  describe('deleteMemory', () => {
    it('should delete a memory', () => {
      const created = storage.createMemory({
        category: 'convention',
        content: 'To be deleted',
        importance: 0.5,
        tags: [],
        source: 'manual',
      });

      const deleted = storage.deleteMemory(created.id);
      expect(deleted).toBe(true);

      const retrieved = storage.getMemory(created.id);
      expect(retrieved).toBeNull();
    });

    it('should return false for non-existent id', () => {
      const deleted = storage.deleteMemory('550e8400-e29b-41d4-a716-446655440000');
      expect(deleted).toBe(false);
    });
  });

  describe('searchMemories', () => {
    it('should search by content', () => {
      storage.createMemory({
        category: 'convention',
        content: 'Use TypeScript strict mode',
        importance: 0.8,
        tags: ['typescript'],
        source: 'manual',
      });

      storage.createMemory({
        category: 'convention',
        content: 'Use functional components',
        importance: 0.7,
        tags: ['react'],
        source: 'manual',
      });

      const results = storage.searchMemories('TypeScript');
      expect(results).toHaveLength(1);
      expect(results[0].content).toContain('TypeScript');
    });

    it('should filter by category', () => {
      storage.createMemory({
        category: 'convention',
        content: 'Convention memory',
        importance: 0.5,
        tags: [],
        source: 'manual',
      });

      storage.createMemory({
        category: 'decision',
        content: 'Decision memory',
        importance: 0.5,
        tags: [],
        source: 'manual',
      });

      const results = storage.searchMemories('memory', 'convention');
      expect(results).toHaveLength(1);
      expect(results[0].category).toBe('convention');
    });
  });

  describe('getAllMemories', () => {
    it('should return all memories', () => {
      storage.createMemory({
        category: 'convention',
        content: 'Memory 1',
        importance: 0.5,
        tags: [],
        source: 'manual',
      });

      storage.createMemory({
        category: 'decision',
        content: 'Memory 2',
        importance: 0.5,
        tags: [],
        source: 'manual',
      });

      const all = storage.getAllMemories();
      expect(all).toHaveLength(2);
    });

    it('should filter by category', () => {
      storage.createMemory({
        category: 'convention',
        content: 'Convention',
        importance: 0.5,
        tags: [],
        source: 'manual',
      });

      storage.createMemory({
        category: 'decision',
        content: 'Decision',
        importance: 0.5,
        tags: [],
        source: 'manual',
      });

      const conventions = storage.getAllMemories('convention');
      expect(conventions).toHaveLength(1);
      expect(conventions[0].category).toBe('convention');
    });
  });

  describe('backup', () => {
    it('should create a backup file', () => {
      storage.createMemory({
        category: 'convention',
        content: 'Test backup',
        importance: 0.5,
        tags: [],
        source: 'manual',
      });

      const backupPath = storage.backup();
      expect(fs.existsSync(backupPath)).toBe(true);
    });
  });

  describe('getExpiredMemories', () => {
    it('should identify expired recaps', () => {
      const memory = storage.createMemory({
        category: 'recap',
        content: 'Old recap',
        importance: 0.3,
        tags: [],
        source: 'manual',
      });

      storage.updateMemory(memory.id, {
        updatedAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString(),
      });

      const expired = storage.getExpiredMemories();
      expect(expired).toHaveLength(1);
      expect(expired[0].id).toBe(memory.id);
    });
  });
});
