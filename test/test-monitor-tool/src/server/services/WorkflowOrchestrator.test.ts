import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorkflowOrchestrator } from './WorkflowOrchestrator.js';
import type { FileChangeEvent, IssueInfo, TestCase } from '../types/index.js';

// --- Helpers to build mock services ---

function makeFileChangeEvent(overrides?: Partial<FileChangeEvent>): FileChangeEvent {
  return {
    type: 'add',
    filePath: '/tests/recorded/login#42.spec.ts',
    fileName: 'login#42.spec.ts',
    content: `import { test } from '@playwright/test';\ntest('login test', async ({ page }) => {\n  await page.goto('http://localhost');\n});`,
    timestamp: new Date(),
    ...overrides,
  };
}

function makeIssueInfo(overrides?: Partial<IssueInfo>): IssueInfo {
  return {
    title: 'Login page bug',
    description: 'Users cannot login',
    labels: ['bug'],
    url: 'https://github.com/owner/repo/issues/42',
    ...overrides,
  };
}

function makeTestCase(overrides?: Partial<TestCase>): TestCase {
  return {
    id: 'tc-001',
    title: '[Login page bug] login test',
    issueLink: 'https://github.com/owner/repo/issues/42',
    preconditions: 'Users cannot login',
    steps: [{ order: 1, action: 'Navigate to http://localhost', expected: 'Page loads successfully' }],
    expectedResults: 'All 1 test steps complete successfully without errors',
    automationScript: 'test code',
    status: 'complete',
    missingFields: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function createMockServices() {
  const monitorService = {
    onFileChange: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    isRunning: vi.fn().mockReturnValue(true),
  };

  const issueConnector = {
    extractIssueLink: vi.fn(),
    fetchIssueInfo: vi.fn(),
    publishTestCase: vi.fn(),
    updateTestCaseComment: vi.fn(),
    formatTestCaseMarkdown: vi.fn(),
  };

  const testCaseGenerator = {
    generate: vi.fn(),
  };

  const testCaseManager = {
    save: vi.fn(),
    update: vi.fn(),
    list: vi.fn(),
    get: vi.fn(),
    getMetadata: vi.fn(),
  };

  return { monitorService, issueConnector, testCaseGenerator, testCaseManager };
}

describe('WorkflowOrchestrator', () => {
  let mocks: ReturnType<typeof createMockServices>;
  let orchestrator: WorkflowOrchestrator;

  beforeEach(() => {
    mocks = createMockServices();
    orchestrator = new WorkflowOrchestrator({
      monitorService: mocks.monitorService as any,
      issueConnector: mocks.issueConnector as any,
      testCaseGenerator: mocks.testCaseGenerator as any,
      testCaseManager: mocks.testCaseManager as any,
    });
  });

  it('should register a callback on MonitorService when start() is called', () => {
    orchestrator.start();
    expect(mocks.monitorService.onFileChange).toHaveBeenCalledOnce();
    expect(typeof mocks.monitorService.onFileChange.mock.calls[0][0]).toBe('function');
  });

  describe('handleFileChange - full success path', () => {
    it('should chain extract → fetch → generate → save → publish', async () => {
      const event = makeFileChangeEvent();
      const issueInfo = makeIssueInfo();
      const testCase = makeTestCase();

      mocks.issueConnector.extractIssueLink.mockReturnValue('https://github.com/owner/repo/issues/42');
      mocks.issueConnector.fetchIssueInfo.mockResolvedValue(issueInfo);
      mocks.testCaseGenerator.generate.mockReturnValue(testCase);
      mocks.testCaseManager.save.mockResolvedValue(testCase.id);
      mocks.issueConnector.publishTestCase.mockResolvedValue({ success: true, commentId: 'c-1' });

      const result = await orchestrator.handleFileChange(event);

      expect(mocks.issueConnector.extractIssueLink).toHaveBeenCalledWith(event.fileName, event.content);
      expect(mocks.issueConnector.fetchIssueInfo).toHaveBeenCalledWith('https://github.com/owner/repo/issues/42');
      expect(mocks.testCaseGenerator.generate).toHaveBeenCalledWith(event, issueInfo);
      expect(mocks.testCaseManager.save).toHaveBeenCalledWith(testCase);
      expect(mocks.issueConnector.publishTestCase).toHaveBeenCalledWith(testCase.issueLink, testCase);
      expect(result).toEqual({ success: true, testCaseId: 'tc-001', status: 'complete' });
    });
  });

  describe('handleFileChange - no issue link found', () => {
    it('should generate test case without issue info (pending_info)', async () => {
      const event = makeFileChangeEvent({ fileName: 'noissue.spec.ts' });
      const testCase = makeTestCase({ issueLink: null, status: 'pending_info', missingFields: ['issueLink', 'preconditions'] });

      mocks.issueConnector.extractIssueLink.mockReturnValue(null);
      mocks.testCaseGenerator.generate.mockReturnValue(testCase);
      mocks.testCaseManager.save.mockResolvedValue(testCase.id);

      const result = await orchestrator.handleFileChange(event);

      expect(mocks.issueConnector.fetchIssueInfo).not.toHaveBeenCalled();
      expect(mocks.testCaseGenerator.generate).toHaveBeenCalledWith(event, null);
      expect(mocks.issueConnector.publishTestCase).not.toHaveBeenCalled();
      expect(result).toEqual({ success: true, testCaseId: 'tc-001', status: 'pending_info' });
    });
  });

  describe('handleFileChange - issue link extraction throws', () => {
    it('should proceed without issue info when extractIssueLink throws', async () => {
      const event = makeFileChangeEvent();
      const testCase = makeTestCase({ issueLink: null, status: 'pending_info' });

      mocks.issueConnector.extractIssueLink.mockImplementation(() => { throw new Error('parse error'); });
      mocks.testCaseGenerator.generate.mockReturnValue(testCase);
      mocks.testCaseManager.save.mockResolvedValue(testCase.id);

      const result = await orchestrator.handleFileChange(event);

      expect(mocks.testCaseGenerator.generate).toHaveBeenCalledWith(event, null);
      expect(result.success).toBe(true);
    });
  });

  describe('handleFileChange - issue fetch fails', () => {
    it('should generate test case without issue info when fetchIssueInfo rejects', async () => {
      const event = makeFileChangeEvent();
      const testCase = makeTestCase({ issueLink: null, status: 'pending_info' });

      mocks.issueConnector.extractIssueLink.mockReturnValue('https://github.com/owner/repo/issues/42');
      mocks.issueConnector.fetchIssueInfo.mockRejectedValue(new Error('API unreachable'));
      mocks.testCaseGenerator.generate.mockReturnValue(testCase);
      mocks.testCaseManager.save.mockResolvedValue(testCase.id);

      const result = await orchestrator.handleFileChange(event);

      expect(mocks.testCaseGenerator.generate).toHaveBeenCalledWith(event, null);
      expect(result.success).toBe(true);
    });
  });

  describe('handleFileChange - publish fails', () => {
    it('should mark test case as pending_publish when publishTestCase returns failure', async () => {
      const event = makeFileChangeEvent();
      const issueInfo = makeIssueInfo();
      const testCase = makeTestCase();

      mocks.issueConnector.extractIssueLink.mockReturnValue('https://github.com/owner/repo/issues/42');
      mocks.issueConnector.fetchIssueInfo.mockResolvedValue(issueInfo);
      mocks.testCaseGenerator.generate.mockReturnValue(testCase);
      mocks.testCaseManager.save.mockResolvedValue(testCase.id);
      mocks.issueConnector.publishTestCase.mockResolvedValue({ success: false, error: 'rate limited' });

      const result = await orchestrator.handleFileChange(event);

      expect(mocks.testCaseManager.update).toHaveBeenCalledWith('tc-001', { status: 'pending_publish' });
      expect(result).toEqual({ success: true, testCaseId: 'tc-001', status: 'pending_publish' });
    });

    it('should mark test case as pending_publish when publishTestCase throws', async () => {
      const event = makeFileChangeEvent();
      const issueInfo = makeIssueInfo();
      const testCase = makeTestCase();

      mocks.issueConnector.extractIssueLink.mockReturnValue('https://github.com/owner/repo/issues/42');
      mocks.issueConnector.fetchIssueInfo.mockResolvedValue(issueInfo);
      mocks.testCaseGenerator.generate.mockReturnValue(testCase);
      mocks.testCaseManager.save.mockResolvedValue(testCase.id);
      mocks.issueConnector.publishTestCase.mockRejectedValue(new Error('network error'));

      const result = await orchestrator.handleFileChange(event);

      expect(mocks.testCaseManager.update).toHaveBeenCalledWith('tc-001', { status: 'pending_publish' });
      expect(result).toEqual({ success: true, testCaseId: 'tc-001', status: 'pending_publish' });
    });
  });

  describe('handleFileChange - generate fails', () => {
    it('should return failure when test case generation throws', async () => {
      const event = makeFileChangeEvent();

      mocks.issueConnector.extractIssueLink.mockReturnValue(null);
      mocks.testCaseGenerator.generate.mockImplementation(() => { throw new Error('generation error'); });

      const result = await orchestrator.handleFileChange(event);

      expect(result.success).toBe(false);
      expect(result.error).toContain('generation error');
      expect(mocks.testCaseManager.save).not.toHaveBeenCalled();
    });
  });

  describe('handleFileChange - save fails', () => {
    it('should return failure when save throws', async () => {
      const event = makeFileChangeEvent();
      const testCase = makeTestCase({ issueLink: null, status: 'pending_info' });

      mocks.issueConnector.extractIssueLink.mockReturnValue(null);
      mocks.testCaseGenerator.generate.mockReturnValue(testCase);
      mocks.testCaseManager.save.mockRejectedValue(new Error('DB error'));

      const result = await orchestrator.handleFileChange(event);

      expect(result.success).toBe(false);
      expect(result.error).toContain('DB error');
      expect(mocks.issueConnector.publishTestCase).not.toHaveBeenCalled();
    });
  });
});
