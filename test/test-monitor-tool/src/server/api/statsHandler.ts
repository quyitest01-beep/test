import type { Request, Response } from 'express';
import { getDatabase } from '../db/database.js';

interface StatsRow {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
}

/**
 * GET /api/stats
 * Returns aggregate statistics: total test cases, and counts by latest run status.
 */
export async function statsHandler(_req: Request, res: Response): Promise<void> {
  try {
    const db = getDatabase();

    const row = db.prepare(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN latest.status = 'passed' THEN 1 ELSE 0 END) AS passed,
        SUM(CASE WHEN latest.status = 'failed' THEN 1 ELSE 0 END) AS failed,
        SUM(CASE WHEN latest.status = 'skipped' THEN 1 ELSE 0 END) AS skipped
      FROM test_cases tc
      LEFT JOIN (
        SELECT test_case_id, status
        FROM test_runs tr1
        WHERE tr1.run_at = (
          SELECT MAX(tr2.run_at) FROM test_runs tr2 WHERE tr2.test_case_id = tr1.test_case_id
        )
      ) latest ON tc.id = latest.test_case_id
    `).get() as StatsRow;

    res.json({
      total: row.total,
      passed: row.passed,
      failed: row.failed,
      skipped: row.skipped,
    });
  } catch (err) {
    console.error('[statsHandler] GET /api/stats error:', err);
    res.status(500).json({ error: 'Failed to get stats' });
  }
}
