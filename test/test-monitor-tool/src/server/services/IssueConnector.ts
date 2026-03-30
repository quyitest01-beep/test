import { Octokit } from 'octokit';
import { v4 as uuidv4 } from 'uuid';
import type { ConfigManager } from './ConfigManager.js';
import type { IssueInfo, PublishResult, TestCase } from '../types/index.js';
import { getDatabase } from '../db/database.js';

// Regex: match `// @issue: <url>` comment in file content
const ISSUE_COMMENT_REGEX = /\/\/\s*@issue:\s*(https?:\/\/\S+)/;
// Regex: match `#<number>` in file name
const ISSUE_FILENAME_REGEX = /#(\d+)/;
// Regex: parse owner/repo and issue number from a GitHub issue URL
const GITHUB_ISSUE_URL_REGEX =
  /github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)/;

export class IssueConnector {
  private configManager: ConfigManager;

  constructor(configManager: ConfigManager) {
    this.configManager = configManager;
  }

  /**
   * List open issues from the configured GitHub repo.
   */
  async listIssues(page = 1, perPage = 30, state: 'open' | 'closed' | 'all' = 'open'): Promise<IssueInfo[]> {
    const config = this.configManager.getConfig();
    const octokit = new Octokit({ auth: config.issueApiToken || undefined });
    const repo = config.issueRepo ?? 'owner/repo';
    const [owner, repoName] = repo.split('/');

    if (!owner || !repoName) {
      throw new Error(`Invalid issueRepo format: ${repo}. Expected "owner/repo".`);
    }

    const { data } = await octokit.rest.issues.listForRepo({
      owner,
      repo: repoName,
      state,
      per_page: perPage,
      page,
      sort: 'updated',
      direction: 'desc',
    });

    return data
      .filter((issue) => !issue.pull_request) // exclude PRs
      .map((issue) => ({
        title: issue.title,
        description: issue.body ?? '',
        labels: issue.labels.map((l) => (typeof l === 'string' ? l : l.name ?? '')),
        url: issue.html_url,
      }));
  }

  /**
   * Extract an issue link from file content or file name.
   * Priority: `// @issue: <url>` comment > `#<number>` in filename.
   */
  extractIssueLink(fileName: string, content: string): string | null {
    // Priority 1: check content for `// @issue: <url>`
    const commentMatch = content.match(ISSUE_COMMENT_REGEX);
    if (commentMatch) {
      return commentMatch[1];
    }

    // Priority 2: check filename for `#<number>`
    const fileNameMatch = fileName.match(ISSUE_FILENAME_REGEX);
    if (fileNameMatch) {
      const config = this.configManager.getConfig();
      const issueNumber = fileNameMatch[1];
      const baseUrl = config.issueApiUrl === 'https://api.github.com'
        ? 'https://github.com'
        : config.issueApiUrl;
      const repo = config.issueRepo ?? 'owner/repo';
      return `${baseUrl}/${repo}/issues/${issueNumber}`;
    }

    return null;
  }

  /**
   * Fetch issue details from GitHub using Octokit.
   */
  async fetchIssueInfo(issueLink: string): Promise<IssueInfo> {
    const parsed = this.parseGitHubIssueUrl(issueLink);
    if (!parsed) {
      throw new Error(`Invalid GitHub issue URL: ${issueLink}`);
    }

    const config = this.configManager.getConfig();
    const octokit = new Octokit({ auth: config.issueApiToken || undefined });

    const { data } = await octokit.rest.issues.get({
      owner: parsed.owner,
      repo: parsed.repo,
      issue_number: parsed.issueNumber,
    });

    return {
      title: data.title,
      description: data.body ?? '',
      labels: data.labels.map((label) =>
        typeof label === 'string' ? label : label.name ?? ''
      ),
      url: issueLink,
    };
  }

  /**
   * Publish a formatted test case as a comment on the GitHub issue.
   * Retries up to retryCount times with retryInterval ms between attempts.
   * If the issue already has a comment for this test case, updates it instead.
   */
  async publishTestCase(
    issueLink: string,
    testCase: TestCase
  ): Promise<PublishResult> {
    // Check if there's an existing comment for this issue + test case
    const existingComment = this.findExistingComment(
      issueLink,
      testCase.id
    );
    if (existingComment) {
      return this.updateTestCaseComment(
        issueLink,
        existingComment.commentId,
        testCase
      );
    }

    const parsed = this.parseGitHubIssueUrl(issueLink);
    if (!parsed) {
      return { success: false, error: `Invalid GitHub issue URL: ${issueLink}` };
    }

    const config = this.configManager.getConfig();
    const octokit = new Octokit({ auth: config.issueApiToken || undefined });
    const body = this.formatTestCaseMarkdown(testCase);

    const maxRetries = config.retryCount;
    const retryInterval = config.retryInterval;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const { data } = await octokit.rest.issues.createComment({
          owner: parsed.owner,
          repo: parsed.repo,
          issue_number: parsed.issueNumber,
          body,
        });

        const commentId = String(data.id);
        this.saveCommentRecord(testCase.id, issueLink, commentId);

        return { success: true, commentId };
      } catch (err) {
        if (attempt < maxRetries) {
          await this.sleep(retryInterval);
        } else {
          const errorMessage =
            err instanceof Error ? err.message : String(err);
          console.error(
            `[IssueConnector] Failed to publish test case after ${maxRetries + 1} attempts: ${errorMessage}`
          );
          return { success: false, error: errorMessage };
        }
      }
    }

    // Should not reach here, but satisfy TypeScript
    return { success: false, error: 'Unexpected error in publish retry loop' };
  }

  /**
   * Update an existing comment on the GitHub issue.
   */
  async updateTestCaseComment(
    issueLink: string,
    commentId: string,
    testCase: TestCase
  ): Promise<PublishResult> {
    const parsed = this.parseGitHubIssueUrl(issueLink);
    if (!parsed) {
      return { success: false, error: `Invalid GitHub issue URL: ${issueLink}` };
    }

    const config = this.configManager.getConfig();
    const octokit = new Octokit({ auth: config.issueApiToken || undefined });
    const body = this.formatTestCaseMarkdown(testCase);

    const maxRetries = config.retryCount;
    const retryInterval = config.retryInterval;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        await octokit.rest.issues.updateComment({
          owner: parsed.owner,
          repo: parsed.repo,
          comment_id: Number(commentId),
          body,
        });

        this.updateCommentRecord(testCase.id, issueLink, commentId);

        return { success: true, commentId };
      } catch (err) {
        if (attempt < maxRetries) {
          await this.sleep(retryInterval);
        } else {
          const errorMessage =
            err instanceof Error ? err.message : String(err);
          console.error(
            `[IssueConnector] Failed to update comment after ${maxRetries + 1} attempts: ${errorMessage}`
          );
          return { success: false, error: errorMessage };
        }
      }
    }

    return { success: false, error: 'Unexpected error in update retry loop' };
  }

  /**
   * Format a TestCase as Markdown for publishing to an issue.
   */
  formatTestCaseMarkdown(testCase: TestCase): string {
    const lines: string[] = [];

    lines.push(`## 🧪 Test Case: ${testCase.title}`);
    lines.push('');

    if (testCase.issueLink) {
      lines.push(`**Issue:** ${testCase.issueLink}`);
      lines.push('');
    }

    if (testCase.preconditions) {
      lines.push('### Preconditions');
      lines.push(testCase.preconditions);
      lines.push('');
    }

    lines.push('### Test Steps');
    lines.push('');
    lines.push('| # | Action | Expected |');
    lines.push('|---|--------|----------|');
    for (const step of testCase.steps) {
      lines.push(`| ${step.order} | ${step.action} | ${step.expected} |`);
    }
    lines.push('');

    lines.push('### Expected Results');
    lines.push(testCase.expectedResults);
    lines.push('');

    if (testCase.automationScript) {
      lines.push('### Automation Script');
      lines.push('');
      lines.push('```typescript');
      lines.push(testCase.automationScript);
      lines.push('```');
      lines.push('');
    }

    lines.push(`---`);
    lines.push(
      `*Generated by Test Monitor Tool | ID: ${testCase.id}*`
    );

    return lines.join('\n');
  }

  // --- Private helpers ---

  /**
   * Publish a raw markdown comment to a GitHub issue.
   */
  async publishComment(issueLink: string, body: string): Promise<PublishResult> {
    const parsed = this.parseGitHubIssueUrl(issueLink);
    if (!parsed) return { success: false, error: `Invalid GitHub issue URL: ${issueLink}` };

    const config = this.configManager.getConfig();
    const octokit = new Octokit({ auth: config.issueApiToken || undefined });

    try {
      const { data } = await octokit.rest.issues.createComment({
        owner: parsed.owner,
        repo: parsed.repo,
        issue_number: parsed.issueNumber,
        body,
      });
      return { success: true, commentId: String(data.id) };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  }

  private parseGitHubIssueUrl(
    url: string
  ): { owner: string; repo: string; issueNumber: number } | null {
    const match = url.match(GITHUB_ISSUE_URL_REGEX);
    if (!match) return null;
    return {
      owner: match[1],
      repo: match[2],
      issueNumber: parseInt(match[3], 10),
    };
  }

  private findExistingComment(
    issueLink: string,
    testCaseId: string
  ): { commentId: string } | null {
    try {
      const db = getDatabase();
      const row = db
        .prepare(
          'SELECT comment_id FROM issue_comments WHERE issue_link = ? AND test_case_id = ?'
        )
        .get(issueLink, testCaseId) as
        | { comment_id: string }
        | undefined;
      if (row) {
        return { commentId: row.comment_id };
      }
    } catch {
      // DB not available, treat as no existing comment
    }
    return null;
  }

  private saveCommentRecord(
    testCaseId: string,
    issueLink: string,
    commentId: string
  ): void {
    try {
      const db = getDatabase();
      const now = new Date().toISOString();
      db.prepare(
        `INSERT INTO issue_comments (id, test_case_id, issue_link, comment_id, published_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(uuidv4(), testCaseId, issueLink, commentId, now, now);
    } catch (err) {
      console.error(`[IssueConnector] Failed to save comment record: ${err}`);
    }
  }

  private updateCommentRecord(
    testCaseId: string,
    issueLink: string,
    commentId: string
  ): void {
    try {
      const db = getDatabase();
      const now = new Date().toISOString();
      db.prepare(
        `UPDATE issue_comments SET updated_at = ? WHERE issue_link = ? AND test_case_id = ?`
      ).run(now, issueLink, testCaseId);
    } catch (err) {
      console.error(
        `[IssueConnector] Failed to update comment record: ${err}`
      );
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
