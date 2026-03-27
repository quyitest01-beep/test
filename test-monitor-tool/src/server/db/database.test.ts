import { describe, it, expect, afterEach } from 'vitest';
import { getDatabase, closeDatabase } from './database.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

function createTempDbPath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-monitor-'));
  return path.join(dir, 'test.db');
}

describe('database', () => {
  let dbPath: string;

  afterEach(() => {
    closeDatabase();
    if (dbPath && fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
      fs.rmdirSync(path.dirname(dbPath));
    }
  });

  it('should create database and all tables', () => {
    dbPath = createTempDbPath();
    const db = getDatabase(dbPath);

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as { name: string }[];

    const tableNames = tables.map((t) => t.name);
    expect(tableNames).toContain('test_cases');
    expect(tableNames).toContain('test_runs');
    expect(tableNames).toContain('issue_comments');
  });

  it('should return the same instance on subsequent calls', () => {
    dbPath = createTempDbPath();
    const db1 = getDatabase(dbPath);
    const db2 = getDatabase(dbPath);
    expect(db1).toBe(db2);
  });

  it('should enable WAL journal mode', () => {
    dbPath = createTempDbPath();
    const db = getDatabase(dbPath);
    const result = db.pragma('journal_mode') as { journal_mode: string }[];
    expect(result[0].journal_mode).toBe('wal');
  });

  it('should enable foreign keys', () => {
    dbPath = createTempDbPath();
    const db = getDatabase(dbPath);
    const result = db.pragma('foreign_keys') as { foreign_keys: number }[];
    expect(result[0].foreign_keys).toBe(1);
  });

  it('should enforce foreign key constraints', () => {
    dbPath = createTempDbPath();
    const db = getDatabase(dbPath);

    expect(() => {
      db.prepare(
        `INSERT INTO test_runs (id, test_case_id, status, duration, run_at)
         VALUES ('run-1', 'nonexistent', 'passed', 100, '2024-01-01T00:00:00Z')`
      ).run();
    }).toThrow();
  });

  it('should allow valid inserts into test_cases', () => {
    dbPath = createTempDbPath();
    const db = getDatabase(dbPath);

    db.prepare(
      `INSERT INTO test_cases (id, title, steps, automation_script, spec_file_path, status, created_at, updated_at)
       VALUES ('tc-1', 'Test Case 1', '[]', 'script', '/path/to/spec.ts', 'complete', '2024-01-01', '2024-01-01')`
    ).run();

    const row = db.prepare('SELECT * FROM test_cases WHERE id = ?').get('tc-1') as Record<string, unknown>;
    expect(row.title).toBe('Test Case 1');
    expect(row.status).toBe('complete');
  });

  it('should close and allow re-initialization', () => {
    dbPath = createTempDbPath();
    const db1 = getDatabase(dbPath);
    expect(db1.open).toBe(true);

    closeDatabase();

    const db2 = getDatabase(dbPath);
    expect(db2.open).toBe(true);
    expect(db2).not.toBe(db1);
  });
});
