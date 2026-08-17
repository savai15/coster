import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { Memory, MemoryCategory, CreateMemory, Session } from '../types/index.js';
import { loadConfig } from './config.js';

export class Storage {
  private db: SqlJsDatabase;
  private dbPath: string;
  private backupDir: string;
  private dataDir: string;

  private constructor(db: SqlJsDatabase, dbPath: string, backupDir: string, dataDir: string) {
    this.db = db;
    this.dbPath = dbPath;
    this.backupDir = backupDir;
    this.dataDir = dataDir;
  }

  static async create(projectPath: string): Promise<Storage> {
    const dataDir = path.join(projectPath, '.coster');
    const dbPath = path.join(dataDir, 'coster.db');
    const backupDir = path.join(dataDir, 'backups');

    // Ensure directories exist
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    // Initialize sql.js. sql.js resolves its own `sql-wasm.wasm` from its installed
    // location, which works for both local and global installs.
    const SQL = await initSqlJs();

    // Load or create database
    let db: SqlJsDatabase;
    if (fs.existsSync(dbPath)) {
      const fileBuffer = fs.readFileSync(dbPath);
      db = new SQL.Database(fileBuffer);
    } else {
      db = new SQL.Database();
    }

    const storage = new Storage(db, dbPath, backupDir, dataDir);
    storage.initialize();
    return storage;
  }

  private initialize(): void {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        category TEXT NOT NULL,
        content TEXT NOT NULL,
        importance REAL DEFAULT 0.5,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        accessed_at TEXT NOT NULL,
        access_count INTEGER DEFAULT 0,
        tags TEXT DEFAULT '[]',
        source TEXT NOT NULL,
        metadata TEXT DEFAULT '{}'
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        started_at TEXT NOT NULL,
        ended_at TEXT,
        summary TEXT,
        files_changed TEXT DEFAULT '[]',
        decisions_made TEXT DEFAULT '[]'
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `);

    // Create index for faster searches
    this.db.run('CREATE INDEX IF NOT EXISTS idx_memories_category ON memories(category)');
    this.db.run('CREATE INDEX IF NOT EXISTS idx_memories_updated_at ON memories(updated_at)');

    // Embedding vectors (L2-normalized floats) for semantic search.
    this.db.run(`
      CREATE TABLE IF NOT EXISTS memory_vectors (
        id TEXT PRIMARY KEY,
        vec BLOB NOT NULL
      )
    `);

    // Soft-archive: expired memories are moved here (restorable) instead of deleted.
    this.db.run(`
      CREATE TABLE IF NOT EXISTS archived_memories (
        id TEXT PRIMARY KEY,
        category TEXT NOT NULL,
        content TEXT NOT NULL,
        importance REAL DEFAULT 0.5,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        accessed_at TEXT NOT NULL,
        access_count INTEGER DEFAULT 0,
        tags TEXT DEFAULT '[]',
        source TEXT NOT NULL,
        metadata TEXT DEFAULT '{}',
        archived_at TEXT NOT NULL
      )
    `);
  }

  private projectPath(): string {
    return path.dirname(this.dataDir);
  }

  private packVector(vec: number[]): Buffer {
    return Buffer.from(Float32Array.from(vec).buffer);
  }

  private unpackVector(buf: Uint8Array): number[] {
    return Array.from(new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4));
  }

  upsertVector(id: string, vec: number[]): void {
    this.db.run('INSERT OR REPLACE INTO memory_vectors (id, vec) VALUES (?, ?)', [
      id,
      this.packVector(vec),
    ]);
  }

  getVector(id: string): number[] | null {
    const result = this.db.exec('SELECT vec FROM memory_vectors WHERE id = ?', [id]);
    if (result.length === 0 || result[0].values.length === 0) return null;
    const buf = result[0].values[0][0] as Uint8Array;
    return this.unpackVector(buf);
  }

  getAllVectors(): { id: string; vector: number[] }[] {
    const result = this.db.exec('SELECT id, vec FROM memory_vectors');
    if (result.length === 0) return [];
    const cols = result[0].columns;
    const idIdx = cols.indexOf('id');
    const vecIdx = cols.indexOf('vec');
    return result[0].values.map((row: unknown[]) => ({
      id: row[idIdx] as string,
      vector: this.unpackVector(row[vecIdx] as Uint8Array),
    }));
  }

  deleteVector(id: string): void {
    this.db.run('DELETE FROM memory_vectors WHERE id = ?', [id]);
  }

  vectorCount(): number {
    const result = this.db.exec('SELECT COUNT(*) AS n FROM memory_vectors');
    if (result.length === 0) return 0;
    return (result[0].values[0][0] as number) ?? 0;
  }

  clearVectors(): void {
    this.db.run('DELETE FROM memory_vectors');
    this.save();
  }

  createMemory(memory: CreateMemory): Memory {
    const id = uuidv4();
    const now = new Date().toISOString();
    const createdAt = memory.createdAt || now;
    const updatedAt = memory.updatedAt || now;
    const accessedAt = memory.accessedAt || now;
    const meta = { ...(memory.metadata || {}), baseImportance: memory.importance };

    this.db.run(
      `INSERT INTO memories (id, category, content, importance, created_at, updated_at, accessed_at, access_count, tags, source, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        memory.category,
        memory.content,
        memory.importance,
        createdAt,
        updatedAt,
        accessedAt,
        0,
        JSON.stringify(memory.tags),
        memory.source,
        JSON.stringify(meta),
      ]
    );

    return this.getMemory(id)!;
  }

  getMemory(id: string): Memory | null {
    const result = this.db.exec('SELECT * FROM memories WHERE id = ?', [id]);
    
    if (result.length === 0 || result[0].values.length === 0) {
      return null;
    }

    return this.rowToMemory(result[0].values[0], result[0].columns);
  }

  updateMemory(id: string, updates: Partial<Memory>): Memory | null {
    const existing = this.getMemory(id);
    if (!existing) {
      return null;
    }

    const updated = { ...existing, ...updates };
    if (!updates.updatedAt) {
      updated.updatedAt = new Date().toISOString();
    }

    this.db.run(
      `UPDATE memories 
       SET category = ?, content = ?, importance = ?, updated_at = ?, tags = ?, source = ?, metadata = ?
       WHERE id = ?`,
      [
        updated.category,
        updated.content,
        updated.importance,
        updated.updatedAt,
        JSON.stringify(updated.tags),
        updated.source,
        JSON.stringify(updated.metadata || {}),
        id,
      ]
    );
    this.save();

    return this.getMemory(id);
  }

  deleteMemory(id: string): boolean {
    const existing = this.getMemory(id);
    if (!existing) {
      return false;
    }
    this.db.run('DELETE FROM memories WHERE id = ?', [id]);
    this.deleteVector(id);
    this.save();
    return true;
  }

  recordAccess(id: string): void {
    this.db.run(
      'UPDATE memories SET access_count = access_count + 1, accessed_at = ? WHERE id = ?',
      [new Date().toISOString(), id]
    );
    this.save();
  }

  getMemoryCount(): number {
    return this.countRows('SELECT COUNT(*) FROM memories');
  }

  getArchivedCount(): number {
    return this.countRows('SELECT COUNT(*) FROM archived_memories');
  }

  private countRows(query: string): number {
    const res = this.db.exec(query);
    if (!res.length || res[0].values.length === 0) return 0;
    const v = res[0].values[0][0];
    return typeof v === 'number' ? v : Number(v);
  }

  getAllMemories(category?: MemoryCategory): Memory[] {
    let query = 'SELECT * FROM memories';
    const params: any[] = [];

    if (category) {
      query += ' WHERE category = ?';
      params.push(category);
    }

    query += ' ORDER BY updated_at DESC';

    const result = this.db.exec(query, params);
    
    if (result.length === 0) {
      return [];
    }

    return result[0].values.map((row: unknown[]) => this.rowToMemory(row, result[0].columns));
  }

  searchMemories(query: string, category?: MemoryCategory): Memory[] {
    let sql = 'SELECT * FROM memories WHERE content LIKE ?';
    const params: any[] = [`%${query}%`];

    if (category) {
      sql += ' AND category = ?';
      params.push(category);
    }

    sql += ' ORDER BY updated_at DESC LIMIT 50';

    const result = this.db.exec(sql, params);
    
    if (result.length === 0) {
      return [];
    }

    return result[0].values.map((row: unknown[]) => this.rowToMemory(row, result[0].columns));
  }

  private rowToMemory(row: unknown[], columns: string[]): Memory {
    const obj: Record<string, any> = {};
    columns.forEach((col, i) => {
      obj[col] = row[i];
    });

    return {
      id: obj.id,
      category: obj.category,
      content: obj.content,
      importance: obj.importance,
      createdAt: obj.created_at,
      updatedAt: obj.updated_at,
      accessedAt: obj.accessed_at,
      accessCount: obj.access_count,
      tags: JSON.parse(obj.tags || '[]'),
      source: obj.source,
      metadata: JSON.parse(obj.metadata || '{}'),
    };
  }

  createSession(session: Session): void {
    this.db.run(
      `INSERT INTO sessions (id, started_at, ended_at, summary, files_changed, decisions_made)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        session.id,
        session.startedAt,
        session.endedAt || null,
        session.summary || null,
        JSON.stringify(session.filesChanged),
        JSON.stringify(session.decisionsMade),
      ]
    );
  }

  getSessions(): Session[] {
    const result = this.db.exec('SELECT * FROM sessions ORDER BY started_at DESC');

    if (result.length === 0) {
      return [];
    }

    return result[0].values.map((row: unknown[]) => this.rowToSession(row, result[0].columns));
  }

  getActiveSession(): Session | null {
    const result = this.db.exec(
      'SELECT * FROM sessions WHERE ended_at IS NULL ORDER BY started_at DESC LIMIT 1'
    );

    if (result.length === 0 || result[0].values.length === 0) {
      return null;
    }

    return this.rowToSession(result[0].values[0], result[0].columns);
  }

  updateSession(
    id: string,
    updates: {
      filesChanged?: string[];
      decisionsMade?: string[];
      summary?: string;
      endedAt?: string;
    }
  ): Session | null {
    const existing = this.getSessions().find(s => s.id === id);
    if (!existing) {
      return null;
    }

    const merged: Session = { ...existing };

    if (updates.filesChanged) {
      const set = new Set([...existing.filesChanged, ...updates.filesChanged]);
      merged.filesChanged = [...set];
    }
    if (updates.decisionsMade) {
      const set = new Set([...existing.decisionsMade, ...updates.decisionsMade]);
      merged.decisionsMade = [...set];
    }
    if (updates.summary !== undefined) {
      merged.summary = updates.summary;
    }
    if (updates.endedAt !== undefined) {
      merged.endedAt = updates.endedAt;
    }

    this.db.run(
      `UPDATE sessions
       SET ended_at = ?, summary = ?, files_changed = ?, decisions_made = ?
       WHERE id = ?`,
      [
        merged.endedAt || null,
        merged.summary || null,
        JSON.stringify(merged.filesChanged),
        JSON.stringify(merged.decisionsMade),
        id,
      ]
    );
    this.save();

    return merged;
  }

  endSession(id: string, summary?: string): Session | null {
    return this.updateSession(id, {
      endedAt: new Date().toISOString(),
      ...(summary !== undefined ? { summary } : {}),
    });
  }

  private rowToSession(row: unknown[], columns: string[]): Session {
    const obj: Record<string, any> = {};
    columns.forEach((col, i) => {
      obj[col] = row[i];
    });

    return {
      id: obj.id,
      startedAt: obj.started_at,
      endedAt: obj.ended_at || undefined,
      summary: obj.summary || undefined,
      filesChanged: JSON.parse(obj.files_changed || '[]'),
      decisionsMade: JSON.parse(obj.decisions_made || '[]'),
    };
  }

  backup(): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(this.backupDir, `coster-${timestamp}.db`);

    const data = this.db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(backupPath, buffer);

    return backupPath;
  }

  save(): void {
    const data = this.db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(this.dbPath, buffer);
  }

  getExpiredMemories(): Memory[] {
    const cfg = loadConfig(this.projectPath()).lifecycle;
    const ttlFor: Partial<Record<MemoryCategory, number>> = {
      recap: cfg.recapTTL,
      investigation: cfg.investigationTTL,
      workaround: cfg.workaroundTTL,
    };
    const now = new Date();
    return this.getAllMemories().filter((memory) => {
      const ttl = ttlFor[memory.category];
      if (!ttl) return false;
      const daysSinceUpdate = Math.floor(
        (now.getTime() - new Date(memory.updatedAt).getTime()) / (1000 * 60 * 60 * 24)
      );
      return daysSinceUpdate > ttl;
    });
  }

  /** Soft-archive: move memories to archived_memories (restorable) and drop their vectors. */
  archiveMemories(ids: string[]): number {
    let count = 0;
    for (const id of ids) {
      const m = this.getMemory(id);
      if (!m) continue;
      this.db.run(
        `INSERT OR REPLACE INTO archived_memories
         (id, category, content, importance, created_at, updated_at, accessed_at, access_count, tags, source, metadata, archived_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          m.id,
          m.category,
          m.content,
          m.importance,
          m.createdAt,
          m.updatedAt,
          m.accessedAt,
          m.accessCount,
          JSON.stringify(m.tags),
          m.source,
          JSON.stringify(m.metadata || {}),
          new Date().toISOString(),
        ]
      );
      this.db.run('DELETE FROM memories WHERE id = ?', [id]);
      this.deleteVector(id);
      count++;
    }
    this.save();
    return count;
  }

  getArchivedMemories(): Memory[] {
    const result = this.db.exec('SELECT * FROM archived_memories ORDER BY archived_at DESC');
    if (result.length === 0) return [];
    return result[0].values.map((row: unknown[]) => this.rowToMemory(row, result[0].columns));
  }

  restoreMemory(id: string): Memory | null {
    const result = this.db.exec('SELECT * FROM archived_memories WHERE id = ?', [id]);
    if (result.length === 0 || result[0].values.length === 0) return null;
    const m = this.rowToMemory(result[0].values[0], result[0].columns);
    this.db.run(
      `INSERT OR REPLACE INTO memories
       (id, category, content, importance, created_at, updated_at, accessed_at, access_count, tags, source, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        m.id,
        m.category,
        m.content,
        m.importance,
        m.createdAt,
        m.updatedAt,
        m.accessedAt,
        m.accessCount,
        JSON.stringify(m.tags),
        m.source,
        JSON.stringify(m.metadata || {}),
      ]
    );
    this.db.run('DELETE FROM archived_memories WHERE id = ?', [id]);
    this.save();
    return this.getMemory(id);
  }

  purgeArchivedMemory(id: string): boolean {
    const result = this.db.exec('SELECT id FROM archived_memories WHERE id = ?', [id]);
    if (result.length === 0 || result[0].values.length === 0) return false;
    this.db.run('DELETE FROM archived_memories WHERE id = ?', [id]);
    this.save();
    return true;
  }

  purgeAllArchived(): number {
    const result = this.db.exec('SELECT COUNT(*) AS n FROM archived_memories');
    const n = result.length ? ((result[0].values[0][0] as number) ?? 0) : 0;
    this.db.run('DELETE FROM archived_memories');
    this.save();
    return n;
  }

  /**
   * Fade `importance` with age using exponential decay from a stable base
   * (`metadata.baseImportance`). Returns the number of memories updated.
   */
  applyDecay(now: Date, halfLifeDays: number, minImportance: number): number {
    const memories = this.getAllMemories();
    let changed = 0;
    for (const m of memories) {
      const base =
        m.metadata && typeof m.metadata.baseImportance === 'number'
          ? (m.metadata.baseImportance as number)
          : m.importance;
      const days = Math.max(
        0,
        (now.getTime() - new Date(m.updatedAt).getTime()) / (1000 * 60 * 60 * 24)
      );
      const factor = Math.pow(0.5, days / halfLifeDays);
      const next = Math.max(minImportance, base * factor);
      if (Math.abs(next - m.importance) > 0.001) {
        this.db.run('UPDATE memories SET importance = ? WHERE id = ?', [next, m.id]);
        changed++;
      }
    }
    if (changed) this.save();
    return changed;
  }

  close(): void {
    this.save();
    this.db.close();
  }
}

