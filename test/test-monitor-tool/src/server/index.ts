import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'node:http';
import { Server as SocketIOServer } from 'socket.io';

import { ConfigManager } from './services/ConfigManager.js';
import { MonitorService } from './services/MonitorService.js';
import { IssueConnector } from './services/IssueConnector.js';
import { TestCaseGenerator } from './services/TestCaseGenerator.js';
import { TestCaseManager } from './services/TestCaseManager.js';
import { TestRunner } from './services/TestRunner.js';
import { WorkflowOrchestrator } from './services/WorkflowOrchestrator.js';
import { getDatabase } from './db/database.js';
import { registerRoutes } from './api/routes.js';
import { registerServices } from './api/serviceContainer.js';

// --- Initialize services ---

const configManager = new ConfigManager();
const config = configManager.load();

// Ensure database is initialized
getDatabase();

const monitorService = new MonitorService();
const issueConnector = new IssueConnector(configManager);
const testCaseGenerator = new TestCaseGenerator(configManager);
const testCaseManager = new TestCaseManager();
testCaseManager.setMonitorService(monitorService);
const testRunner = new TestRunner();

const workflowOrchestrator = new WorkflowOrchestrator({
  monitorService,
  issueConnector,
  testCaseGenerator,
  testCaseManager,
});

// --- Express + Socket.IO setup ---

const app = express();
app.use(express.json());

const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: { origin: '*' },
});

// Wire Socket.IO events for real-time progress
testRunner.setProgressCallback((status) => {
  io.emit('test:progress', status);
});
testRunner.setCompleteCallback((summary) => {
  io.emit('test:complete', summary);
});
testRunner.setStepCallback((step) => {
  io.emit('test:step', step);
});

// Wire file:change and testcase:created events through the workflow orchestrator
monitorService.onFileChange((event) => {
  io.emit('file:change', {
    type: event.type,
    filePath: event.filePath,
    fileName: event.fileName,
    timestamp: event.timestamp,
  });
});

// Emit testcase:created after workflow processes a file change
const originalHandleFileChange = workflowOrchestrator.handleFileChange.bind(workflowOrchestrator);
workflowOrchestrator.handleFileChange = async (event) => {
  const result = await originalHandleFileChange(event);
  if (result.success && result.testCaseId) {
    io.emit('testcase:created', {
      testCaseId: result.testCaseId,
      status: result.status,
      fileName: event.fileName,
    });
  }
  return result;
};

// Register service instances for route handlers
registerServices({
  testCaseManager,
  testRunner,
  configManager,
  issueConnector,
  testCaseGenerator,
  io,
});

// Register REST API routes
registerRoutes(app);

// Serve test-results screenshots as static files
// Screenshots are saved in {watchDir}/../test-results/screenshots/
const screenshotBasePath = path.resolve(config.watchDir, '..', 'test-results', 'screenshots');
app.use('/api/screenshots', express.static(screenshotBasePath));

// --- Start services ---

workflowOrchestrator.start();

try {
  monitorService.start(config.watchDir);
  console.info(`[Server] MonitorService watching: ${config.watchDir}`);
} catch (err) {
  console.error(`[Server] Failed to start MonitorService: ${err}`);
}

// Auto-restart MonitorService when config changes
configManager.onConfigChange(async (newConfig) => {
  const currentDir = monitorService.getWatchDir();
  if (currentDir !== path.resolve(newConfig.watchDir)) {
    console.info(`[Server] watchDir changed, restarting MonitorService: ${newConfig.watchDir}`);
    await monitorService.stop();
    try {
      monitorService.start(newConfig.watchDir);
      console.info(`[Server] MonitorService now watching: ${newConfig.watchDir}`);
    } catch (err) {
      console.error(`[Server] Failed to restart MonitorService: ${err}`);
    }
  }
});

// POST /api/scan - manually scan existing files in watch directory + cleanup orphans
app.post('/api/scan', async (_req, res) => {
  try {
    if (!monitorService.isRunning()) {
      res.status(400).json({ error: '监听服务未运行' });
      return;
    }

    // Cleanup: remove test cases whose source files no longer exist
    const db = getDatabase();
    const allCases = db.prepare('SELECT id, title, source_path FROM test_cases WHERE source_path IS NOT NULL').all() as Array<{ id: string; title: string; source_path: string }>;
    let removed = 0;
    for (const tc of allCases) {
      if (!fs.existsSync(tc.source_path)) {
        db.prepare('DELETE FROM test_runs WHERE test_case_id = ?').run(tc.id);
        db.prepare('DELETE FROM script_fix_logs WHERE test_case_id = ?').run(tc.id);
        db.prepare('DELETE FROM test_cases WHERE id = ?').run(tc.id);
        console.info(`[Server] Removed orphan test case: ${tc.title} (source: ${tc.source_path})`);
        removed++;
      }
    }

    const count = monitorService.scanExisting();
    res.json({ success: true, filesScanned: count, orphansRemoved: removed });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[Server] POST /api/scan error:', err);
    res.status(500).json({ error: message });
  }
});

const port = config.serverPort;
httpServer.listen(port, () => {
  console.info(`[Server] Listening on http://localhost:${port}`);
});

export { app, httpServer, io, configManager, monitorService, testRunner, testCaseManager, issueConnector, workflowOrchestrator };
