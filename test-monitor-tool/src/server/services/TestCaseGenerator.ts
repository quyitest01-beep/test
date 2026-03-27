import { v4 as uuidv4 } from 'uuid';
import OpenAI from 'openai';
import type { ConfigManager } from './ConfigManager.js';
import type { FileChangeEvent, IssueInfo, TestCase, TestStep } from '../types/index.js';

const TEST_TITLE_REGEX = /\b(?:test|it)\s*\(\s*(['"`])(.+?)\1/;

const SYSTEM_PROMPT = `你是一个专业的自动化测试工程师。你的任务是基于 Playwright 录制的原始测试脚本和 Issue 需求描述，生成更完善的测试用例。

你需要：
1. 分析原始录制脚本的操作流程
2. 结合 Issue 需求描述，理解测试目标
3. 生成增强版的 Playwright 测试脚本，包含：
   - 合理的 expect 断言（验证页面状态、元素可见性、文本内容等）
   - 必要的等待逻辑（waitForSelector, waitForURL 等）
   - 错误场景的处理
   - 清晰的测试步骤注释
4. 提取结构化的测试步骤和预期结果

请严格按照以下 JSON 格式返回（不要包含 markdown 代码块标记）：
{
  "title": "测试用例标题",
  "preconditions": "前置条件描述",
  "steps": [{"order": 1, "action": "操作描述", "expected": "预期结果"}],
  "expectedResults": "总体预期结果",
  "enhancedScript": "增强后的完整 Playwright 测试脚本代码"
}`;

export class TestCaseGenerator {
  private configManager: ConfigManager;

  constructor(configManager: ConfigManager) {
    this.configManager = configManager;
  }

  /**
   * Generate a complete TestCase.
   * AI enhancement is ONLY used when issueInfo is provided (user explicitly linked an issue).
   * Without issue info, always use basic parsing to preserve the original script as-is.
   */
  async generate(specFile: FileChangeEvent, issueInfo: IssueInfo | null): Promise<TestCase> {
    const config = this.configManager.getConfig();

    // Only use AI when we have issue info — this is the "enhance" step
    if (issueInfo && config.aiProvider === 'openai' && config.aiApiKey) {
      try {
        return await this.generateWithAI(specFile, issueInfo);
      } catch (err) {
        console.warn(`[TestCaseGenerator] AI generation failed, falling back to basic: ${err}`);
        return this.generateBasic(specFile, issueInfo);
      }
    }

    return this.generateBasic(specFile, issueInfo);
  }

  /**
   * Use LLM to generate an enhanced test case from the original script + issue info.
   */
  private async generateWithAI(specFile: FileChangeEvent, issueInfo: IssueInfo | null): Promise<TestCase> {
    const config = this.configManager.getConfig();
    const now = new Date();

    const openai = new OpenAI({
      apiKey: config.aiApiKey,
      baseURL: config.aiBaseUrl || 'https://api.openai.com/v1',
    });

    let userPrompt = `## 原始 Playwright 录制脚本\n\n文件名: ${specFile.fileName}\n\n\`\`\`typescript\n${specFile.content}\n\`\`\`\n`;

    if (issueInfo) {
      userPrompt += `\n## Issue 需求信息\n\n- 标题: ${issueInfo.title}\n- 描述: ${issueInfo.description}\n- 标签: ${issueInfo.labels.join(', ')}\n- 链接: ${issueInfo.url}\n`;
    } else {
      userPrompt += `\n## Issue 信息\n\n暂无关联 Issue，请根据脚本内容推断测试目标。\n`;
    }

    userPrompt += `\n请基于以上信息，生成增强版的测试用例。`;

    const response = await openai.chat.completions.create({
      model: config.aiModel || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      throw new Error('AI returned empty response');
    }

    // Parse the JSON response (strip markdown code block if present)
    const jsonStr = content.replace(/^```json?\s*\n?/, '').replace(/\n?```\s*$/, '');
    const parsed = JSON.parse(jsonStr) as {
      title: string;
      preconditions: string;
      steps: TestStep[];
      expectedResults: string;
      enhancedScript: string;
    };

    const missingFields: string[] = [];
    let status: TestCase['status'] = 'complete';

    if (!issueInfo) {
      status = 'pending_info';
      missingFields.push('issueLink');
    }

    return {
      id: uuidv4(),
      title: issueInfo ? `[${issueInfo.title}] ${parsed.title}` : parsed.title,
      issueLink: issueInfo?.url ?? null,
      preconditions: parsed.preconditions || issueInfo?.description || '',
      steps: parsed.steps || [],
      expectedResults: parsed.expectedResults || '',
      automationScript: parsed.enhancedScript || specFile.content,
      status,
      missingFields,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Basic fallback: parse the spec file without AI.
   */
  private generateBasic(specFile: FileChangeEvent, issueInfo: IssueInfo | null): TestCase {
    const now = new Date();
    const steps = this.extractSteps(specFile.content);
    const missingFields: string[] = [];

    // Use filename (without .spec.ts) as primary title
    const baseName = specFile.fileName.replace(/\.spec\.ts$/, '');
    let title: string;
    let preconditions: string;
    let issueLink: string | null;
    let status: TestCase['status'];

    if (issueInfo) {
      title = `[${issueInfo.title}] ${baseName}`;
      preconditions = issueInfo.description || '';
      issueLink = issueInfo.url;
      status = 'complete';
    } else {
      title = baseName;
      preconditions = '';
      issueLink = null;
      status = 'pending_info';
      missingFields.push('issueLink', 'preconditions');
    }

    return {
      id: uuidv4(),
      title,
      issueLink,
      preconditions,
      steps,
      expectedResults: `All ${steps.length} test steps complete successfully`,
      automationScript: specFile.content,
      status,
      missingFields,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Regenerate the automation script based on updated test case fields.
   * Uses AI to produce a new script that matches the updated steps/preconditions.
   */
  async regenerateScript(testCase: {
    title: string;
    preconditions: string;
    steps: TestStep[];
    expectedResults: string;
    automationScript: string;
  }): Promise<string> {
    const config = this.configManager.getConfig();

    if (!config.aiApiKey) {
      throw new Error('AI API key not configured');
    }

    const openai = new OpenAI({
      apiKey: config.aiApiKey,
      baseURL: config.aiBaseUrl || 'https://api.openai.com/v1',
    });

    const stepsText = testCase.steps
      .map((s) => `${s.order}. ${s.action} → 预期: ${s.expected}`)
      .join('\n');

    const userPrompt = `## 当前自动化脚本\n\n\`\`\`typescript\n${testCase.automationScript}\n\`\`\`\n\n## 更新后的测试用例信息\n\n- 标题: ${testCase.title}\n- 前置条件: ${testCase.preconditions}\n- 测试步骤:\n${stepsText}\n- 预期结果: ${testCase.expectedResults}\n\n请根据更新后的测试步骤和前置条件，修改自动化脚本使其与新的测试步骤一致。保持原有的代码风格和 import 语句。只返回完整的 Playwright 测试脚本代码，不要包含任何 markdown 标记或解释文字。`;

    const response = await openai.chat.completions.create({
      model: config.aiModel || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: '你是一个专业的 Playwright 自动化测试工程师。你的任务是根据用户提供的测试步骤修改现有的自动化测试脚本。只返回完整的代码，不要包含任何 markdown 代码块标记或解释。' },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      throw new Error('AI returned empty response');
    }

    // Strip markdown code block if present
    return content.replace(/^```(?:typescript|ts)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }

  private extractTestTitle(content: string): string | null {
    const match = content.match(TEST_TITLE_REGEX);
    return match ? match[2] : null;
  }

  private extractSteps(content: string): TestStep[] {
    const PAGE_ACTION_REGEX = /(?:page|locator)\s*\.\s*(goto|click|fill|check|uncheck|selectOption|hover|press|type|dblclick|focus|waitForSelector|waitForURL|getByRole|getByText|getByLabel)\s*\(([^)]*)\)/g;
    const steps: TestStep[] = [];
    let order = 1;

    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('//')) continue;
      PAGE_ACTION_REGEX.lastIndex = 0;
      const match = PAGE_ACTION_REGEX.exec(trimmed);
      if (match) {
        const cleanArgs = match[2].replace(/['"`,]/g, '').trim();
        steps.push({ order: order++, action: `${match[1]}: ${cleanArgs}`, expected: '操作成功' });
      }
    }

    if (steps.length === 0) {
      steps.push({ order: 1, action: '执行自动化测试脚本', expected: '脚本执行成功' });
    }
    return steps;
  }
}
