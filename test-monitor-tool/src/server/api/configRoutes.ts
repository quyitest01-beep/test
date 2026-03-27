import { Router } from 'express';
import { getServices } from './serviceContainer.js';

const router = Router();

/**
 * GET /api/config
 * Get the current system configuration
 */
router.get('/', (_req, res) => {
  try {
    const { configManager } = getServices();
    const config = configManager.getConfig();

    // Redact sensitive fields before sending to client
    const safeConfig = {
      ...config,
      issueApiToken: config.issueApiToken ? '***' : '',
      aiApiKey: config.aiApiKey ? '***' : '',
    };

    res.json(safeConfig);
  } catch (err) {
    console.error('[configRoutes] GET /api/config error:', err);
    res.status(500).json({ error: 'Failed to get config' });
  }
});

/**
 * PUT /api/config
 * Update system configuration
 */
router.put('/', (req, res) => {
  try {
    const { configManager } = getServices();
    const updates = req.body;

    // If the token is the redacted placeholder, strip it so the real value is preserved
    if (updates.issueApiToken === '***') {
      delete updates.issueApiToken;
    }
    if (updates.aiApiKey === '***') {
      delete updates.aiApiKey;
    }

    // Validate before applying
    const validation = configManager.validate(updates);
    if (!validation.valid) {
      res.status(400).json({ error: 'Invalid configuration', details: validation.errors });
      return;
    }

    configManager.update(updates);
    const updated = configManager.getConfig();

    // Redact sensitive fields
    const safeConfig = {
      ...updated,
      issueApiToken: updated.issueApiToken ? '***' : '',
      aiApiKey: updated.aiApiKey ? '***' : '',
    };

    res.json(safeConfig);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[configRoutes] PUT /api/config error:', err);
    res.status(500).json({ error: message });
  }
});

export default router;
