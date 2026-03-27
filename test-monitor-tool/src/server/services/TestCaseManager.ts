import fs from 'node:fs';
import path from 'node:path';
import { getDatabase } from '../db/database.js';
import type {
  TestCase,
  TestCaseFilter,
  TestCaseLeaf,
  TestCaseMetadata,
  TestCaseTree,
  TestStep,
} from '../types/index.js';

interface TestCaseRow {
  id: string;
  title: string;
  issue_link: string | null;
  preconditions: string | null;
  steps: string;
  expected_results: string | null;
  automation_script: string;
  spec_file_path: string;
  module: string | null;
  status: string;
  missing_fields: string | null;
  created_at: string;
  updated_at: string;
}

interface LatestRunRow {
  status: string;
  run_at: string;
}

export class TestCaseManager {
  /**
   * Save a test case to the database.
   * Auto-creates the module directory if it doesn't exist.
   * Returns the test case ID.
   */
  async save(testCase: TestCase, sourcePath?: string): Promise<string> {
    const db = getDatabase();
    const module = this.deriveModule(testCase);
    const specFilePath = this.buildSpecFilePath(module, testCase.id);

    // Auto-create directory structure
    this.ensureDirectoryExists(specFilePath);

    const stmt = db.prepare(`
      INSERT INTO test_cases (id, title, issue_link, preconditions, steps, expected_results,
        automation_script, spec_file_path, source_path, module, status, missing_fields, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      testCase.id,
      testCase.title,
      testCase.issueLink,
      testCase.preconditions,
      JSON.stringify(testCase.steps),
      testCase.expectedResults,
      testCase.automationScript,
      specFilePath,
      sourcePath ?? null,
      module,
      testCase.status,
      JSON.stringify(testCase.missingFields),
      testCase.createdAt.toISOString(),
      testCase.updatedAt.toISOString(),
    );

    return testCase.id;
  }

  /**
   * List test cases as a tree structure organized by module.
   * Supports filtering by name, issueLink, status, and module.
   */
  async list(filter?: TestCaseFilter): Promise<TestCaseTree> {
    const db = getDatabase();

    let query = `
      SELECT tc.*, tr.status AS run_status, tr.run_at AS last_run_at
      FROM test_cases tc
      LEFT JOIN (
        SELECT test_case_id, status, run_at
        FROM test_runs
        WHERE id IN (
          SELECT id FROM test_runs t2
          WHERE t2.test_case_id = test_runs.test_case_id
          ORDER BY t2.run_at DESC
          LIMIT 1
        )
      ) tr ON tc.id = tr.test_case_id
    `;

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filter?.name) {
      conditions.push('tc.title LIKE ?');
      params.push(`%${filter.name}%`);
    }
    if (filter?.issueLink) {
      conditions.push('tc.issue_link LIKE ?');
      params.push(`%${filter.issueLink}%`);
    }
    if (filter?.status) {
      conditions.push('tc.status = ?');
      params.push(filter.status);
    }
    if (filter?.module) {
      conditions.push('tc.module = ?');
      params.push(filter.module);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY tc.module, tc.title';

    const rows = db.prepare(query).all(...params) as (TestCaseRow & { run_status: string | null; last_run_at: string | null })[];

    return this.buildTree(rows);
  }

  /**
   * Get a single test case by ID.
   */
  async get(id: string): Promise<TestCase | null> {
    const db = getDatabase();
    const row = db.prepare('SELECT * FROM test_cases WHERE id = ?').get(id) as TestCaseRow | undefined;

    if (!row) return null;

    return this.rowToTestCase(row);
  }

  /**
   * Update specific fields of a test case.
   */
  async update(id: string, updates: Partial<TestCase>): Promise<void> {
    const db = getDatabase();

    const setClauses: string[] = [];
    const params: unknown[] = [];

    if (updates.title !== undefined) {
      setClauses.push('title = ?');
      params.push(updates.title);
    }
    if (updates.issueLink !== undefined) {
      setClauses.push('issue_link = ?');
      params.push(updates.issueLink);
    }
    if (updates.preconditions !== undefined) {
      setClauses.push('preconditions = ?');
      params.push(updates.preconditions);
    }
    if (updates.steps !== undefined) {
      setClauses.push('steps = ?');
      params.push(JSON.stringify(updates.steps));
    }
    if (updates.expectedResults !== undefined) {
      setClauses.push('expected_results = ?');
      params.push(updates.expectedResults);
    }
    if (updates.automationScript !== undefined) {
      setClauses.push('automation_script = ?');
      params.push(updates.automationScript);
    }
    if (updates.status !== undefined) {
      setClauses.push('status = ?');
      params.push(updates.status);
    }
    if (updates.missingFields !== undefined) {
      setClauses.push('missing_fields = ?');
      params.push(JSON.stringify(updates.missingFields));
    }

    if (setClauses.length === 0) return;

    // Always update the updated_at timestamp
    setClauses.push('updated_at = ?');
    params.push(new Date().toISOString());

    params.push(id);

    db.prepare(`UPDATE test_cases SET ${setClauses.join(', ')} WHERE id = ?`).run(...params);

    // If automationScript was updated, sync back to source file
    if (updates.automationScript !== undefined) {
      const row = db.prepare('SELECT source_path, spec_file_path FROM test_cases WHERE id = ?').get(id) as
        | { source_path: string | null; spec_file_path: string }
        | undefined;

      if (row) {
        const filePath = row.source_path || row.spec_file_path;
        try {
          const resolvedPath = path.resolve(filePath);
          this.ensureDirectoryExists(resolvedPath);
          fs.writeFileSync(resolvedPath, updates.automationScript, 'utf-8');
        } catch (err) {
          console.error(`[TestCaseManager] Failed to write back to ${filePath}:`, err);
        }
      }
    }
  }

  /**
   * Get metadata for a test case, including latest run status from test_runs table.
   */
  async getMetadata(id: string): Promise<TestCaseMetadata> {
    const db = getDatabase();

    const row = db.prepare('SELECT id, created_at, updated_at, issue_link FROM test_cases WHERE id = ?')
      .get(id) as Pick<TestCaseRow, 'id' | 'created_at' | 'updated_at' | 'issue_link'> | undefined;

    if (!row) {
      throw new Error(`Test case not found: ${id}`);
    }

    const latestRun = db.prepare(
      'SELECT status, run_at FROM test_runs WHERE test_case_id = ? ORDER BY run_at DESC LIMIT 1'
    ).get(id) as LatestRunRow | undefined;

    return {
      id: row.id,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      issueLink: row.issue_link,
      runStatus: (latestRun?.status as TestCaseMetadata['runStatus']) ?? 'not_run',
      lastRunAt: latestRun ? new Date(latestRun.run_at) : null,
    };
  }

  /**
   * Derive the module name from a test case.
   * Uses issue labels via the issueLink pattern, or falls back to 'uncategorized'.
   */
  private deriveModule(testCase: TestCase): string {
    if (testCase.issueLink) {
      // Extract a module hint from the issue link path segments
      // e.g., https://github.com/owner/repo/issues/123 -> repo
      const parts = testCase.issueLink.split('/');
      const issuesIdx = parts.indexOf('issues');
      if (issuesIdx > 1) {
        return parts[issuesIdx - 1];
      }
    }
    return 'uncategorized';
  }

  /**
   * Build the spec file path based on module and test case ID.
   */
  private buildSpecFilePath(module: string, testCaseId: string): string {
    return path.join('tests', 'cases', module, `${testCaseId}.spec.ts`);
  }

  /**
   * Ensure the directory for a file path exists, creating it if necessary.
   */
  private ensureDirectoryExists(filePath: string): void {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Convert a database row to a TestCase object.
   */
  private rowToTestCase(row: TestCaseRow): TestCase {
    return {
      id: row.id,
      title: row.title,
      issueLink: row.issue_link,
      preconditions: row.preconditions ?? '',
      steps: JSON.parse(row.steps) as TestStep[],
      expectedResults: row.expected_results ?? '',
      automationScript: row.automation_script,
      status: row.status as TestCase['status'],
      missingFields: row.missing_fields ? JSON.parse(row.missing_fields) as string[] : [],
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  /**
   * Build a tree structure from flat test case rows, organized by module.
   */
  private buildTree(
    rows: (TestCaseRow & { run_status: string | null; last_run_at: string | null })[]
  ): TestCaseTree {
    const root: TestCaseTree = { name: 'root', path: '/', children: [] };
    const moduleMap = new Map<string, TestCaseTree>();

    for (const row of rows) {
      const module = row.module || 'uncategorized';

      if (!moduleMap.has(module)) {
        const moduleNode: TestCaseTree = {
          name: module,
          path: `/${module}`,
          children: [],
        };
        moduleMap.set(module, moduleNode);
        root.children.push(moduleNode);
      }

      const leaf: TestCaseLeaf = {
        id: row.id,
        name: row.title,
        status: row.run_status ?? row.status,
        issueLink: row.issue_link,
        lastRunAt: row.last_run_at ? new Date(row.last_run_at) : null,
      };

      moduleMap.get(module)!.children.push(leaf);
    }

    return root;
  }
}
