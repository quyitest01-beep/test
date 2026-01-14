# n8n AI Agent Schema 错误排查指南

## 错误：Model output doesn't fit required format

### 问题原因

这个错误表示 AI 输出的 JSON 格式不符合 Schema 定义。可能的原因：

1. **Schema 太严格**：`additionalProperties: false` 不允许额外字段
2. **必需字段缺失**：AI 没有输出 required 字段
3. **字段类型不匹配**：字段类型不符合 Schema 定义
4. **JSON 格式错误**：AI 输出的 JSON 格式不正确
5. **枚举值不匹配**：enum 值不在允许的列表中

### 解决方案

#### 方案1：使用简化 Schema（推荐）

使用 `ai-output-schema-markdown-simple.json`，只要求 `markdown` 字段：

```json
{
  "type": "object",
  "properties": {
    "markdown": {
      "type": "string",
      "description": "完整的Markdown格式业务分析报告文本内容"
    }
  },
  "required": ["markdown"],
  "additionalProperties": true
}
```

**步骤**：
1. 在 n8n 的 Schema 字段中替换为上面的简化 Schema
2. 重新运行工作流
3. 如果成功，再逐步添加其他字段

#### 方案2：放宽 Schema 限制

已优化 `ai-output-schema-markdown.json`：
- ✅ 移除了 `additionalProperties: false`，改为 `true`
- ✅ 只保留 `markdown` 为必需字段
- ✅ 其他字段都设为可选
- ✅ 移除了可能导致问题的 `format: "date-time"`

**更新步骤**：
1. 复制新的 `ai-output-schema-markdown.json` 内容
2. 在 n8n 中更新 Schema 配置
3. 重新运行测试

#### 方案3：调试 AI 输出

**步骤1：暂时不使用 Schema 测试**

1. 在 AI Agent 节点中：
   - 将 Output Parser 改为 "无" 或 "Auto-fixing Output Parser"
   - 运行工作流
   - 查看 AI 实际输出什么

2. 检查输出格式：
   - 是否是有效的 JSON？
   - 是否包含 `markdown` 字段？
   - 是否有其他字段？

**步骤2：逐步添加 Schema**

1. 先使用最简单的 Schema（只有 markdown 字段）
2. 如果成功，再添加其他字段
3. 每次添加一个字段，测试一次

#### 方案4：调整提示词

在 System Message 中强调：

```
【关键要求】：
1. 输出必须是有效的JSON格式
2. JSON必须包含markdown字段（字符串类型）
3. 不要输出任何代码块标记（如```json）
4. 不要输出任何说明文字，只输出JSON对象
5. 确保JSON格式正确：使用双引号，不要有语法错误
```

### 调试步骤

#### 步骤1：检查 Schema 配置

1. **验证 JSON 格式**
   ```bash
   # 使用在线工具验证 JSON 格式
   # https://jsonlint.com/
   ```

2. **检查必需字段**
   - 确保 `required` 数组中的字段 AI 都能生成
   - 如果某个字段可能为空，从 required 中移除

3. **检查字段类型**
   - 确保类型定义正确（string、number、boolean、object、array）
   - 避免使用复杂的 format（如 date-time）

#### 步骤2：测试 AI 输出

1. **不使用 Schema 测试**
   - 暂时移除 Output Parser
   - 查看 AI 实际输出
   - 分析输出格式

2. **使用 Code 节点验证**
   ```javascript
   // 在 AI Agent 节点后添加 Code 节点
   const items = $input.all();
   
   items.forEach((item, index) => {
     console.log(`=== Item ${index + 1} ===`);
     console.log('Type:', typeof item.json);
     console.log('Keys:', Object.keys(item.json));
     console.log('Has markdown:', 'markdown' in item.json);
     
     if (item.json.markdown) {
       console.log('Markdown length:', item.json.markdown.length);
     }
     
     // 尝试解析为 JSON
     try {
       const jsonStr = JSON.stringify(item.json);
       console.log('Valid JSON:', true);
       JSON.parse(jsonStr);
     } catch (e) {
       console.log('JSON Error:', e.message);
     }
   });
   
   return items;
   ```

#### 步骤3：调整 Schema

根据 AI 实际输出调整 Schema：

1. **如果 AI 输出了额外字段**
   - 将 `additionalProperties` 改为 `true`
   - 或者将这些字段添加到 Schema 中

2. **如果某个字段总是缺失**
   - 从 `required` 中移除
   - 或者改进提示词，明确要求生成该字段

3. **如果字段类型不匹配**
   - 检查 Schema 中的类型定义
   - 调整类型或允许多种类型（使用 anyOf）

### 常见错误和解决方案

#### 错误1：缺少必需字段

**错误信息**：`Property 'markdown' is required`

**解决方案**：
- 在提示词中明确要求输出 `markdown` 字段
- 检查提示词是否清晰

#### 错误2：额外字段不被允许

**错误信息**：`Additional properties not allowed`

**解决方案**：
- 将 `additionalProperties` 改为 `true`
- 或者将额外字段添加到 Schema 中

#### 错误3：枚举值不匹配

**错误信息**：`Value must be one of: weekly, daily, monthly`

**解决方案**：
- 将 `reportType` 从 required 中移除
- 或者改进提示词，明确说明可用的枚举值

#### 错误4：JSON 格式错误

**错误信息**：`Invalid JSON format`

**解决方案**：
- 在提示词中强调 JSON 格式要求
- 要求 AI 只输出 JSON，不要输出其他内容

### 推荐配置

**最简单的配置（推荐新手）**：

```json
{
  "type": "object",
  "properties": {
    "markdown": {
      "type": "string",
      "description": "完整的Markdown格式业务分析报告"
    }
  },
  "required": ["markdown"],
  "additionalProperties": true
}
```

**完整配置（推荐有经验后使用）**：

```json
{
  "type": "object",
  "properties": {
    "markdown": {
      "type": "string",
      "description": "完整的Markdown格式业务分析报告文本内容"
    },
    "reportType": {
      "type": "string",
      "enum": ["weekly", "daily", "monthly"],
      "description": "报告类型"
    },
    "currentPeriod": {
      "type": "string",
      "description": "当前周期"
    }
  },
  "required": ["markdown"],
  "additionalProperties": true
}
```

### 测试检查清单

- [ ] Schema JSON 格式正确
- [ ] 只保留最必需的字段在 required 中
- [ ] `additionalProperties` 设置为 `true`
- [ ] 提示词明确要求输出 JSON 格式
- [ ] 提示词强调必须包含 `markdown` 字段
- [ ] 已测试不使用 Schema 的输出
- [ ] 已逐步添加字段测试

### 如果仍然失败

1. **检查 n8n 版本**
   - 确保使用的是最新版本的 n8n
   - Structured Output Parser 可能需要特定版本

2. **检查 AI 模型**
   - 某些模型可能对 Structured Output 支持更好
   - 尝试使用 OpenAI GPT-4 或 Claude

3. **联系支持**
   - 查看 n8n 官方文档
   - 在 n8n 社区寻求帮助

4. **回退方案**
   - 不使用 Structured Output Parser
   - 使用 Markdown 输出方案
   - 在后续节点中手动验证和解析












