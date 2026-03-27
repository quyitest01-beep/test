import type Database from 'better-sqlite3';

export function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS test_cases (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      issue_link TEXT,
      preconditions TEXT,
      steps TEXT NOT NULL,
      expected_results TEXT,
      automation_script TEXT NOT NULL,
      spec_file_path TEXT NOT NULL,
      source_path TEXT,
      module TEXT,
      status TEXT NOT NULL DEFAULT 'complete',
      missing_fields TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS test_runs (
      id TEXT PRIMARY KEY,
      test_case_id TEXT NOT NULL,
      status TEXT NOT NULL,
      duration INTEGER NOT NULL,
      error_message TEXT,
      screenshot_path TEXT,
      logs TEXT,
      run_at TEXT NOT NULL,
      FOREIGN KEY (test_case_id) REFERENCES test_cases(id)
    );

    CREATE TABLE IF NOT EXISTS issue_comments (
      id TEXT PRIMARY KEY,
      test_case_id TEXT NOT NULL,
      issue_link TEXT NOT NULL,
      comment_id TEXT NOT NULL,
      published_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (test_case_id) REFERENCES test_cases(id)
    );
  `);
}
