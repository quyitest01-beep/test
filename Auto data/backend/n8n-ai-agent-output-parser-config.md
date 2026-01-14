# n8n AI Agent Output Parser 配置指南

## 方案1：不使用 Output Parser（推荐）⭐

### 配置步骤：
1. 在 AI Agent 节点的 "Output Parsers" 部分
2. **不选择任何 Output Parser**（保持默认或无选择）
3. 让 AI Agent 直接输出原始 Markdown 文本

### 工作流配置：
```
AI Agent（无 Output Parser）
  ↓
输出：纯 Markdown 文本
  ↓
Code 节点（ai-output-validator.js）- 可选
  ↓
Code 节点（ai-report-to-html.js）
  ↓
HTML 输出
```

### 优点：
- ✅ 输出为纯 Markdown 文本，符合 System Message 要求
- ✅ 不需要额外转换步骤
- ✅ 灵活性高，可以完全控制输出格式

---

## 方案2：使用 Structured Output Parser（如果需要结构化输出）

### 配置步骤：

1. **选择 Output Parser**
   - 选择 "**Structured Output Parser**"
   - 不要选择 "Auto-fixing Output Parser"（已废弃）
   - 不要选择 "Item List Output Parser"（会拆分输出）

2. **配置 JSON Schema**
   - Schema Type: "Generate From JSON Example"
   - JSON Example: 粘贴以下内容：

```json
{
  "output": "Markdown格式的业务分析报告文本内容"
}
```

3. **更新 System Message**
   - 如果使用 Structured Output Parser，需要调整 System Message
   - 让 AI 输出 JSON 格式：`{"output": "Markdown内容"}`
   - 然后在后续节点中提取 `json.output` 字段

### 工作流配置：
```
AI Agent（Structured Output Parser）
  ↓
输出：{"output": "Markdown文本"}
  ↓
Code 节点（提取 json.output）
  ↓
Code 节点（ai-report-to-html.js）
  ↓
HTML 输出
```

### 优点：
- ✅ 输出格式统一，便于验证
- ✅ 可以添加额外的元数据字段

### 缺点：
- ❌ 需要修改 System Message，让 AI 输出 JSON
- ❌ 需要额外的提取步骤

---

## 方案3：使用 Item List Output Parser（不推荐）

❌ **不推荐**：这个选项会将输出拆分成多个项目，不适合单一报告输出。

---

## 推荐配置（方案1）

### 完整配置步骤：

1. **AI Agent 节点配置**
   - System Message: 使用 `business-report-ai-agent-prompt-n8n.txt` 的内容
   - Output Parsers: **不选择任何选项**（保持默认）
   - Prompt: 简单的任务说明，如 "分析业务数据并生成Markdown报告"

2. **后续节点配置**
   ```
   AI Agent
     ↓
   Code 节点（ai-output-validator.js）- 可选，用于验证和优化
     ↓
   Code 节点（ai-report-to-html.js）- 转换为HTML
     ↓
   输出节点或PDF生成
   ```

3. **数据提取（在 Code 节点中）**
   ```javascript
   // 从 AI Agent 输出中提取 Markdown
   const aiOutput = $input.first().json.output || 
                    $input.first().json.content || 
                    $input.first().json.text ||
                    $input.first().json;
   ```

---

## 常见问题

### Q1: 如果必须使用 Structured Output Parser 怎么办？

**A:** 需要修改 System Message，在最后添加：
```
输出格式要求：必须输出 JSON 格式，格式如下：
{
  "output": "你的Markdown报告内容"
}
```

然后在后续 Code 节点中提取 `json.output`。

### Q2: 如何验证输出格式？

**A:** 在 AI Agent 节点后添加一个 Code 节点，输出检查：
```javascript
const output = $input.first().json;
console.log("输出类型:", typeof output);
console.log("输出内容:", JSON.stringify(output).substring(0, 200));
return [{json: {debug: output}}];
```

### Q3: Output Parser 会影响性能吗？

**A:** 
- 不使用 Output Parser：性能最好，输出最快
- 使用 Structured Output Parser：会有轻微性能开销，但提供了格式验证

---

## 最终建议

**推荐使用方案1（不使用 Output Parser）**，因为：
1. ✅ 符合当前 System Message 的要求（直接输出 Markdown）
2. ✅ 不需要修改现有配置
3. ✅ 输出格式更灵活
4. ✅ 后续处理更简单

如果你的 n8n 版本要求必须选择 Output Parser，则使用方案2，并相应调整 System Message。












