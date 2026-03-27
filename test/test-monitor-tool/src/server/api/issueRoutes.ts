import { Router } from 'express';
import { getServices } from './serviceContainer.js';

const router = Router();

/**
 * GET /api/issues
 * List issues from the configured GitHub repo.
 * Query params: page, perPage, state (open|closed|all)
 */
router.get('/', async (req, res) => {
  try {
    const { issueConnector } = getServices();
    const page = Number(req.query.page) || 1;
    const perPage = Math.min(Number(req.query.perPage) || 30, 100);
    const state = (req.query.state as 'open' | 'closed' | 'all') || 'open';

    const issues = await issueConnector.listIssues(page, perPage, state);
    res.json(issues);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[issueRoutes] GET /api/issues error:', err);
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/test-cases/:id/link-issue
 * Link a test case to an issue and regenerate with AI.
 * Body: { issueUrl: string }
 */
router.post('/:id/link-issue', async (req, res) => {
  // This is registered under /api/issues but we need it under /api/test-cases
  // So we'll add it to testCaseRoutes instead
  res.status(404).json({ error: 'Use POST /api/test-cases/:id/link-issue' });
});

export default router;
