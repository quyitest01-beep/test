# AI SQL 生成 Prompt（优化版 - 基于知识库）

## 设计理念

**核心原则**：Prompt 简短，规则在知识库
- Prompt 只提供基本指导
- 详细规则和 SQL 模板放在知识库中
- AI 主要从知识库中学习

## Prompt配置

### Text Prompt（优化版）
```
=请根据知识库文档内容生成SQL语句。

**输入数据**：
- knowledgeDocUrl：{{ $json.knowledgeDocUrl || '' }}
- matchedScenarioId：{{ $json.matchedScenarioId || '' }}
- queryRequirement：{{ JSON.stringify($json.queryRequirement) }}
- text：{{ $json.text || '' }}
- id：{{ $json.id || '' }}

**执行步骤**：
1. 调用工具"获取指定知识库"，获取知识库文档内容
2. **仔细阅读知识库文档中的规则和 SQL 模板**
3. 根据知识库规则和 queryRequirement，生成最终的 SQL
4. 如果工具调用失败，基于 matchedScenarioId 直接生成 SQL

**输出要求**：
- 输出纯 JSON 格式（不使用 markdown 代码块）
- 必须包含：matchedScenarioId、finalSQL、reason、queryRequirement、以及所有上游字段
- 必须输出结果，不要输出空结果
```

### System Message（优化版）
```
你是一个SQL生成助手。你的任务是根据知识库文档内容生成SQL语句。

**核心原则**：
1. **优先使用知识库中的 SQL 模板和规则**：知识库文档中包含详细的规则说明和 SQL 模板，请仔细阅读并遵循
2. **如果无法获取知识库内容**：基于 matchedScenarioId 和 queryRequirement 直接生成 SQL
3. **必须输出结果**：无论工具调用是否成功，都必须生成 SQL 并输出结果，不要输出空结果

**处理流程**：
1. 调用工具获取知识库文档内容
2. 从文档中提取 SQL 模板和规则说明（特别注意分组规则）
3. 根据 queryRequirement 替换模板中的变量
4. 生成最终的 SQL 语句

**输出格式**：
输出纯 JSON，包含 matchedScenarioId、finalSQL、reason、queryRequirement 和所有上游字段（type、senderid、messagid、chatid、text、id）。
```

## 知识库内容优化建议

### 1. 在知识库文档中添加详细规则

每个场景的知识库文档应该包含：
- **分组规则**：明确说明何时使用 `game_code` 分组，何时使用 `'ALL' AS game_code`
- **SQL 模板**：提供多个模板示例（按不同维度分组）
- **变量替换规则**：说明如何处理时间格式转换等
- **常见错误**：列出常见错误和正确做法

### 2. 示例：S13 知识库文档结构

```markdown
# S13 累计投注额

## 分组规则（重要）

### 游戏维度分组
- 如果需求说"按游戏、币种维度区分" → 必须使用 `game_code` 分组
- 如果需求只说"所有游戏的累计投注额"（没有"按游戏"） → 使用 `'ALL' AS game_code`

### 商户维度分组
- 如果需求说"按商户、游戏、币种维度区分" → 包含 merchant
- 如果需求只说"按游戏、币种维度区分" → 不包含 merchant

## SQL 模板

### 模板1：按游戏、币种维度
```sql
SELECT game_code, currency, SUM(amount) AS total_amount
FROM ...
GROUP BY game_code, currency
```

### 模板2：不按游戏维度
```sql
SELECT 'ALL' AS game_code, currency, SUM(amount) AS total_amount
FROM ...
GROUP BY currency
```
```

## 优势对比

### 当前方案（Prompt 很长）
- ❌ Prompt 太长，AI 可能忽略关键信息
- ❌ 规则修改需要更新 Prompt
- ❌ 不同场景的规则混在一起

### 优化方案（规则在知识库）
- ✅ Prompt 简短，易于理解
- ✅ 规则在知识库，易于维护
- ✅ 不同场景有独立的规则说明
- ✅ AI 主要从知识库学习，更准确

## 迁移建议

1. **第一步**：优化知识库文档，添加详细规则
2. **第二步**：使用简化版 Prompt 测试
3. **第三步**：根据测试结果调整知识库内容

