import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { getServices } from './serviceContainer.js';
import { getDatabase } from '../db/database.js';
import type { TestCaseFilter } from '../types/index.js';

const router = Router();

/**
 * GET /api/test-cases
 * List test cases with optional filtering via query params: name, issueLink, status, module
 */
router.get('/', async (req, res) => {
  try {
    const { testCaseManager } = getServices();
    const filter: TestCaseFilter = {};

    if (typeof req.query.name === 'string') filter.name = req.query.name;
    if (typeof req.query.issueLink === 'string') filter.issueLink = req.query.issueLink;
    if (typeof req.query.status === 'string') filter.status = req.query.status;
    if (typeof req.query.module === 'string') filter.module = req.query.module;

    const tree = await testCaseManager.list(
      Object.keys(filter).length > 0 ? filter : undefined,
    );
    res.json(tree);
  } catch (err) {
    console.error('[testCaseRoutes] GET /api/test-cases error:', err);
    res.status(500).json({ error: 'Failed to list test cases' });
  }
});

/**
 * GET /api/test-cases/:id
 * Get a single test case by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { testCaseManager } = getServices();
    const testCase = await testCaseManager.get(req.params.id);

    if (!testCase) {
      res.status(404).json({ error: 'Test case not found' });
      return;
    }

    res.json(testCase);
  } catch (err) {
    console.error(`[testCaseRoutes] GET /api/test-cases/${req.params.id} error:`, err);
    res.status(500).json({ error: 'Failed to get test case' });
  }
});

/**
 * PUT /api/test-cases/:id
 * Update a test case by ID
 */
router.put('/:id', async (req, res) => {
  try {
    const { testCaseManager } = getServices();

    // Verify the test case exists first
    const existing = await testCaseManager.get(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Test case not found' });
      return;
    }

    await testCaseManager.update(req.params.id, req.body);
    const updated = await testCaseManager.get(req.params.id);
    res.json(updated);
  } catch (err) {
    console.error(`[testCaseRoutes] PUT /api/test-cases/${req.params.id} error:`, err);
    res.status(500).json({ error: 'Failed to update test case' });
  }
});

/**
 * POST /api/test-cases/:id/link-issue
 * Link a test case to an issue and regenerate with AI enhancement.
 * Body: { issueUrl: string }
 */
router.post('/:id/link-issue', async (req, res) => {
  try {
    const { testCaseManager, issueConnector, testCaseGenerator } = getServices();
    const { issueUrl } = req.body as { issueUrl?: string };

    if (!issueUrl) {
      res.status(400).json({ error: 'issueUrl is required' });
      return;
    }

    const existing = await testCaseManager.get(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Test case not found' });
      return;
    }

    // Fetch issue info
    const issueInfo = await issueConnector.fetchIssueInfo(issueUrl);

    // Regenerate with AI using original script + issue info
    const fakeEvent = {
      type: 'change' as const,
      filePath: '',
      fileName: existing.title,
      content: existing.automationScript,
      timestamp: new Date(),
    };

    const enhanced = await testCaseGenerator.generate(fakeEvent, issueInfo);

    // Update the existing test case with enhanced data
    await testCaseManager.update(req.params.id, {
      title: enhanced.title,
      issueLink: issueUrl,
      preconditions: enhanced.preconditions,
      steps: enhanced.steps,
      expectedResults: enhanced.expectedResults,
      automationScript: enhanced.automationScript,
      status: 'complete',
      missingFields: [],
    });

    const updated = await testCaseManager.get(req.params.id);
    res.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[testCaseRoutes] POST /api/test-cases/${req.params.id}/link-issue error:`, err);
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/test-cases/:id/regenerate-script
 * Use AI to regenerate the automation script based on updated steps/preconditions.
 * Body: { preconditions?, steps?, expectedResults? }
 */
router.post('/:id/regenerate-script', async (req, res) => {
  try {
    const { testCaseManager, testCaseGenerator } = getServices();
    console.log(`[regenerate-script] Request received for ${req.params.id}, body steps count: ${req.body.steps?.length ?? 'none'}`);

    const existing = await testCaseManager.get(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Test case not found' });
      return;
    }

    // Merge updates with existing data
    const merged = {
      title: existing.title,
      preconditions: req.body.preconditions ?? existing.preconditions,
      steps: req.body.steps ?? existing.steps,
      expectedResults: req.body.expectedResults ?? existing.expectedResults,
      automationScript: existing.automationScript,
    };

    const newScript = await testCaseGenerator.regenerateScript(merged);
    console.log(`[regenerate-script] AI returned script length: ${newScript.length}, first 100 chars: ${newScript.substring(0, 100)}`);

    // Save all updates + new script
    await testCaseManager.update(req.params.id, {
      preconditions: merged.preconditions,
      steps: merged.steps,
      expectedResults: merged.expectedResults,
      automationScript: newScript,
    });
    console.log(`[regenerate-script] Saved updated test case ${req.params.id}`);

    const updated = await testCaseManager.get(req.params.id);
    res.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[testCaseRoutes] POST /api/test-cases/${req.params.id}/regenerate-script error:`, err);
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/test-cases/:id/regenerate-from-issue
 * Re-fetch the linked issue content and use AI to regenerate steps + script from scratch.
 */
router.post('/:id/regenerate-from-issue', async (req, res) => {
  try {
    const { testCaseManager, issueConnector, testCaseGenerator } = getServices();

    const existing = await testCaseManager.get(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Test case not found' });
      return;
    }
    if (!existing.issueLink) {
      res.status(400).json({ error: '该测试用例未关联 Issue，请先关联一个 Issue' });
      return;
    }

    console.log(`[regenerate-from-issue] Fetching issue: ${existing.issueLink}`);
    const issueInfo = await issueConnector.fetchIssueInfo(existing.issueLink);
    console.log(`[regenerate-from-issue] Issue title: ${issueInfo.title}, description length: ${issueInfo.description.length}`);

    const result = await testCaseGenerator.regenerateFromIssue(issueInfo, existing.title);
    console.log(`[regenerate-from-issue] AI generated ${result.steps.length} steps, script length: ${result.automationScript.length}`);

    await testCaseManager.update(req.params.id, {
      title: result.title,
      preconditions: result.preconditions,
      steps: result.steps,
      expectedResults: result.expectedResults,
      automationScript: result.automationScript,
      status: 'complete',
      missingFields: [],
    });

    const updated = await testCaseManager.get(req.params.id);
    res.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[testCaseRoutes] POST /api/test-cases/${req.params.id}/regenerate-from-issue error:`, err);
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/test-cases/:id/fix-script
 * Use AI to fix a failing script based on the latest error.
 * Body: { errorMessage: string, logs?: string }
 */
router.post('/:id/fix-script', async (req, res) => {
  try {
    const { testCaseManager, testCaseGenerator } = getServices();
    const db = getDatabase();

    const existing = await testCaseManager.get(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Test case not found' });
      return;
    }

    const { errorMessage, logs } = req.body as { errorMessage?: string; logs?: string };
    if (!errorMessage) {
      res.status(400).json({ error: 'errorMessage is required' });
      return;
    }

    console.log(`[fix-script] Fixing script for ${req.params.id}, error: ${errorMessage.substring(0, 100)}`);

    // Load previous fix attempts to avoid repeating failed strategies
    const previousFixes = db.prepare(
      'SELECT explanation, error_message FROM script_fix_logs WHERE test_case_id = ? ORDER BY fixed_at DESC LIMIT 5'
    ).all(req.params.id) as Array<{ explanation: string; error_message: string }>;

    const result = await testCaseGenerator.fixScript({
      title: existing.title,
      steps: existing.steps,
      automationScript: existing.automationScript,
      errorMessage,
      logs: logs || '',
      previousFixes,
    });

    await testCaseManager.update(req.params.id, { automationScript: result.script });

    // Save fix record
    db.prepare(
      'INSERT INTO script_fix_logs (id, test_case_id, error_message, explanation, fixed_at) VALUES (?, ?, ?, ?, ?)'
    ).run(
      randomUUID(),
      req.params.id,
      errorMessage.substring(0, 500),
      result.explanation,
      new Date().toISOString(),
    );

    console.log(`[fix-script] Fixed: ${result.explanation}`);

    const updated = await testCaseManager.get(req.params.id);
    res.json({ ...updated, fixExplanation: result.explanation });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[testCaseRoutes] POST /api/test-cases/${req.params.id}/fix-script error:`, err);
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/test-cases/:id/fix-logs
 * Get fix history for a test case
 */
router.get('/:id/fix-logs', (req, res) => {
  try {
    const db = getDatabase();
    const rows = db.prepare(
      'SELECT * FROM script_fix_logs WHERE test_case_id = ? ORDER BY fixed_at DESC LIMIT 20'
    ).all(req.params.id);
    res.json(rows);
  } catch (err) {
    console.error(`[testCaseRoutes] GET fix-logs error:`, err);
    res.status(500).json({ error: 'Failed to get fix logs' });
  }
});

/**
 * POST /api/test-cases/:id/generate-report
 * AI generates an acceptance report based on test case + latest passed run.
 */
router.post('/:id/generate-report', async (req, res) => {
  try {
    const { testCaseManager, testCaseGenerator } = getServices();
    const db = getDatabase();

    const existing = await testCaseManager.get(req.params.id);
    if (!existing) { res.status(404).json({ error: 'Test case not found' }); return; }

    // Get latest passed run
    const latestRun = db.prepare(
      'SELECT status, duration, run_at FROM test_runs WHERE test_case_id = ? AND status = ? ORDER BY run_at DESC LIMIT 1'
    ).get(req.params.id, 'passed') as { status: string; duration: number; run_at: string } | undefined;

    if (!latestRun) { res.status(400).json({ error: '没有通过的运行记录' }); return; }

    const report = await testCaseGenerator.generateReport(existing, {
      status: latestRun.status,
      duration: latestRun.duration,
      runAt: latestRun.run_at,
    });

    res.json({ report });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/test-cases/:id/publish-report
 * Publish the report + script as a comment on the linked GitHub issue.
 * Body: { report: string }
 */
router.post('/:id/publish-report', async (req, res) => {
  try {
    const { testCaseManager, issueConnector } = getServices();

    const existing = await testCaseManager.get(req.params.id);
    if (!existing) { res.status(404).json({ error: 'Test case not found' }); return; }
    if (!existing.issueLink) { res.status(400).json({ error: '未关联 Issue' }); return; }

    const { report } = req.body as { report?: string };
    if (!report) { res.status(400).json({ error: 'report is required' }); return; }

    // Build the comment body: report + script
    const commentBody = [
      report,
      '',
      '---',
      '',
      '### 🤖 自动化测试脚本',
      '',
      '```typescript',
      existing.automationScript,
      '```',
      '',
      `*由 Test Monitor Tool 自动生成 | ID: ${existing.id}*`,
    ].join('\n');

    const result = await issueConnector.publishComment(existing.issueLink, commentBody);

    if (result.success) {
      res.json({ success: true, commentId: result.commentId });
    } else {
      res.status(500).json({ error: result.error || '推送失败' });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

export default router;
