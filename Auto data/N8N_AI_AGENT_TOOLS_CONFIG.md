# n8n AI Agent 工具配置说明

## 问题：工具名称冲突

**错误信息**：
```
Problem in node '生成SQL'
You have multiple tools with the same name: '_', please rename them to avoid conflicts
```

## 解决方案

### 1. 检查工具配置

在 n8n 的 AI Agent 节点中，确保每个工具都有唯一的名称：

1. 打开 AI Agent 节点配置
2. 找到 "Tools" 或 "工具" 配置部分
3. 检查是否有多个工具使用了相同的名称
4. 确保每个工具都有唯一的名称（例如：`getKnowledgeBase`、`httpRequest` 等）

### 2. 正确的工具配置示例

#### 方案 A：使用 HTTP Request 工具获取知识库

如果使用 HTTP Request 工具来获取知识库，配置如下：

```json
{
  "tools": [
    {
      "type": "httpRequest",
      "name": "getKnowledgeBase",
      "description": "获取知识库内容，根据查询关键词返回匹配的场景和SQL模板",
      "config": {
        "method": "GET",
        "url": "https://knowledge-api.trytalks.com/v1/web/topic/resource/list/mix",
        "headers": {
          "Authorization": "Bearer YOUR_TOKEN",
          "Content-Type": "application/json"
        },
        "queryParams": {
          "topic_id_alias": "BJ8X5PWJ",
          "resource_type": "2",
          "page": "1"
        }
      }
    }
  ]
}
```

#### 方案 B：使用自定义工具

如果使用自定义工具，确保工具名称唯一：

```json
{
  "tools": [
    {
      "type": "custom",
      "name": "getKnowledgeBase",
      "description": "获取知识库内容"
    },
    {
      "type": "custom",
      "name": "getKnowledgeDoc",
      "description": "根据场景ID获取知识库文档"
    }
  ]
}
```

### 3. 常见错误原因

1. **多个工具使用默认名称**：如果添加了多个工具但没有指定名称，系统可能自动使用 `_` 作为默认名称
2. **工具名称重复**：手动配置的工具名称与其他工具冲突
3. **工具配置格式错误**：工具配置格式不正确，导致系统无法正确识别工具名称

### 4. 修复步骤

1. **删除所有工具**：
   - 在 AI Agent 节点中，找到 Tools 配置
   - 删除所有已配置的工具

2. **重新添加工具**：
   - 添加第一个工具，命名为 `getKnowledgeBase`
   - 如果还需要其他工具，确保每个工具都有唯一的名称

3. **验证配置**：
   - 保存节点配置
   - 检查是否还有错误提示
   - 如果仍有错误，检查是否有其他节点或配置也使用了相同的工具名称

### 5. System Message 配置

**重要**：System Message 中不要包含 markdown 代码块格式，直接使用纯文本。

**错误的 System Message**（包含 markdown）：
```
# AI SQL 生成提示词（整合版）

## System Message（系统提示词）

```
你是一个查数场景识别...
```
```

**正确的 System Message**（纯文本）：
```
你是一个查数场景识别与 SQL 模板生成助手。请严格遵循以下流程：

1. 必须调用工具获取知识库：
   - 在作答前，必须先调用工具 getKnowledgeBase（或你配置的知识库工具），传入本次查询的关键信息（如 text 或提取的关键词），以获取知识库中与 S1~S10 相关的场景配置和 SQL 模板。
   - 若未调用工具，不得输出结果。

2. 读取输入字段：
   - 必须原样使用输入中的 type、senderid、messagid、chatid、text 等字段值，不得改动。
   - 这些字段值必须完全保留在输出中。

...（继续其他内容）
```

### 6. 完整的节点配置示例

```json
{
  "parameters": {
    "promptType": "define",
    "text": "=请根据以下消息信息判断查数场景并生成 SQL。\n\n输入数据（必须使用这些值，不得改动）：\n- type（消息来源）：{{ $json.type || 'unknown' }}\n- senderid（发送者ID）：{{ $json.senderid || 0 }}\n- messagid（消息ID）：{{ $json.messagid || 0 }}\n- chatid（聊天ID）：{{ $json.chatid || '' }}\n- text（消息文本）：{{ $json.text || '' }}",
    "hasOutputParser": true,
    "options": {
      "systemMessage": "你是一个查数场景识别与 SQL 模板生成助手。请严格遵循以下流程：\n\n1. 必须调用工具获取知识库：\n   - 在作答前，必须先调用工具 getKnowledgeBase（或你配置的知识库工具），传入本次查询的关键信息（如 text 或提取的关键词），以获取知识库中与 S1~S10 相关的场景配置和 SQL 模板。\n   - 若未调用工具，不得输出结果。\n\n2. 读取输入字段：\n   - 必须原样使用输入中的 type、senderid、messagid、chatid、text 等字段值，不得改动。\n   - 这些字段值必须完全保留在输出中。\n\n3. 场景匹配与 SQL 生成逻辑：\n   - 优先套用模板：如果知识库返回的场景信息中包含可用的 SQL 模板，则直接套用该模板，并根据用户需求适当补充 WHERE 条件、时间范围等参数。输出 outputType = \"套用模板\"。\n   - 自主生成：如果知识库没有匹配的场景（matchedScenarioId = \"NEW\"）或知识库中没有可用的 SQL 模板，则根据 gmp.game_records 的表结构自行生成 SQL。输出 outputType = \"自主生成\"。\n\n4. SQL 生成规则：\n   - 禁止自主添加 LIMIT：除非用户明确要求限制结果数量，否则不要在 SQL 中添加 LIMIT 子句。\n   - 时间字段转换：使用 FROM_UNIXTIME(created_at / 1000)。\n   - 金额字段四舍五入：使用 ROUND(CAST(amount AS DOUBLE), 2)。\n\n5. 输出格式（必须是纯 JSON）：\n{\n  \"matchedScenarioId\": \"S2 或 NEW\",\n  \"confidence\": 0.0-1.0,\n  \"isKnowledgeBaseMatch\": true/false,\n  \"outputType\": \"套用模板\" 或 \"自主生成\",\n  \"finalSQL\": \"SELECT ...\",\n  \"reason\": \"说明为何匹配该场景或为何需要新场景\",\n  \"knowledgeDocUrl\": \"知识库文档的URL（如果有）\",\n  \"scenarioRecord\": {}\n}\n\n请严格按照以上要求调用工具、读取知识库内容，并返回最终 JSON。"
    },
    "tools": [
      {
        "type": "httpRequest",
        "name": "getKnowledgeBase",
        "description": "获取知识库内容"
      }
    ]
  }
}
```

## 注意事项

1. **工具名称必须唯一**：每个工具都必须有唯一的名称，不能重复
2. **System Message 格式**：不要使用 markdown 代码块，直接使用纯文本
3. **工具调用**：确保工具配置正确，AI 才能正确调用工具
4. **测试验证**：配置完成后，测试节点确保没有错误

## 故障排查

如果仍然遇到工具名称冲突错误：

1. 检查是否有其他节点也配置了相同的工具
2. 检查工作流中是否有多个 AI Agent 节点使用了相同的工具名称
3. 尝试重新创建工作流，确保工具配置正确
4. 检查 n8n 版本，某些版本可能存在工具配置的 bug





