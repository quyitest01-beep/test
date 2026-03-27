/**
 * Service container to provide route handlers access to service instances
 * without circular dependency on index.ts.
 *
 * Services are registered once during server startup (in index.ts)
 * and consumed by route modules.
 */

import type { Server as SocketIOServer } from 'socket.io';
import type { TestCaseManager } from '../services/TestCaseManager.js';
import type { TestRunner } from '../services/TestRunner.js';
import type { ConfigManager } from '../services/ConfigManager.js';
import type { IssueConnector } from '../services/IssueConnector.js';
import type { TestCaseGenerator } from '../services/TestCaseGenerator.js';

export interface Services {
  testCaseManager: TestCaseManager;
  testRunner: TestRunner;
  configManager: ConfigManager;
  issueConnector: IssueConnector;
  testCaseGenerator: TestCaseGenerator;
  io: SocketIOServer;
}

let services: Services | null = null;

export function registerServices(s: Services): void {
  services = s;
}

export function getServices(): Services {
  if (!services) {
    throw new Error('Services not registered. Call registerServices() before using routes.');
  }
  return services;
}
