import { v4 as uuidv4 } from 'uuid';
import OpenAI from 'openai';
import type { ConfigManager } from './ConfigManager.js';
import type { FileChangeEvent, IssueInfo, TestCase, TestStep } from '../types/index.js';
import { getDatabase } from '../db/database.js';

const TEST_TITLE_REGEX = /\b(?:test|it)\s*\(\s*(['"`])(.+?)\1/;

const SYSTEM_PROMPT = `你是一个专业的自动化测试工程师。你的任务是基于 Playwright 录制的原始测试脚本和 Issue 需求描述，生成更完善的测试用例。

你需要：
1. 分析原始录制脚本的操作流程
2. 结合 Issue 需求描述，理解测试目标
3. 生成增强版的 Playwright 测试脚本
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
  constructor(configManager: ConfigManager) { this.configManager = configManager; }

  async generate(specFile: FileChangeEvent, issueInfo: IssueInfo | null): Promise<TestCase> {
    const config = this.configManager.getConfig();
    if (issueInfo && config.aiProvider === 'openai' && config.aiApiKey) {
      try { return await this.generateWithAI(specFile, issueInfo); }
      catch (err) { console.warn(`[TestCaseGenerator] AI failed, fallback: ${err}`); return this.generateBasic(specFile, issueInfo); }
    }
    return this.generateBasic(specFile, issueInfo);
  }

  private async generateWithAI(specFile: FileChangeEvent, issueInfo: IssueInfo | null): Promise<TestCase> {
    const config = this.configManager.getConfig();
    const now = new Date();
    const openai = new OpenAI({ apiKey: config.aiApiKey, baseURL: config.aiBaseUrl || 'https://api.openai.com/v1' });

    let userPrompt = `## 原始 Playwright 录制脚本\n\n文件名: ${specFile.fileName}\n\n\`\`\`typescript\n${specFile.content}\n\`\`\`\n`;
    if (issueInfo) {
      userPrompt += `\n## Issue 需求信息\n\n- 标题: ${issueInfo.title}\n- 描述: ${issueInfo.description}\n- 标签: ${issueInfo.labels.join(', ')}\n- 链接: ${issueInfo.url}\n`;
    }
    userPrompt += `\n请基于以上信息，生成增强版的测试用例。`;

    const response = await openai.chat.completions.create({
      model: config.aiModel || 'gpt-4o-mini',
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: userPrompt }],
      temperature: 0.3, max_tokens: 16384,
    });
    const content = response.choices[0]?.message?.content?.trim();
    if (!content) throw new Error('AI returned empty response');
    const jsonStr = content.replace(/^```json?\s*\n?/, '').replace(/\n?```\s*$/, '');
    const parsed = JSON.parse(jsonStr);
    const missingFields: string[] = [];
    let status: TestCase['status'] = 'complete';
    if (!issueInfo) { status = 'pending_info'; missingFields.push('issueLink'); }
    return {
      id: uuidv4(),
      title: issueInfo ? `[${issueInfo.title}] ${parsed.title}` : parsed.title,
      issueLink: issueInfo?.url ?? null,
      preconditions: parsed.preconditions || issueInfo?.description || '',
      steps: parsed.steps || [], expectedResults: parsed.expectedResults || '',
      automationScript: parsed.enhancedScript || specFile.content,
      status, missingFields, createdAt: now, updatedAt: now,
    };
  }

  private generateBasic(specFile: FileChangeEvent, issueInfo: IssueInfo | null): TestCase {
    const now = new Date();
    const steps = this.extractSteps(specFile.content);
    const missingFields: string[] = [];
    const baseName = specFile.fileName.replace(/\.spec\.ts$/, '');
    let title: string, preconditions: string, issueLink: string | null, status: TestCase['status'];
    if (issueInfo) {
      title = `[${issueInfo.title}] ${baseName}`; preconditions = issueInfo.description || '';
      issueLink = issueInfo.url; status = 'complete';
    } else {
      title = baseName; preconditions = ''; issueLink = null;
      status = 'pending_info'; missingFields.push('issueLink', 'preconditions');
    }
    return { id: uuidv4(), title, issueLink, preconditions, steps,
      expectedResults: `All ${steps.length} test steps complete successfully`,
      automationScript: specFile.content, status, missingFields, createdAt: now, updatedAt: now };
  }

  /** Regenerate script from updated steps (no old script reference). */
  async regenerateScript(testCase: {
    title: string; preconditions: string; steps: TestStep[];
    expectedResults: string; automationScript: string;
  }): Promise<string> {
    const config = this.configManager.getConfig();
    if (!config.aiApiKey) throw new Error('AI API key not configured');
    const openai = new OpenAI({ apiKey: config.aiApiKey, baseURL: config.aiBaseUrl || 'https://api.openai.com/v1' });
    const snippetsContext = this.loadSnippetsContext();
    const stepsText = testCase.steps.map(s => `${s.order}. ${s.action} \u2192 预期: ${s.expected}`).join('\n');

    let userPrompt = '';
    if (snippetsContext) userPrompt += `## 测试知识库（请优先使用以下已验证的代码片段和信息）\n\n${snippetsContext}\n\n`;
    userPrompt += `## 测试用例信息\n\n- 标题: ${testCase.title}\n- 前置条件: ${testCase.preconditions}\n- 测试步骤（共 ${testCase.steps.length} 步）:\n${stepsText}\n- 预期结果: ${testCase.expectedResults}\n\n## 要求\n1. 脚本必须严格只实现上面列出的 ${testCase.steps.length} 个测试步骤\n2. 如果知识库中有匹配的代码片段，必须直接使用\n3. 每个步骤用注释标注 "// ===== Step N: 描述 ====="\n4. 每个步骤断言后加截图: await page.screenshot({ path: \`test-results/screenshots/\${testInfo.testId}-step-N.png\`, fullPage: true });\n5. test 回调参数包含 testInfo: async ({ page }, testInfo) => { ... }\n6. 不要添加步骤列表中没有提到的验证逻辑\n7. 只返回完整代码，不要 markdown 标记`;

    const response = await openai.chat.completions.create({
      model: config.aiModel || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: snippetsContext ? '你是专业的 Playwright 测试工程师。优先使用知识库中已验证的代码。只实现用户列出的步骤。只返回代码。' : '你是专业的 Playwright 测试工程师。只实现用户列出的步骤，保持简洁。只返回代码。' },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.2, max_tokens: 16384,
    });
    const content = response.choices[0]?.message?.content?.trim();
    if (!content) throw new Error('AI returned empty response');
    return content.replace(/^```(?:typescript|ts)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }

  /** Fix a failing script based on error message + previous fix history. */
  async fixScript(testCase: {
    title: string; steps: Array<{ order: number; action: string; expected: string }>;
    automationScript: string; errorMessage: string; logs: string;
    previousFixes?: Array<{ explanation: string; error_message: string }>;
  }): Promise<{ script: string; explanation: string }> {
    const config = this.configManager.getConfig();
    if (!config.aiApiKey) throw new Error('AI API key not configured');
    const openai = new OpenAI({ apiKey: config.aiApiKey, baseURL: config.aiBaseUrl || 'https://api.openai.com/v1' });
    const snippetsContext = this.loadSnippetsContext();
    const stepsText = testCase.steps.map(s => `${s.order}. ${s.action} \u2192 预期: ${s.expected}`).join('\n');

    let userPrompt = '';
    if (snippetsContext) userPrompt += `## 测试知识库\n\n${snippetsContext}\n\n`;
    if (testCase.previousFixes && testCase.previousFixes.length > 0) {
      userPrompt += `## \u26a0\ufe0f 之前的修复尝试（都失败了，不要重复这些方案）\n\n`;
      for (const fix of testCase.previousFixes.slice(-5)) {
        userPrompt += `- 修复方案: ${fix.explanation}\n  结果错误: ${fix.error_message}\n`;
      }
      userPrompt += `\n请采用完全不同的修复策略。\n\n`;
    }
    userPrompt += `## 当前脚本（运行失败）\n\n\`\`\`typescript\n${testCase.automationScript}\n\`\`\`\n\n## 错误信息\n\n${testCase.errorMessage}\n\n${testCase.logs ? `## 运行日志\n\n${testCase.logs.substring(0, 1000)}` : ''}\n\n## 测试步骤\n\n${stepsText}\n\n## 要求\n\n请以 JSON 格式返回（不要 markdown 标记）：\n{\n  "explanation": "用中文简要说明错误原因和修复内容（2-3句话）",\n  "script": "修复后的完整 Playwright 代码"\n}\n\n修复规则：\n1. 必须严格使用知识库中已验证的选择器和流程\n2. 不要使用 text=/R\\\\$/ 正则文本选择器\n3. 不要使用 waitForLoadState('networkidle')\n4. 确保所有括号、引号正确闭合\n5. 每个步骤后保留截图代码\n6. 确保代码完整可运行`;

    const response = await openai.chat.completions.create({
      model: config.aiModel || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: '你是专业的 Playwright 测试工程师。修复失败的测试脚本。优先使用知识库中已验证的代码。返回严格 JSON 格式，包含 explanation 和 script 字段。' },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.2, max_tokens: 16384,
    });
    const content = response.choices[0]?.message?.content?.trim();
    if (!content) throw new Error('AI returned empty response');
    const jsonStr = content.replace(/^```json?\s*\n?/, '').replace(/\n?```\s*$/, '');
    try {
      const parsed = JSON.parse(jsonStr);
      return { explanation: parsed.explanation || '已修复脚本', script: (parsed.script || '').replace(/^```(?:typescript|ts)?\s*\n?/, '').replace(/\n?```\s*$/, '') };
    } catch {
      return { explanation: '已修复脚本（AI 未返回结构化说明）', script: content.replace(/^```(?:typescript|ts)?\s*\n?/, '').replace(/\n?```\s*$/, '') };
    }
  }

  /** Regenerate steps + script from issue requirements. */
  async regenerateFromIssue(issueInfo: { title: string; description: string; labels: string[]; url: string }, existingTitle: string): Promise<{
    title: string; preconditions: string; steps: TestStep[]; expectedResults: string; automationScript: string;
  }> {
    const config = this.configManager.getConfig();
    if (!config.aiApiKey) throw new Error('AI API key not configured');
    const openai = new OpenAI({ apiKey: config.aiApiKey, baseURL: config.aiBaseUrl || 'https://api.openai.com/v1' });
    const snippetsContext = this.loadSnippetsContext();

    let userPrompt = '';
    if (snippetsContext) userPrompt += `## 测试知识库\n\n${snippetsContext}\n\n`;

    // Truncate issue description to avoid overwhelming the AI with technical details
    const descTruncated = issueInfo.description.length > 3000
      ? issueInfo.description.substring(0, 3000) + '\n\n... (内容已截断)'
      : issueInfo.description;

    userPrompt += `## Issue 需求信息

- 标题: ${issueInfo.title}
- 标签: ${issueInfo.labels.join(', ')}
- 链接: ${issueInfo.url}
- 描述:
${descTruncated}

## 要求

请根据 Issue 需求，生成面向 UI 的端到端测试用例。

重要规则：
1. 只关注 Issue 中与用户界面操作相关的需求（页面访问、按钮点击、表单填写、数据展示验证等）
2. 忽略 Issue 中的数据库 schema、SQL 查询、后端代码路径等技术实现细节
3. 前置条件只写测试需要的前提（如：需要登录、需要特定账户余额等），不要复制 Issue 原文
4. 测试步骤要简洁明确，每步只做一个操作
5. 步骤数量控制在 3-8 步，不要太多
6. 优先使用知识库中已验证的代码片段
7. 每个步骤加截图: await page.screenshot(...)
8. test 回调含 testInfo: async ({ page }, testInfo) => { ... }

返回 JSON（不要 markdown 标记）：
{
  "title": "简短的测试用例标题",
  "preconditions": "简洁的前置条件（2-3句话）",
  "steps": [{"order": 1, "action": "操作描述", "expected": "预期结果"}],
  "expectedResults": "总体预期结果（1-2句话）",
  "automationScript": "完整 Playwright 代码"
}`;

    const response = await openai.chat.completions.create({
      model: config.aiModel || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: '你是专业的 Playwright UI 测试工程师。根据 Issue 需求生成简洁的端到端测试用例。只关注用户界面操作，忽略后端实现细节。前置条件要简洁（不要复制 Issue 原文），步骤控制在 3-8 步。优先使用知识库代码。返回严格 JSON。' },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.2, max_tokens: 16384,
    });
    const content = response.choices[0]?.message?.content?.trim();
    if (!content) throw new Error('AI returned empty response');
    const jsonStr = content.replace(/^```json?\s*\n?/, '').replace(/\n?```\s*$/, '');
    const parsed = JSON.parse(jsonStr);
    return {
      title: `[${issueInfo.title}] ${parsed.title || existingTitle}`,
      preconditions: parsed.preconditions || '', steps: parsed.steps || [],
      expectedResults: parsed.expectedResults || '',
      automationScript: (parsed.automationScript || parsed.enhancedScript || '').replace(/^```(?:typescript|ts)?\s*\n?/, '').replace(/\n?```\s*$/, ''),
    };
  }

  /** Generate acceptance report. */
  async generateReport(testCase: {
    title: string; preconditions: string; steps: Array<{ order: number; action: string; expected: string }>;
    expectedResults: string; issueLink: string | null;
  }, runResult: { status: string; duration: number; runAt?: string }): Promise<string> {
    const config = this.configManager.getConfig();
    if (!config.aiApiKey) throw new Error('AI API key not configured');
    const openai = new OpenAI({ apiKey: config.aiApiKey, baseURL: config.aiBaseUrl || 'https://api.openai.com/v1' });
    const stepsText = testCase.steps.map(s => `${s.order}. ${s.action} \u2192 预期: ${s.expected}`).join('\n');
    const userPrompt = `请根据以下测试用例和运行结果，生成简洁的验收测试报告（Markdown 格式，中文）。\n\n## 测试用例\n- 标题: ${testCase.title}\n- 前置条件: ${testCase.preconditions}\n- 测试步骤:\n${stepsText}\n- 预期结果: ${testCase.expectedResults}\n\n## 运行结果\n- 状态: ${runResult.status === 'passed' ? '\u2705 通过' : '\u274c 失败'}\n- 耗时: ${runResult.duration}ms\n- 运行时间: ${runResult.runAt || '未知'}\n\n报告要求：包含测试概要、步骤执行情况表格、结论。保持简洁专业。直接返回 Markdown。`;

    const response = await openai.chat.completions.create({
      model: config.aiModel || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: '你是专业 QA 工程师，撰写简洁专业的测试验收报告。直接返回 Markdown。' },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3, max_tokens: 16384,
    });
    const content = response.choices[0]?.message?.content?.trim();
    if (!content) throw new Error('AI returned empty response');
    return content.replace(/^```markdown?\s*\n?/, '').replace(/\n?```\s*$/, '');
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
    if (steps.length === 0) steps.push({ order: 1, action: '执行自动化测试脚本', expected: '脚本执行成功' });
    return steps;
  }

  /** Load knowledge base snippets filtered by current test environment. */
  private loadSnippetsContext(): string {
    try {
      const db = getDatabase();
      const config = this.configManager.getConfig();
      const env = config.testEnv || 'staging';
      const rows = db.prepare(
        "SELECT category, name, description, code, env FROM test_snippets WHERE env IN (?, 'all') ORDER BY category, name"
      ).all(env) as Array<{ category: string; name: string; description: string | null; code: string; env: string }>;
      if (rows.length === 0) return '';
      const grouped = new Map<string, typeof rows>();
      for (const row of rows) { const list = grouped.get(row.category) || []; list.push(row); grouped.set(row.category, list); }
      const envLabel = env === 'staging' ? '测试环境 (staging)' : '正式环境 (production)';
      let context = `> 当前测试环境: ${envLabel}，请严格使用以下配置。\n\n`;
      for (const [category, items] of grouped) {
        context += `### ${category}\n\n`;
        for (const item of items) {
          context += `**${item.name}**\n`;
          if (item.description) context += `${item.description}\n`;
          context += `\`\`\`typescript\n${item.code}\n\`\`\`\n\n`;
        }
      }
      return context;
    } catch (err) { console.warn('[TestCaseGenerator] Failed to load snippets:', err); return ''; }
  }
}
