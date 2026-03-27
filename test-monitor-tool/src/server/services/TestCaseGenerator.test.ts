import { describe, it, expect } from 'vitest';
import { TestCaseGenerator } from './TestCaseGenerator.js';
import type { FileChangeEvent, IssueInfo } from '../types/index.js';

function makeSpecFile(content: string, fileName = 'login.spec.ts'): FileChangeEvent {
  return {
    type: 'add',
    filePath: `/tests/${fileName}`,
    fileName,
    content,
    timestamp: new Date(),
  };
}

const sampleSpec = `
import { test, expect } from '@playwright/test';

test('user login flow', async ({ page }) => {
  await page.goto('https://example.com/login');
  await page.fill('#username', 'testuser');
  await page.fill('#password', 'secret');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard');
});
`;

const sampleIssue: IssueInfo = {
  title: 'Implement login page',
  description: 'Users should be able to log in with username and password.',
  labels: ['feature', 'auth'],
  url: 'https://github.com/owner/repo/issues/42',
};

describe('TestCaseGenerator', () => {
  const generator = new TestCaseGenerator();

  describe('generate() with issue info', () => {
    it('generates a complete test case with issue info', () => {
      const specFile = makeSpecFile(sampleSpec);
      const result = generator.generate(specFile, sampleIssue);

      expect(result.id).toBeTruthy();
      expect(result.title).toContain('Implement login page');
      expect(result.title).toContain('user login flow');
      expect(result.issueLink).toBe('https://github.com/owner/repo/issues/42');
      expect(result.preconditions).toBe(sampleIssue.description);
      expect(result.automationScript).toBe(sampleSpec);
      expect(result.status).toBe('complete');
      expect(result.missingFields).toEqual([]);
      expect(result.steps.length).toBeGreaterThan(0);
      expect(result.expectedResults).toBeTruthy();
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.updatedAt).toBeInstanceOf(Date);
    });

    it('extracts Playwright page actions as steps', () => {
      const specFile = makeSpecFile(sampleSpec);
      const result = generator.generate(specFile, sampleIssue);

      // Should extract goto, fill x2, click, waitForURL
      expect(result.steps.length).toBe(5);
      expect(result.steps[0].order).toBe(1);
      expect(result.steps[0].action).toContain('Navigate to');
      expect(result.steps[1].action).toContain('Fill input');
      expect(result.steps[3].action).toContain('Click on');
      expect(result.steps[4].action).toContain('Wait for URL');
    });
  });

  describe('generate() without issue info', () => {
    it('sets status to pending_info when issueInfo is null', () => {
      const specFile = makeSpecFile(sampleSpec);
      const result = generator.generate(specFile, null);

      expect(result.status).toBe('pending_info');
      expect(result.issueLink).toBeNull();
      expect(result.missingFields).toContain('issueLink');
      expect(result.missingFields).toContain('preconditions');
    });

    it('uses spec test title as title when no issue', () => {
      const specFile = makeSpecFile(sampleSpec);
      const result = generator.generate(specFile, null);

      expect(result.title).toBe('user login flow');
    });

    it('falls back to fileName when no test title found', () => {
      const minimalSpec = `import { test } from '@playwright/test';\npage.goto('https://example.com');`;
      const specFile = makeSpecFile(minimalSpec, 'checkout.spec.ts');
      const result = generator.generate(specFile, null);

      expect(result.title).toBe('checkout.spec.ts');
    });
  });

  describe('automationScript preservation', () => {
    it('preserves the original Playwright code as automationScript', () => {
      const specFile = makeSpecFile(sampleSpec);
      const result = generator.generate(specFile, sampleIssue);

      expect(result.automationScript).toBe(sampleSpec);
    });
  });

  describe('step extraction edge cases', () => {
    it('creates a default step when no page actions found', () => {
      const noActionsSpec = `import { test } from '@playwright/test';\ntest('empty', async () => { console.log('hi'); });`;
      const specFile = makeSpecFile(noActionsSpec);
      const result = generator.generate(specFile, sampleIssue);

      expect(result.steps.length).toBe(1);
      expect(result.steps[0].action).toBe('Execute automated test script');
    });

    it('handles getByRole and getByText locators', () => {
      const locatorSpec = `
import { test } from '@playwright/test';
test('locators', async ({ page }) => {
  await page.getByRole('button', { name: 'Submit' }).click();
  await page.getByText('Welcome').click();
});`;
      const specFile = makeSpecFile(locatorSpec);
      const result = generator.generate(specFile, sampleIssue);

      const roleStep = result.steps.find(s => s.action.includes('role'));
      expect(roleStep).toBeTruthy();
    });
  });
});
