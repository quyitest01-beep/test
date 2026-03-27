import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestCaseManager } from './TestCaseManager.js';
import { getDatabase, closeDatabase } from '../db/database.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { TestCase } from '../types/index.js';

function createTempDbPath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tcm-test-'));
  return path.join(dir, 'test.db');
}

function makeTestCase(overrides: Partial<TestCase> = {}): TestCase {
  const now = new Date();
  return {
    id: 'tc-001',
    title: 'Login test',
    issueLink: 'https://github.com/owner/myrepo/issues/42',
    preconditions: 'User exists in the system',
    steps: [{ order: 1, action: 'Navigate to /login', expected: 'Login page loads' }],
    expectedResults: 'User is logged in',
    automationScript: 'test("login", async ({ page }) => { await page.goto("/login"); });',
    status: 'complete',
    missingFields: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('TestCaseManager', () => {
  let manager: TestCaseManager;
  let dbPath: string;
  let dbDir: string;

  beforeEach(() => {
    dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tcm-test-'));
    dbPath = path.join(dbDir, 'test.db');
    getDatabase(dbPath);
    manager = new TestCaseManager();
  });

  afterEach(() => {
    closeDatabase();
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
    // Clean up WAL files
    const walPath = dbPath + '-wal';
    const shmPath = dbPath + '-shm';
    if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
    if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);
    if (fs.existsSync(dbDir)) fs.rmSync(dbDir, { recursive: true });
  });

  describe('save()', () => {
    it('should save a test case and return its ID', async () => {
      const tc = makeTestCase();
      const id = await manager.save(tc);
      expect(id).toBe('tc-001');
    });

    it('should persist test case data to the database', async () => {
      const tc = makeTestCase();
      await manager.save(tc);

      const db = getDatabase();
      const row = db.prepare('SELECT * FROM test_cases WHERE id = ?').get('tc-001') as Record<string, unknown>;
      expect(row.title).toBe('Login test');
      expect(row.issue_link).toBe('https://github.com/owner/myrepo/issues/42');
      expect(row.status).toBe('complete');
    });

    it('should derive module from issue link', async () => {
      const tc = makeTestCase();
      await manager.save(tc);

      const db = getDatabase();
      const row = db.prepare('SELECT module FROM test_cases WHERE id = ?').get('tc-001') as { module: string };
      expect(row.module).toBe('myrepo');
    });

    it('should use uncategorized module when no issue link', async () => {
      const tc = makeTestCase({ issueLink: null });
      await manager.save(tc);

      const db = getDatabase();
      const row = db.prepare('SELECT module FROM test_cases WHERE id = ?').get('tc-001') as { module: string };
      expect(row.module).toBe('uncategorized');
    });
  });

  describe('get()', () => {
    it('should retrieve a saved test case by ID', async () => {
      const tc = makeTestCase();
      await manager.save(tc);

      const result = await manager.get('tc-001');
      expect(result).not.toBeNull();
      expect(result!.id).toBe('tc-001');
      expect(result!.title).toBe('Login test');
      expect(result!.steps).toEqual([{ order: 1, action: 'Navigate to /login', expected: 'Login page loads' }]);
      expect(result!.status).toBe('complete');
    });

    it('should return null for non-existent ID', async () => {
      const result = await manager.get('nonexistent');
      expect(result).toBeNull();
    });

    it('should correctly deserialize dates', async () => {
      const tc = makeTestCase();
      await manager.save(tc);

      const result = await manager.get('tc-001');
      expect(result!.createdAt).toBeInstanceOf(Date);
      expect(result!.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe('update()', () => {
    it('should update specific fields', async () => {
      const tc = makeTestCase();
      await manager.save(tc);

      await manager.update('tc-001', { title: 'Updated title', status: 'pending_publish' });

      const result = await manager.get('tc-001');
      expect(result!.title).toBe('Updated title');
      expect(result!.status).toBe('pending_publish');
    });

    it('should update the updatedAt timestamp', async () => {
      const tc = makeTestCase({ updatedAt: new Date('2024-01-01') });
      await manager.save(tc);

      await manager.update('tc-001', { title: 'New title' });

      const result = await manager.get('tc-001');
      expect(result!.updatedAt.getTime()).toBeGreaterThan(new Date('2024-01-01').getTime());
    });

    it('should do nothing when no updates provided', async () => {
      const tc = makeTestCase();
      await manager.save(tc);

      await manager.update('tc-001', {});

      const result = await manager.get('tc-001');
      expect(result!.title).toBe('Login test');
    });
  });

  describe('list()', () => {
    it('should return an empty tree when no test cases exist', async () => {
      const tree = await manager.list();
      expect(tree.name).toBe('root');
      expect(tree.children).toEqual([]);
    });

    it('should organize test cases by module', async () => {
      await manager.save(makeTestCase({ id: 'tc-1', issueLink: 'https://github.com/o/auth-module/issues/1' }));
      await manager.save(makeTestCase({ id: 'tc-2', issueLink: 'https://github.com/o/api-module/issues/2' }));

      const tree = await manager.list();
      expect(tree.children.length).toBe(2);

      const moduleNames = tree.children.map((c) => (c as { name: string }).name);
      expect(moduleNames).toContain('auth-module');
      expect(moduleNames).toContain('api-module');
    });

    it('should filter by name', async () => {
      await manager.save(makeTestCase({ id: 'tc-1', title: 'Login test' }));
      await manager.save(makeTestCase({ id: 'tc-2', title: 'Signup test' }));

      const tree = await manager.list({ name: 'Login' });
      const allLeaves = flattenLeaves(tree);
      expect(allLeaves.length).toBe(1);
      expect(allLeaves[0].name).toBe('Login test');
    });

    it('should filter by status', async () => {
      await manager.save(makeTestCase({ id: 'tc-1', status: 'complete' }));
      await manager.save(makeTestCase({ id: 'tc-2', status: 'pending_info' }));

      const tree = await manager.list({ status: 'pending_info' });
      const allLeaves = flattenLeaves(tree);
      expect(allLeaves.length).toBe(1);
    });

    it('should filter by issueLink', async () => {
      await manager.save(makeTestCase({ id: 'tc-1', issueLink: 'https://github.com/o/r/issues/1' }));
      await manager.save(makeTestCase({ id: 'tc-2', issueLink: 'https://github.com/o/r/issues/2' }));

      const tree = await manager.list({ issueLink: 'issues/1' });
      const allLeaves = flattenLeaves(tree);
      expect(allLeaves.length).toBe(1);
    });
  });

  describe('getMetadata()', () => {
    it('should return metadata with not_run status when no runs exist', async () => {
      await manager.save(makeTestCase());

      const meta = await manager.getMetadata('tc-001');
      expect(meta.id).toBe('tc-001');
      expect(meta.runStatus).toBe('not_run');
      expect(meta.lastRunAt).toBeNull();
      expect(meta.createdAt).toBeInstanceOf(Date);
      expect(meta.updatedAt).toBeInstanceOf(Date);
      expect(meta.issueLink).toBe('https://github.com/owner/myrepo/issues/42');
    });

    it('should return latest run status from test_runs', async () => {
      await manager.save(makeTestCase());

      const db = getDatabase();
      db.prepare(
        `INSERT INTO test_runs (id, test_case_id, status, duration, run_at)
         VALUES ('run-1', 'tc-001', 'passed', 500, '2024-06-01T10:00:00Z')`
      ).run();
      db.prepare(
        `INSERT INTO test_runs (id, test_case_id, status, duration, run_at)
         VALUES ('run-2', 'tc-001', 'failed', 300, '2024-06-02T10:00:00Z')`
      ).run();

      const meta = await manager.getMetadata('tc-001');
      expect(meta.runStatus).toBe('failed');
      expect(meta.lastRunAt).toEqual(new Date('2024-06-02T10:00:00Z'));
    });

    it('should throw for non-existent test case', async () => {
      await expect(manager.getMetadata('nonexistent')).rejects.toThrow('Test case not found');
    });
  });
});

/** Helper to flatten all leaves from a tree */
function flattenLeaves(tree: { children: unknown[] }): { id: string; name: string }[] {
  const leaves: { id: string; name: string }[] = [];
  for (const child of tree.children) {
    if ('children' in (child as Record<string, unknown>)) {
      leaves.push(...flattenLeaves(child as { children: unknown[] }));
    } else {
      leaves.push(child as { id: string; name: string });
    }
  }
  return leaves;
}
