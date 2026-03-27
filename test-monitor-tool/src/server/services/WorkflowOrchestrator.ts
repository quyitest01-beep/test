import type { MonitorService } from './MonitorService.js';
import type { IssueConnector } from './IssueConnector.js';
import type { TestCaseGenerator } from './TestCaseGenerator.js';
import type { TestCaseManager } from './TestCaseManager.js';
import type { FileChangeEvent, IssueInfo, TestCase } from '../types/index.js';
import { getDatabase } from '../db/database.js';

export interface WorkflowResult {
  success: boolean;
  testCaseId?: string;
  status?: TestCase['status'];
  error?: string;
}

export class WorkflowOrchestrator {
  private monitorService: MonitorService;
  private issueConnector: IssueConnector;
  private testCaseGenerator: TestCaseGenerator;
  private testCaseManager: TestCaseManager;

  constructor(deps: {
    monitorService: MonitorService;
    issueConnector: IssueConnector;
    testCaseGenerator: TestCaseGenerator;
    testCaseManager: TestCaseManager;
  }) {
    this.monitorService = deps.monitorService;
    this.issueConnector = deps.issueConnector;
    this.testCaseGenerator = deps.testCaseGenerator;
    this.testCaseManager = deps.testCaseManager;
  }

  /**
   * Register the workflow callback on MonitorService's file change event.
   * Each file change triggers the full pipeline:
   *   extract issue → fetch issue info → generate test case → save → publish
   */
  start(): void {
    this.monitorService.onFileChange((event: FileChangeEvent) => {
      this.handleFileChange(event).catch((err) => {
        console.error(
          `[WorkflowOrchestrator] Unhandled error in workflow for ${event.fileName}: ${err}`
        );
      });
    });
    console.info('[WorkflowOrchestrator] Workflow registered on MonitorService.');
  }

  /**
   * Process a single file change event through the full pipeline.
   */
  async handleFileChange(event: FileChangeEvent): Promise<WorkflowResult> {
    console.info(
      `[WorkflowOrchestrator] Processing file change: ${event.fileName} (${event.type})`
    );

    // Dedup: check if this source file already has a test case in the DB
    const existing = this.findExistingBySourcePath(event.filePath);
    if (existing) {
      if (event.type === 'add') {
        console.info(
          `[WorkflowOrchestrator] Skipping ${event.fileName} — already imported as test case ${existing}`
        );
        return { success: true, testCaseId: existing, status: 'complete' };
      }
      // For 'change' events, update the existing test case
      console.info(
        `[WorkflowOrchestrator] File changed, updating existing test case ${existing}`
      );
    }

    // Step 1: Extract issue link from file
    let issueLink: string | null = null;
    try {
      issueLink = this.issueConnector.extractIssueLink(
        event.fileName,
        event.content
      );
      if (issueLink) {
        console.info(
          `[WorkflowOrchestrator] Extracted issue link: ${issueLink}`
        );
      } else {
        console.warn(
          `[WorkflowOrchestrator] No issue link found in ${event.fileName}, will generate without issue info.`
        );
      }
    } catch (err) {
      console.warn(
        `[WorkflowOrchestrator] Failed to extract issue link from ${event.fileName}: ${err}`
      );
    }

    // Step 2: Fetch issue info (if link was extracted)
    let issueInfo: IssueInfo | null = null;
    if (issueLink) {
      try {
        issueInfo = await this.issueConnector.fetchIssueInfo(issueLink);
        console.info(
          `[WorkflowOrchestrator] Fetched issue info: "${issueInfo.title}"`
        );
      } catch (err) {
        console.warn(
          `[WorkflowOrchestrator] Failed to fetch issue info for ${issueLink}: ${err}. Generating test case without issue info.`
        );
        // Issue system unreachable — proceed without issue info (pending_info)
        issueInfo = null;
      }
    }

    // Step 3: Generate test case
    let testCase: TestCase;
    try {
      testCase = await this.testCaseGenerator.generate(event, issueInfo);
      console.info(
        `[WorkflowOrchestrator] Generated test case: "${testCase.title}" (status: ${testCase.status})`
      );
    } catch (err) {
      const errorMsg = `Failed to generate test case for ${event.fileName}: ${err}`;
      console.error(`[WorkflowOrchestrator] ${errorMsg}`);
      return { success: false, error: errorMsg };
    }

    // Step 4: Save test case
    try {
      await this.testCaseManager.save(testCase, event.filePath);
      console.info(
        `[WorkflowOrchestrator] Saved test case: ${testCase.id}`
      );
    } catch (err) {
      const errorMsg = `Failed to save test case ${testCase.id}: ${err}`;
      console.error(`[WorkflowOrchestrator] ${errorMsg}`);
      return { success: false, testCaseId: testCase.id, error: errorMsg };
    }

    // Step 5: Publish to issue (only if we have a valid issue link and issue info)
    if (testCase.issueLink && issueInfo) {
      try {
        const publishResult = await this.issueConnector.publishTestCase(
          testCase.issueLink,
          testCase
        );

        if (publishResult.success) {
          console.info(
            `[WorkflowOrchestrator] Published test case to issue: ${testCase.issueLink} (comment: ${publishResult.commentId})`
          );
        } else {
          console.warn(
            `[WorkflowOrchestrator] Publish failed for ${testCase.issueLink}: ${publishResult.error}. Marking as pending_publish.`
          );
          await this.markPendingPublish(testCase.id);
          return {
            success: true,
            testCaseId: testCase.id,
            status: 'pending_publish',
          };
        }
      } catch (err) {
        console.warn(
          `[WorkflowOrchestrator] Publish threw for ${testCase.issueLink}: ${err}. Marking as pending_publish.`
        );
        await this.markPendingPublish(testCase.id);
        return {
          success: true,
          testCaseId: testCase.id,
          status: 'pending_publish',
        };
      }
    }

    return {
      success: true,
      testCaseId: testCase.id,
      status: testCase.status,
    };
  }

  /**
   * Update a test case status to pending_publish when publishing fails.
   */
  private async markPendingPublish(testCaseId: string): Promise<void> {
    try {
      await this.testCaseManager.update(testCaseId, {
        status: 'pending_publish',
      });
    } catch (err) {
      console.error(
        `[WorkflowOrchestrator] Failed to mark test case ${testCaseId} as pending_publish: ${err}`
      );
    }
  }

  /**
   * Check if a test case already exists for the given source file path.
   */
  private findExistingBySourcePath(filePath: string): string | null {
    try {
      const db = getDatabase();
      const row = db.prepare(
        'SELECT id FROM test_cases WHERE source_path = ? LIMIT 1'
      ).get(filePath) as { id: string } | undefined;
      return row?.id ?? null;
    } catch {
      return null;
    }
  }
}
