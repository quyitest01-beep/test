# n8n AI Agent Structured Output Parser Schema 配置指南

## 配置步骤

### 步骤1：准备 Schema 文件

使用已创建的 `ai-output-schema-markdown.json` 文件，内容如下：

```json
{
  "type": "object",
  "properties": {
    "markdown": {
      "type": "string",
      "description": "完整的Markdown格式业务分析报告文本内容，必须包含所有章节和表格"
    },
    "reportType": {
      "type": "string",
      "enum": ["weekly", "daily", "monthly"],
      "description": "报告类型"
    },
    "currentPeriod": {
      "type": "string",
      "description": "当前周期，格式：20251027-20251102"
    },
    "previousPeriod": {
      "type": "string",
      "description": "上一周期，格式：20251020-20251026"
    },
    "metadata": {
      "type": "object",
      "properties": {
        "timestamp": {
          "type": "string",
          "format": "date-time",
          "description": "报告生成时间"
        },
        "hasNewGames": {
          "type": "boolean",
          "description": "是否有新游戏"
        }
      }
    }
  },
  "required": ["markdown", "reportType", "currentPeriod"],
  "additionalProperties": false
}
```

### 步骤2：在 n8n 中配置 AI Agent 节点

1. **添加 AI Agent 节点**
   - 在 n8n 工作流中添加 "AI Agent" 节点

2. **配置 Credentials（凭据）**
   - 选择或创建 OpenAI/Anthropic 等 AI 服务的凭据
   - 确保凭据已正确配置

3. **配置 Output Parser（输出解析器）**
   - 在 AI Agent 节点设置中找到 "Output Parser" 选项
   - 选择 **"Structured Output Parser"**

4. **配置 Schema（JSON Schema）**
   - 在 "Structured Output Parser" 设置中，找到 "Schema" 或 "JSON Schema" 字段
   - 有两种方式配置 Schema：

   **方式A：直接粘贴 JSON（推荐）**
   ```
   1. 打开 ai-output-schema-markdown.json 文件
   2. 复制全部内容
   3. 在 n8n 的 Schema 字段中粘贴
   ```

   **方式B：使用表达式（如果 Schema 来自其他节点）**
   ```
   如果 Schema 需要动态生成，可以使用表达式：
   {{ $json.schema }}
   ```

5. **配置 System Message（系统消息）**
   - 在 AI Agent 节点的 "System Message" 字段中
   - 使用 `business-report-ai-agent-prompt-json.txt` 的内容
   - 或者直接粘贴以下内容：

   ```
   你是一个专业的业务数据分析专家，分析游戏平台业务数据，生成专业的业务分析报告。

   【重要】输出格式要求：
   - 必须输出JSON格式，使用Structured Output Parser
   - JSON必须包含`markdown`字段，该字段包含完整的Markdown格式报告
   - 其他字段（reportType、currentPeriod等）为元数据，可选
   
   ...（完整提示词内容）
   ```

6. **配置 Prompt（提示词）**
   - 在 "Prompt" 字段中，可以引用输入数据：
   ```
   分析以下业务数据：{{ $json.content }}
   ```
   或者使用 Code 节点预处理数据后传入

### 步骤3：配置输入数据

**方式A：使用 Code 节点预处理数据**
```javascript
// 在 AI Agent 节点之前添加 Code 节点
const items = $input.all();

// 处理数据
const processedData = items.map(item => ({
  json: {
    content: item.json  // 你的业务数据
  }
}));

return processedData;
```

**方式B：直接在 AI Agent 中引用**
- 在 Prompt 字段中使用表达式引用数据：
```
分析以下业务数据：{{ $json }}
```

### 步骤4：测试配置

1. **运行工作流**
   - 点击 "Execute Workflow" 或 "Test workflow"

2. **检查输出**
   - AI Agent 节点应该输出 JSON 格式的数据
   - 检查 `markdown` 字段是否包含完整的 Markdown 报告
   - 检查其他字段（reportType、currentPeriod等）是否正确

3. **验证 Schema**
   - 如果输出不符合 Schema，n8n 会显示错误
   - 检查错误信息，调整 Schema 或提示词

## 常见问题

### Q1: Schema 格式错误怎么办？
**A:** 
- 确保 JSON 格式正确（使用 JSON 验证工具）
- 检查是否缺少必要的字段（required 字段）
- 确保 `additionalProperties: false` 时，输出不包含额外字段

### Q2: AI 输出不符合 Schema 怎么办？
**A:**
1. 检查 System Message 中是否明确要求输出 JSON 格式
2. 确保 Schema 描述清晰，字段类型正确
3. 在提示词中强调必须遵循 Schema
4. 如果某个字段总是出错，可以将其设为可选（从 required 中移除）

### Q3: 如何调试 Schema 配置？
**A:**
1. 先不使用 Schema，测试 AI 输出是否符合预期
2. 逐步添加 Schema 字段，每次测试
3. 查看 AI Agent 节点的错误日志
4. 使用 Code 节点验证输出格式

### Q4: Schema 字段是必需的还是可选的？
**A:**
- `required: ["markdown", "reportType", "currentPeriod"]` 中的字段是必需的
- 其他字段（如 `previousPeriod`、`metadata`）是可选的
- 如果某个字段可能不存在，将其从 required 中移除

### Q5: 如何修改 Schema？
**A:**
1. 修改 `ai-output-schema-markdown.json` 文件
2. 在 n8n 中更新 Schema 配置
3. 同时更新 System Message 中的说明，确保 AI 知道新的字段要求

## 输出示例

配置成功后，AI Agent 节点应该输出如下格式的 JSON：

```json
{
  "markdown": "报告周期信息: 本期 (10.27-11.02) vs 上期 (10.20-10.26)\n\n### 一、总体运营概览\n\n...",
  "reportType": "weekly",
  "currentPeriod": "20251027-20251102",
  "previousPeriod": "20251020-20251026",
  "metadata": {
    "timestamp": "2025-11-05T04:16:49.898Z",
    "hasNewGames": true
  }
}
```

## 后续处理

在 AI Agent 节点之后，使用 Code 节点提取 `markdown` 字段：

```javascript
const items = $input.all();

return items.map(item => ({
  json: {
    output: item.json.markdown,  // 提取 markdown 字段
    metadata: item.json.metadata  // 可选：保留元数据
  }
}));
```

然后传递给 HTML 生成节点（`ai-report-to-html.js`）处理。

## 注意事项

1. **Schema 必须符合 JSON Schema 规范**
   - 使用标准的 JSON Schema 格式
   - 确保类型定义正确（string、number、boolean、object、array）

2. **字段描述要清晰**
   - `description` 字段用于指导 AI 生成内容
   - 描述越详细，AI 输出越准确

3. **required 字段要谨慎**
   - 只将确实必需的字段设为 required
   - 可选字段不要放在 required 中

4. **测试优先**
   - 在生产环境使用前，充分测试 Schema 配置
   - 确保各种输入情况下都能正确输出

