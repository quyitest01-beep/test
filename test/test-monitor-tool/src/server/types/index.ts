export interface FileChangeEvent {
  type: 'add' | 'change';
  filePath: string;
  fileName: string;
  content: string;
  timestamp: Date;
}

export interface IssueInfo {
  title: string;
  description: string;
  labels: string[];
  url: string;
}

export interface PublishResult {
  success: boolean;
  commentId?: string;
  error?: string;
}

export interface TestCase {
  id: string;
  title: string;
  issueLink: string | null;
  preconditions: string;
  steps: TestStep[];
  expectedResults: string;
  automationScript: string;
  status: 'complete' | 'pending_info' | 'pending_publish';
  missingFields: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface TestStep {
  order: number;
  action: string;
  expected: string;
}

export interface TestCaseFilter {
  name?: string;
  issueLink?: string;
  status?: string;
  module?: string;
}

export interface TestCaseTree {
  name: string;
  path: string;
  children: (TestCaseTree | TestCaseLeaf)[];
}

export interface TestCaseLeaf {
  id: string;
  name: string;
  status: string;
  issueLink: string | null;
  lastRunAt: Date | null;
}

export interface TestCaseMetadata {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  issueLink: string | null;
  runStatus: 'passed' | 'failed' | 'skipped' | 'not_run';
  lastRunAt: Date | null;
}

export interface TestRunResult {
  testCaseId: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  errorMessage?: string;
  screenshot?: string;
  screenshots?: Array<{ step: number; path: string }>;
  logs: string;
}

export interface TestRunSummary {
  totalCount: number;
  passedCount: number;
  failedCount: number;
  skippedCount: number;
  totalDuration: number;
  results: TestRunResult[];
}

export interface RunningStatus {
  isRunning: boolean;
  currentTestCase: string;
  progress: number;
  total: number;
  completed: number;
}

export interface AppConfig {
  watchDir: string;
  issueProvider: 'github' | 'jira';
  issueApiUrl: string;
  issueApiToken: string;
  issueRepo?: string;
  testCaseDir: string;
  serverPort: number;
  retryCount: number;
  retryInterval: number;
  aiProvider: 'openai' | 'none';
  aiApiKey: string;
  aiModel: string;
  aiBaseUrl: string;
  testEnv: 'staging' | 'production';
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}
