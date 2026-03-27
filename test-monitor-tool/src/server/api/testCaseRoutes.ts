import { Router } from 'express';
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

    // Save all updates + new script
    await testCaseManager.update(req.params.id, {
      preconditions: merged.preconditions,
      steps: merged.steps,
      expectedResults: merged.expectedResults,
      automationScript: newScript,
    });

    const updated = await testCaseManager.get(req.params.id);
    res.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[testCaseRoutes] POST /api/test-cases/${req.params.id}/regenerate-script error:`, err);
    res.status(500).json({ error: message });
  }
});

export default router;
