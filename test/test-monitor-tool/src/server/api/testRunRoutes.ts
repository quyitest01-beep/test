import { Router } from 'express';
import { getServices } from './serviceContainer.js';
import { getDatabase } from '../db/database.js';

const router = Router();

/**
 * POST /api/test-run/single/:id
 * Run a single test case by ID
 */
router.post('/single/:id', async (req, res) => {
  try {
    const { testRunner } = getServices();
    const result = await testRunner.runSingle(req.params.id);
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[testRunRoutes] POST /api/test-run/single/${req.params.id} error:`, err);
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/test-run/directory
 * Run all test cases in a directory. Body: { dirPath: string }
 */
router.post('/directory', async (req, res) => {
  try {
    const { testRunner } = getServices();
    const { dirPath } = req.body as { dirPath?: string };

    if (!dirPath || typeof dirPath !== 'string') {
      res.status(400).json({ error: 'dirPath is required and must be a string' });
      return;
    }

    const summary = await testRunner.runByDirectory(dirPath);
    res.json(summary);
  } catch (err) {
    console.error('[testRunRoutes] POST /api/test-run/directory error:', err);
    res.status(500).json({ error: 'Failed to run tests by directory' });
  }
});

/**
 * POST /api/test-run/all
 * Run all test cases
 */
router.post('/all', async (req, res) => {
  try {
    const { testRunner } = getServices();
    const summary = await testRunner.runAll();
    res.json(summary);
  } catch (err) {
    console.error('[testRunRoutes] POST /api/test-run/all error:', err);
    res.status(500).json({ error: 'Failed to run all tests' });
  }
});


/**
 * GET /api/test-run/status
 * Get the current running status
 */
router.get('/status', (_req, res) => {
  try {
    const { testRunner } = getServices();
    const status = testRunner.getRunningStatus();
    res.json(status ?? { isRunning: false });
  } catch (err) {
    console.error('[testRunRoutes] GET /api/test-run/status error:', err);
    res.status(500).json({ error: 'Failed to get running status' });
  }
});

interface TestRunRow {
  id: string;
  test_case_id: string;
  status: string;
  duration: number;
  error_message: string | null;
  screenshot_path: string | null;
  logs: string | null;
  run_at: string;
}

/**
 * GET /api/test-run/history
 * Get test run history, ordered by most recent first. Supports optional query params:
 *   - testCaseId: filter by test case
 *   - limit: max number of results (default 50)
 */
router.get('/history', (req, res) => {
  try {
    const db = getDatabase();
    const testCaseId = typeof req.query.testCaseId === 'string' ? req.query.testCaseId : undefined;
    const limit = Math.min(Number(req.query.limit) || 50, 200);

    let query = 'SELECT * FROM test_runs';
    const params: unknown[] = [];

    if (testCaseId) {
      query += ' WHERE test_case_id = ?';
      params.push(testCaseId);
    }

    query += ' ORDER BY run_at DESC LIMIT ?';
    params.push(limit);

    const rows = db.prepare(query).all(...params) as TestRunRow[];

    const history = rows.map((row) => {
      // Parse screenshots JSON if stored as array, otherwise keep as single path
      let screenshot: string | null = row.screenshot_path;
      let screenshots: Array<{ step: number; path: string }> | undefined;
      if (row.screenshot_path && row.screenshot_path.startsWith('[')) {
        try {
          screenshots = JSON.parse(row.screenshot_path);
          screenshot = null;
        } catch { /* keep as string */ }
      }
      return {
        id: row.id,
        testCaseId: row.test_case_id,
        status: row.status,
        duration: row.duration,
        errorMessage: row.error_message,
        screenshot,
        screenshots,
        logs: row.logs,
        runAt: row.run_at,
      };
    });

    res.json(history);
  } catch (err) {
    console.error('[testRunRoutes] GET /api/test-run/history error:', err);
    res.status(500).json({ error: 'Failed to get run history' });
  }
});

export default router;
