# n8n AI Agent节点配置指南

## 你的节点配置分析

根据你提供的节点配置：
```json
{
  "type": "@n8n/n8n-nodes-langchain.agent",
  "typeVersion": 2.2,
  "parameters": {
    "hasOutputParser": true,
    "options": {}
  }
}
```

**配置基本正确，但缺少关键字段。** 需要添加以下配置：

## 完整配置步骤

### 1. 打开AI Agent节点配置面板

在n8n编辑器中，双击或点击你的AI Agent节点，打开配置面板。

### 2. 配置关键字段

#### **必需字段：**

1. **Credential（凭证）**
   - 点击 `Credential` 下拉菜单
   - 选择或创建你的LLM凭证（OpenAI、Anthropic等）
   - 确保API Key已正确配置

2. **Agent Type（代理类型）**
   - 选择 `OpenAI Functions` 或 `ReAct`
   - 推荐：`OpenAI Functions`（功能更强大）

3. **System Message（系统消息）**
   - 在配置面板中找到 `System Message` 或 `Instructions` 字段
   - 如果找不到，可能在 `Options` 或 `Advanced` 选项卡中
   - **将 `backend/business-report-ai-agent-prompt.md` 文件的完整内容复制到这里**

4. **Prompt（用户消息/任务描述）**
   - 找到 `Prompt` 或 `User Message` 或 `Task` 字段
   - 输入以下内容：

```javascript
请按照业务数据分析规则，分析以下Merge13.json数据并输出JSON格式的分析结果：

{{ JSON.stringify($json, null, 2) }}
```

### 3. 完整节点配置示例（JSON格式）

配置完成后，节点配置应该类似这样：

```json
{
  "parameters": {
    "credential": {
      "id": "your-llm-credential-id",
      "name": "OpenAI"
    },
    "agent": "openAIFunctionsAgent",
    "promptType": "define",
    "text": "请按照业务数据分析规则，分析以下Merge13.json数据并输出JSON格式的分析结果：\n\n{{ JSON.stringify($json, null, 2) }}",
    "systemMessage": "[将business-report-ai-agent-prompt.md的完整内容粘贴到这里]",
    "options": {
      "maxIterations": 5,
      "systemMessage": "[System Message内容]"
    },
    "hasOutputParser": true,
    "outputParser": "json"
  },
  "type": "@n8n/n8n-nodes-langchain.agent",
  "typeVersion": 2.2
}
```

## 如何在n8n界面中找到这些字段

### 方法1：标准配置面板

1. 双击AI Agent节点
2. 查看配置面板的各个选项卡：
   - **基础配置**：Credential、Agent Type
   - **Prompt/Message**：System Message、Prompt
   - **Options/Advanced**：Output Parser、Max Iterations等

### 方法2：如果找不到System Message字段

有些版本的n8n中，System Message可能在：
- `Options` → `System Message`
- `Advanced` → `System Message`
- `Agent Settings` → `System Message`
- 或者直接在 `Options` 中添加自定义字段

### 方法3：使用表达式编辑器

如果字段支持表达式，可以使用：
- `{{ $json }}` - 当前输入数据
- `{{ $input.all() }}` - 所有输入项
- `{{ JSON.stringify($json) }}` - 转换为JSON字符串

## System Message内容（复制以下完整内容）

**重要：** 将以下完整内容复制到 `System Message` 字段中：

[这里应该包含完整的System Message内容，但由于长度限制，请直接打开 `backend/business-report-ai-agent-prompt.md` 文件，复制从"你是一个专业的业务数据分析专家"开始到文件末尾的所有内容]

或者使用文件内容的前几行作为提示，完整内容请查看文件。

## Prompt内容（用户消息）

在 `Prompt` 或 `User Message` 字段中输入：

```
请按照业务数据分析规则，分析以下Merge13.json数据并输出JSON格式的分析结果：

{{ JSON.stringify($json, null, 2) }}
```

如果输入是数组格式，使用：

```
请分析以下Merge13.json数据：

{{ JSON.stringify($input.all().map(item => item.json), null, 2) }}
```

## 连接数据流

确保你的工作流连接正确：

```
[数据源] → [数据预处理] → AI Agent → [结果处理] → [输出]
```

例如：
- `Webhook` / `Manual Trigger` → `Code节点`（格式化数据）→ `AI Agent` → `Code节点`（验证结果）→ `Webhook Response`

## 测试配置

1. 点击节点右上角的"测试"按钮
2. 或者执行整个工作流
3. 检查输出是否符合预期JSON格式

## 常见问题

### Q1: 找不到System Message字段怎么办？
**答：** 
- 检查n8n版本，更新到最新版本
- 在 `Options` 或 `Advanced` 选项卡中查找
- 尝试在 `Options` 中添加自定义 `systemMessage` 字段

### Q2: AI返回的不是JSON格式？
**答：**
- 在System Message中明确要求输出JSON
- 在Prompt中强调"输出JSON格式的分析结果"
- 启用 `hasOutputParser: true` 并选择JSON解析器

### Q3: 如何传递Merge13.json数据？
**答：**
- 在前置节点（如Code节点）中将数据格式化为JSON
- 在Prompt中使用 `{{ $json }}` 或 `{{ JSON.stringify($json) }}`
- 确保数据是有效的JSON格式

### Q4: 节点执行失败？
**答：**
- 检查Credential配置是否正确
- 检查输入数据格式是否正确
- 查看执行日志中的错误信息
- 确保API配额未用完

## 推荐的工作流结构

```
1. Manual Trigger（手动触发测试）
   ↓
2. Code节点 - 数据预处理
   - 读取Merge13.json
   - 格式化数据
   ↓
3. AI Agent节点 - 业务数据分析
   - System Message: [完整提示词]
   - Prompt: [用户消息]
   ↓
4. Code节点 - 结果验证
   - 验证JSON格式
   - 格式化输出
   ↓
5. Webhook Response / 存储节点
   - 返回结果
```

## 注意事项

1. **数据大小限制**：如果数据太大，可能需要分批处理
2. **API限制**：注意LLM API的token限制
3. **成本控制**：AI Agent调用会产生费用，注意监控
4. **错误处理**：添加错误处理节点捕获异常

---

**完整提示词内容**：请查看 `backend/business-report-ai-agent-prompt.md` 文件

