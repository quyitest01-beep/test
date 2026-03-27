import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { MonitorService } from './MonitorService.js';
import type { FileChangeEvent } from '../types/index.js';

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'monitor-test-'));
}

function writeSpecFile(dir: string, name: string, content: string): string {
  const filePath = path.join(dir, name);
  fs.writeFileSync(filePath, content, 'utf-8');
  return filePath;
}

const VALID_SPEC_CONTENT = `import { test, expect } from '@playwright/test';

test('example test', async ({ page }) => {
  await page.goto('https://example.com');
  expect(await page.title()).toBe('Example Domain');
});
`;

describe('MonitorService', () => {
  let service: MonitorService;
  let tmpDir: string;

  beforeEach(() => {
    service = new MonitorService();
    tmpDir = makeTempDir();
  });

  afterEach(async () => {
    await service.stop();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('start / stop lifecycle', () => {
    it('should start and report running', () => {
      service.start(tmpDir);
      expect(service.isRunning()).toBe(true);
    });

    it('should stop and report not running', async () => {
      service.start(tmpDir);
      await service.stop();
      expect(service.isRunning()).toBe(false);
    });

    it('should be idempotent on repeated start calls', () => {
      service.start(tmpDir);
      service.start(tmpDir); // should not throw
      expect(service.isRunning()).toBe(true);
    });

    it('should not be running before start', () => {
      expect(service.isRunning()).toBe(false);
    });
  });

  describe('directory validation', () => {
    it('should throw when watch directory does not exist', () => {
      const nonExistent = path.join(tmpDir, 'does-not-exist');
      expect(() => service.start(nonExistent)).toThrow(/does not exist/);
      expect(service.isRunning()).toBe(false);
    });

    it('should include the directory path in the error message', () => {
      const nonExistent = path.join(tmpDir, 'missing-dir');
      expect(() => service.start(nonExistent)).toThrow(nonExistent);
    });
  });

  describe('file change detection', () => {
    it('should detect a new .spec.ts file and emit event', async () => {
      const events: FileChangeEvent[] = [];
      service.onFileChange((e) => events.push(e));
      service.start(tmpDir);

      // Give chokidar a moment to initialize
      await sleep(1000);

      writeSpecFile(tmpDir, 'login.spec.ts', VALID_SPEC_CONTENT);

      // Wait for the event to be detected
      await waitFor(() => events.length > 0, 8000);

      expect(events.length).toBeGreaterThanOrEqual(1);
      const event = events[events.length - 1];
      expect(event.type).toBe('add');
      expect(event.fileName).toBe('login.spec.ts');
      expect(event.content).toBe(VALID_SPEC_CONTENT);
      expect(event.filePath).toContain('login.spec.ts');
      expect(event.timestamp).toBeInstanceOf(Date);
    }, 15000);

    it('should detect changes to an existing .spec.ts file', async () => {
      // Create file before starting the watcher
      writeSpecFile(tmpDir, 'existing.spec.ts', VALID_SPEC_CONTENT);

      const events: FileChangeEvent[] = [];
      service.onFileChange((e) => events.push(e));
      service.start(tmpDir);

      // Wait for initial scan to complete
      await sleep(2000);
      const initialCount = events.length;

      // Modify the file
      const updatedContent = VALID_SPEC_CONTENT + '\n// updated\n';
      writeSpecFile(tmpDir, 'existing.spec.ts', updatedContent);

      await waitFor(() => events.length > initialCount, 8000);

      const changeEvents = events.filter((e) => e.type === 'change');
      expect(changeEvents.length).toBeGreaterThanOrEqual(1);
    }, 15000);

    it('should skip files with empty content', async () => {
      const events: FileChangeEvent[] = [];
      service.onFileChange((e) => events.push(e));
      service.start(tmpDir);

      await sleep(500);

      writeSpecFile(tmpDir, 'empty.spec.ts', '');

      // Wait a bit and verify no event was emitted
      await sleep(1500);
      const emptyEvents = events.filter((e) => e.fileName === 'empty.spec.ts');
      expect(emptyEvents.length).toBe(0);
    });

    it('should skip files with whitespace-only content', async () => {
      const events: FileChangeEvent[] = [];
      service.onFileChange((e) => events.push(e));
      service.start(tmpDir);

      await sleep(500);

      writeSpecFile(tmpDir, 'whitespace.spec.ts', '   \n\t\n  ');

      await sleep(1500);
      const wsEvents = events.filter(
        (e) => e.fileName === 'whitespace.spec.ts'
      );
      expect(wsEvents.length).toBe(0);
    });

    it('should skip files without valid test constructs', async () => {
      const events: FileChangeEvent[] = [];
      service.onFileChange((e) => events.push(e));
      service.start(tmpDir);

      await sleep(500);

      writeSpecFile(tmpDir, 'invalid.spec.ts', 'just some random text');

      await sleep(1500);
      const invalidEvents = events.filter(
        (e) => e.fileName === 'invalid.spec.ts'
      );
      expect(invalidEvents.length).toBe(0);
    });
  });
});

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(
  predicate: () => boolean,
  timeoutMs: number
): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error(`waitFor timed out after ${timeoutMs}ms`);
    }
    await sleep(100);
  }
}
