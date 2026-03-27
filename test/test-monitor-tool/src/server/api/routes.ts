import type { Express } from 'express';
import testCaseRoutes from './testCaseRoutes.js';
import testRunRoutes from './testRunRoutes.js';
import configRoutes from './configRoutes.js';
import issueRoutes from './issueRoutes.js';
import { statsHandler } from './statsHandler.js';

/**
 * Register all API routes on the Express app.
 */
export function registerRoutes(app: Express): void {
  app.use('/api/test-cases', testCaseRoutes);
  app.use('/api/test-run', testRunRoutes);
  app.use('/api/config', configRoutes);
  app.use('/api/issues', issueRoutes);
  app.get('/api/stats', statsHandler);
}
