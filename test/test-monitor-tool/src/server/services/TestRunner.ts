import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { getDatabase } from '../db/database.js';
import type { AppConfig } from '../types/index.js';
import type { TestRunResult, TestRunSummary, RunningStatus } from '../types/index.js';

/** Callback type for real-time progress events (Socket.IO integration later) */
export type ProgressCallback = (status: RunningStatus) => void;
export type CompleteCallback = (summary: TestRunSummary) => void;
export type StepCallback = (step: { testCaseId: string; message: string; status: 'running' | 'passed' | 'failed' }) => void;

interface PlaywrightJsonResult {
  suites?: PlaywrightSuite[];
  stats?: {
    duration?: number;
  };
}

interface PlaywrightSuite {
  title?: string;
  file?: string;
  suites?: PlaywrightSuite[];
  specs?: PlaywrightSpec[];
}

interface PlaywrightSpec {
  title?: string;
  tests?: PlaywrightTest[];
}

interface PlaywrightTest {
  status?: string;
  results?: PlaywrightTestResult[];
}

interface PlaywrightTestResult {
  status?: string;
  duration?: number;
  error?: { message?: string; stack?: string };
  attachments?: PlaywrightAttachment[];
  stdout?: string[];
  stderr?: string[];
}

interface PlaywrightAttachment {
  name?: string;
  path?: string;
  contentType?: string;
}

export class TestRunner {
  private runningStatus: RunningStatus | null = null;
  private currentProcess: ChildProcess | null = null;
  private onProgress: ProgressCallback | null = null;
  private onComplete: CompleteCallback | null = null;
  private onStep: StepCallback | null = null;
  private currentTestCaseId: string = '';

  /** Register a callback for real-time progress updates */
  setProgressCallback(cb: ProgressCallback): void {
    this.onProgress = cb;
  }

  /** Register a callback for test completion */
  setCompleteCallback(cb: CompleteCallback): void {
    this.onComplete = cb;
  }

  /** Register a callback for step-level updates */
  setStepCallback(cb: StepCallback): void {
    this.onStep = cb;
  }

  /** Run a single test case by ID */
  async runSingle(testCaseId: string): Promise<TestRunResult> {
    const db = getDatabase();
    const row = db.prepare('SELECT spec_file_path, source_path FROM test_cases WHERE id = ?').get(testCaseId) as
      | { spec_file_path: string; source_path: string | null }
      | undefined;

    if (!row) {
      throw new Error(`Test case not found: ${testCaseId}`);
    }

    // Use source_path (original file) for running, derive project root from its parent
    const testFile = row.source_path || row.spec_file_path;
    const projectRoot = this.findProjectRoot(testFile);
    this.currentTestCaseId = testCaseId;

    // Emit "running" step
    if (this.onStep) {
      this.onStep({ testCaseId, message: '测试开始执行...', status: 'running' });
    }

    this.updateRunningStatus({
      isRunning: true,
      currentTestCase: testCaseId,
      progress: 0,
      total: 1,
      completed: 0,
    });

    try {
      const { stdout, stderr, exitCode } = await this.execPlaywright([testFile], projectRoot);
      const results = this.parseJsonReport(stdout, [testCaseId]);

      const result: TestRunResult = results.length > 0
        ? results[0]
        : this.buildResultFromExit(testCaseId, exitCode, stderr, stdout);

      this.saveTestRun(result);

      this.updateRunningStatus({
        isRunning: false,
        currentTestCase: '',
        progress: 100,
        total: 1,
        completed: 1,
      });

      return result;
    } catch (err) {
      const errorResult: TestRunResult = {
        testCaseId,
        status: 'failed',
        duration: 0,
        errorMessage: err instanceof Error ? err.message : String(err),
        logs: '',
      };
      this.saveTestRun(errorResult);
      this.clearRunningStatus();
      return errorResult;
    }
  }

  /** Run all test cases in a directory */
  async runByDirectory(dirPath: string): Promise<TestRunSummary> {
    const db = getDatabase();
    const rows = db.prepare(
      'SELECT id, source_path, spec_file_path FROM test_cases WHERE spec_file_path LIKE ? OR source_path LIKE ?'
    ).all(`${dirPath}%`, `${dirPath}%`) as Array<{ id: string; source_path: string | null; spec_file_path: string }>;

    if (rows.length === 0) {
      return this.emptySummary();
    }

    const specFiles = rows.map((r) => r.source_path || r.spec_file_path);
    const testCaseIds = rows.map((r) => r.id);
    const projectRoot = this.findProjectRoot(specFiles[0]);

    return this.runTests(specFiles, testCaseIds, projectRoot);
  }

  /** Run all test cases */
  async runAll(): Promise<TestRunSummary> {
    const db = getDatabase();
    const rows = db.prepare('SELECT id, source_path, spec_file_path FROM test_cases').all() as Array<{
      id: string;
      source_path: string | null;
      spec_file_path: string;
    }>;

    if (rows.length === 0) {
      return this.emptySummary();
    }

    const specFiles = rows.map((r) => r.source_path || r.spec_file_path);
    const testCaseIds = rows.map((r) => r.id);
    const projectRoot = this.findProjectRoot(specFiles[0]);

    return this.runTests(specFiles, testCaseIds, projectRoot);
  }

  /** Get the current running status, or null if not running */
  getRunningStatus(): RunningStatus | null {
    return this.runningStatus ? { ...this.runningStatus } : null;
  }

  /** Core method: run a batch of tests and collect results */
  private async runTests(
    specFiles: string[],
    testCaseIds: string[],
    projectRoot: string
  ): Promise<TestRunSummary> {
    const total = testCaseIds.length;

    this.updateRunningStatus({
      isRunning: true,
      currentTestCase: testCaseIds[0] ?? '',
      progress: 0,
      total,
      completed: 0,
    });

    const startTime = Date.now();

    try {
      const { stdout, stderr, exitCode } = await this.execPlaywright(specFiles, projectRoot);
      const results = this.parseJsonReport(stdout, testCaseIds);

      // If parsing returned fewer results than expected, fill in missing ones
      const resultMap = new Map(results.map((r) => [r.testCaseId, r]));
      const allResults: TestRunResult[] = testCaseIds.map((id, idx) => {
        const existing = resultMap.get(id);
        if (existing) return existing;
        return this.buildResultFromExit(id, exitCode, stderr, stdout);
      });

      // Save all results to DB
      for (const result of allResults) {
        this.saveTestRun(result);
      }

      const summary = this.buildSummary(allResults, Date.now() - startTime);

      this.updateRunningStatus({
        isRunning: false,
        currentTestCase: '',
        progress: 100,
        total,
        completed: total,
      });

      if (this.onComplete) {
        this.onComplete(summary);
      }

      return summary;
    } catch (err) {
      this.clearRunningStatus();
      // Return a summary with all tests marked as failed
      const failedResults: TestRunResult[] = testCaseIds.map((id) => ({
        testCaseId: id,
        status: 'failed' as const,
        duration: 0,
        errorMessage: err instanceof Error ? err.message : String(err),
        logs: '',
      }));

      for (const result of failedResults) {
        this.saveTestRun(result);
      }

      return this.buildSummary(failedResults, Date.now() - startTime);
    }
  }

  /** Spawn `npx playwright test` and collect stdout/stderr */
  private execPlaywright(specFiles: string[], projectRoot: string): Promise<{
    stdout: string;
    stderr: string;
    exitCode: number;
  }> {
    return new Promise((resolve, reject) => {
      // Convert absolute paths to relative paths from projectRoot so Playwright can find them
      // Use forward slashes for cross-platform compatibility (Playwright uses them as regex patterns)
      const relativeFiles = specFiles.map((f) => {
        const resolved = path.resolve(f);
        return path.relative(projectRoot, resolved).replace(/\\/g, '/');
      });

      const args = [
        'playwright',
        'test',
        '--headed',
        '--project=chromium',
        '--workers=1',
        '--reporter=json,line',
        '--screenshot=on',
        ...relativeFiles,
      ];

      const child = spawn('npx', args, {
        cwd: projectRoot,
        shell: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      this.currentProcess = child;

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data: Buffer) => {
        const text = data.toString();
        stderr += text;
        // Parse line reporter output for step updates
        if (this.onStep && this.currentTestCaseId) {
          for (const line of text.split('\n')) {
            const trimmed = line.trim().replace(/\u001b\[\d+m/g, '');
            if (!trimmed) continue;
            // Line reporter outputs lines like: "  ✓  1 [chromium] › e2e/test.spec.ts:3:5 › test name (30s)"
            // or running: "  ◌  1 [chromium] › ..."
            if (trimmed.includes('›') || trimmed.includes('✓') || trimmed.includes('✘') || trimmed.includes('◌')) {
              const status = trimmed.includes('✓') ? 'passed' as const
                : trimmed.includes('✘') || trimmed.includes('×') ? 'failed' as const
                : 'running' as const;
              this.onStep({ testCaseId: this.currentTestCaseId, message: trimmed, status });
            }
          }
        }
      });

      child.on('error', (err) => {
        this.currentProcess = null;
        reject(err);
      });

      child.on('close', (code) => {
        this.currentProcess = null;
        resolve({
          stdout,
          stderr,
          exitCode: code ?? 1,
        });
      });
    });
  }

  /** Parse Playwright JSON reporter output into TestRunResult[] */
  private parseJsonReport(stdout: string, testCaseIds: string[]): TestRunResult[] {
    const results: TestRunResult[] = [];

    let report: PlaywrightJsonResult;
    try {
      report = JSON.parse(stdout) as PlaywrightJsonResult;
    } catch {
      // JSON parsing failed — stdout may not be valid JSON
      return results;
    }

    const specs = this.flattenSpecs(report.suites ?? []);
    const idQueue = [...testCaseIds];

    for (const spec of specs) {
      const testCaseId = idQueue.shift();
      if (!testCaseId) break;

      for (const test of spec.tests ?? []) {
        const lastResult = test.results?.[test.results.length - 1];
        const status = this.mapStatus(lastResult?.status ?? test.status ?? 'skipped');
        const duration = lastResult?.duration ?? 0;

        const errorMessage =
          status === 'failed'
            ? lastResult?.error?.message ?? lastResult?.error?.stack ?? ''
            : undefined;

        const screenshot = this.extractScreenshot(lastResult?.attachments);

        const logs = [
          ...(lastResult?.stdout ?? []),
          ...(lastResult?.stderr ?? []),
        ].join('\n');

        results.push({
          testCaseId,
          status,
          duration,
          errorMessage: errorMessage || undefined,
          screenshot,
          logs: status === 'failed' ? (logs || 'Test execution failed') : logs,
        });
      }
    }

    return results;
  }

  /** Recursively flatten suites into a flat list of specs */
  private flattenSpecs(suites: PlaywrightSuite[]): PlaywrightSpec[] {
    const specs: PlaywrightSpec[] = [];
    for (const suite of suites) {
      if (suite.specs) {
        specs.push(...suite.specs);
      }
      if (suite.suites) {
        specs.push(...this.flattenSpecs(suite.suites));
      }
    }
    return specs;
  }

  /** Map Playwright status strings to our status type */
  private mapStatus(status: string): 'passed' | 'failed' | 'skipped' {
    switch (status) {
      case 'passed':
      case 'expected':
        return 'passed';
      case 'failed':
      case 'unexpected':
      case 'timedOut':
        return 'failed';
      default:
        return 'skipped';
    }
  }

  /** Extract screenshot path from Playwright attachments */
  private extractScreenshot(
    attachments?: PlaywrightAttachment[]
  ): string | undefined {
    if (!attachments) return undefined;
    const screenshot = attachments.find(
      (a) => a.name === 'screenshot' || a.contentType?.startsWith('image/')
    );
    return screenshot?.path;
  }

  /** Build a fallback result when JSON parsing fails */
  private buildResultFromExit(
    testCaseId: string,
    exitCode: number,
    stderr: string,
    stdout: string
  ): TestRunResult {
    const status: TestRunResult['status'] = exitCode === 0 ? 'passed' : 'failed';
    return {
      testCaseId,
      status,
      duration: 0,
      errorMessage: status === 'failed' ? (stderr || 'Test execution failed') : undefined,
      logs: status === 'failed' ? (stdout + '\n' + stderr).trim() || 'Test execution failed' : stdout,
    };
  }

  /** Save a test run result to the database */
  private saveTestRun(result: TestRunResult): void {
    try {
      const db = getDatabase();
      db.prepare(`
        INSERT INTO test_runs (id, test_case_id, status, duration, error_message, screenshot_path, logs, run_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        randomUUID(),
        result.testCaseId,
        result.status,
        result.duration,
        result.errorMessage ?? null,
        result.screenshot ?? null,
        result.logs,
        new Date().toISOString(),
      );
    } catch (err) {
      console.error(`[TestRunner] Failed to save test run for ${result.testCaseId}:`, err);
    }
  }

  /** Build a TestRunSummary from results */
  private buildSummary(results: TestRunResult[], totalDuration: number): TestRunSummary {
    return {
      totalCount: results.length,
      passedCount: results.filter((r) => r.status === 'passed').length,
      failedCount: results.filter((r) => r.status === 'failed').length,
      skippedCount: results.filter((r) => r.status === 'skipped').length,
      totalDuration,
      results,
    };
  }

  /** Return an empty summary */
  private emptySummary(): TestRunSummary {
    return {
      totalCount: 0,
      passedCount: 0,
      failedCount: 0,
      skippedCount: 0,
      totalDuration: 0,
      results: [],
    };
  }

  /** Update running status and emit progress */
  private updateRunningStatus(status: RunningStatus): void {
    this.runningStatus = status;
    if (this.onProgress) {
      this.onProgress({ ...status });
    }
  }

  /** Clear running status */
  private clearRunningStatus(): void {
    this.runningStatus = null;
  }

  /**
   * Find the project root by walking up from a file path looking for package.json.
   * Falls back to the file's parent directory.
   */
  private findProjectRoot(filePath: string): string {
      let dir = path.dirname(path.resolve(filePath));
      const root = path.parse(dir).root;

      while (dir !== root) {
        if (fs.existsSync(path.join(dir, 'package.json'))) {
          return dir;
        }
        dir = path.dirname(dir);
      }

      return path.dirname(path.resolve(filePath));
    }

}
