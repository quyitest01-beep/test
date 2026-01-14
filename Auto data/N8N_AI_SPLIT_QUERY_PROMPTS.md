# n8n AI 节点提示词配置（拆分查询）

## 📋 节点结构

```
识别需要拆分的请求 (Code节点)
    ↓
分析拆分查数维度 (AI节点 + Tool: 获取拆分逻辑文档)
    ↓
输出拆分SQL (AI节点 + Tool: 获取拆分逻辑文档)
```

---

## 🔍 AI 节点 1：分析拆分查数维度

### 节点配置

**节点类型**：`@n8n/n8n-nodes-langchain.agent`  
**节点名称**：`分析拆分查数维度`  
**类型版本**：`2.2`

**工具配置**：
- 已连接 Tool Workflow：`Call '获取拆分逻辑文档'`
- 该工具会返回拆分处理知识库内容（`SPLIT_QUERY_KNOWLEDGE_BASE.md`）

### Prompt 配置

**Prompt Type**: `define`  
**Has Output Parser**: `true`

#### Prompt 内容

```
请根据以下信息分析查询请求，判断是否需要拆分以及拆分策略。

**重要**：请先调用"获取拆分逻辑文档"工具，获取拆分处理知识库内容，然后根据知识库中的规则进行分析。

输入数据：
- 原始查询文本：{{ $json.text }}
- 商户号：{{ $json.originalQuery?.merchant_id || '' }}
- 时间范围：{{ $json.originalQuery?.timeRange || '' }}
- 文件大小：{{ $json.estimatedFileSize || '' }}
- 上下文消息：{{ JSON.stringify($json.contextMessages || []) }}
- 上一条AI回复：{{ $json.context?.lastAiReply || '' }}
- 上一条用户消息：{{ $json.context?.previousMessage || '' }}
- last_sql：{{ $json.contextMessages?.[0]?.sql || '' }}
- type：{{ $json.type || 'unknown' }}
- senderid：{{ $json.senderid || 0 }}
- messagid：{{ $json.messagid || 0 }}
- chatid：{{ $json.chatid || '' }}

请按照以下步骤分析：

1. **获取拆分规则**：
   - 调用"获取拆分逻辑文档"工具，获取拆分处理知识库内容
   - 仔细阅读知识库中的拆分规则、适用场景和判断逻辑

2. **分析查询需求**：
   - 提取查询意图（查什么）
   - 提取查询条件（商户号、时间范围、游戏ID、玩家ID等）
   - 如果 `last_sql` 不为空，分析其中的 WHERE 条件，提取：
     * 时间范围：`hour BETWEEN 'YYYYMMDDHH' AND 'YYYYMMDDHH'`
     * 商户号：`merchant_id = 'xxx'`
     * 游戏代码：`game_code = 'xxx'`
     * 其他条件：`provider IN (...)`、`currency = 'xxx'` 等

3. **判断是否需要拆分**（参考知识库规则）：
   - 如果文件大小超过 100MB，建议拆分
   - 如果时间范围超过 7 天，建议拆分
   - 如果查询条件复杂且数据量大，建议拆分
   - 如果信息不足（缺少时间范围、商户号），无法拆分

4. **确定拆分策略**（参考知识库中的拆分维度说明）：
   - 根据知识库中的规则，选择最合适的拆分维度
   - 优先考虑时间维度（如果时间范围大）
   - 其次考虑业务维度（商户、游戏、货币等）
   - 最后考虑组合拆分（多维度）

5. **计算拆分数量**（参考知识库规则）：
   - 根据选择的拆分维度，计算拆分数量
   - 确保拆分数量合理（建议 2-50 个，最多不超过 100 个）

6. **输出格式**（必须是纯 JSON，不要用 markdown 代码块）：

如果**可以拆分**，输出：
{
  "canSplit": true,
  "splitStrategy": "date_range" | "hour_range" | "merchant_range" | "game_range" | "provider_range" | "currency_range" | "user_range" | "combined",
  "splitDimension": "day" | "hour" | "merchant" | "game" | "provider" | "currency" | "user" | "combined",
  "splitCount": 31,
  "timeRange": {
    "startDate": "2025-10-01",
    "endDate": "2025-10-31",
    "startTime": "2025-10-01 00:00:00",
    "endTime": "2025-10-31 23:59:59"
  },
  "queryConditions": {
    "merchant_id": "1716179958" | ["1716179958", "1716179959"] | null,
    "game_id": null | "gp_superace" | ["gp_superace", "gp_crash_73"],
    "game_code": null | "gp_superace" | ["gp_superace", "gp_crash_73"],
    "player_id": null | "123456" | ["123456", "789012"],
    "uid": null | "123456" | ["123456", "789012"],
    "provider": "gp,popular" | ["gp", "popular"] | null,
    "currency": null | "USD" | ["USD", "PHP", "THB"],
    "otherConditions": {}
  },
  "splitDetails": {
    "merchantList": ["1716179958", "1716179959"] | null,
    "gameList": ["gp_superace", "gp_crash_73"] | null,
    "providerList": ["gp", "popular"] | null,
    "currencyList": ["USD", "PHP"] | null,
    "userBatchSize": 50 | null
  },
  "originalQuery": {
    "text": "原样保留",
    "merchant_id": "原样保留",
    "timeRange": "原样保留"
  },
  "reason": "说明拆分策略和拆分原因（参考知识库规则）",
  "chatid": "{{ $json.chatid }}",
  "senderid": "{{ $json.senderid }}",
  "messagid": "{{ $json.messagid }}",
  "type": "{{ $json.type }}"
}

如果**无法拆分**，输出：
{
  "canSplit": false,
  "reason": "说明无法拆分的原因（缺少时间范围、商户号等）",
  "requiredFields": ["缺失的字段列表"],
  "suggestedQuestion": "建议用户补充的信息",
  "chatid": "{{ $json.chatid }}",
  "senderid": "{{ $json.senderid }}",
  "messagid": "{{ $json.messagid }}",
  "type": "{{ $json.type }}"
}
```

#### System Message

```
你是一个查询分析助手，熟悉 AWS Athena gmp.game_records 表。

你的任务是：
1. 通过调用"获取拆分逻辑文档"工具，获取拆分处理知识库内容
2. 根据知识库中的规则，分析查询请求，判断是否需要拆分
3. 确定最佳的拆分策略（按时间/按商户/按游戏/按提供商/按货币/按用户/组合拆分）
4. 提取查询条件（商户号、时间范围、游戏代码、货币类型、用户ID等）
5. 计算拆分数量

关键要求：
- **必须调用"获取拆分逻辑文档"工具**，获取知识库内容后再进行分析
- 必须保留所有上游字段（chatid、senderid、messagid、type等）
- 输出必须是纯 JSON 格式，不要使用 markdown 代码块
- 如果信息不足，必须明确说明缺少哪些字段
- 拆分策略要合理，避免拆分过细（> 100个）或过粗（< 2个）
- 优先选择数据量最大的维度进行拆分，以最大化减少单个查询的数据量
```

---

## 🎯 AI 节点 2：输出拆分SQL

### 节点配置

**节点类型**：`@n8n/n8n-nodes-langchain.agent`  
**节点名称**：`输出拆分SQL`  
**类型版本**：`2.2`

**工具配置**：
- 已连接 Tool Workflow：`Call '获取拆分逻辑文档'1`
- 该工具会返回拆分处理知识库内容（`SPLIT_QUERY_KNOWLEDGE_BASE.md`）

### Prompt 配置

**Prompt Type**: `define`  
**Has Output Parser**: `true`

#### Prompt 内容

```
请根据拆分维度信息和原始 SQL，生成具体的 SQL 拆分计划。

**重要**：请先调用"获取拆分逻辑文档"工具，获取拆分处理知识库内容，然后根据知识库中的 SQL 生成规则进行拆分。

输入数据（来自上游AI节点和原始数据）：
- **拆分策略**：{{ $json.splitStrategy }}
- **拆分维度**：{{ $json.splitDimension }}
- **拆分数量**：{{ $json.splitCount }}
- **时间范围**：{{ JSON.stringify($json.timeRange) }}
- **查询条件**：{{ JSON.stringify($json.queryConditions) }}
- **拆分详情**：{{ JSON.stringify($json.splitDetails) }}
- **原始查询**：{{ JSON.stringify($json.originalQuery) }}
- **原始 SQL**（关键！必须使用此SQL作为拆分基础）：
  {{ $json.originalQuery?.contextMessages?.[0]?.sql || $json.contextMessages?.[0]?.sql || $json.last_sql || '' }}
- **上下文消息**（包含原始SQL）：{{ JSON.stringify($json.originalQuery?.contextMessages || $json.contextMessages || []) }}
- chatid：{{ $json.chatid }}
- senderid：{{ $json.senderid }}
- messagid：{{ $json.messagid }}
- type：{{ $json.type }}

**重要提示**：
- 如果 `$json.originalQuery.contextMessages[0].sql` 存在，使用它作为原始SQL
- 如果不存在，尝试 `$json.contextMessages[0].sql`
- 如果都不存在，尝试 `$json.last_sql`
- **必须找到原始SQL**，否则无法进行拆分

请按照以下要求生成拆分计划：

1. **获取拆分规则**：
   - 调用"获取拆分逻辑文档"工具，获取拆分处理知识库内容
   - 仔细阅读知识库中的 SQL 生成规则和拆分示例

2. **分析原始 SQL**（**关键步骤**）：
   - **必须找到并基于原始 SQL 进行拆分，不要重新生成 SQL**
   - 原始 SQL 可能在以下位置：
     * `$json.originalQuery.contextMessages[0].sql`
     * `$json.contextMessages[0].sql`
     * `$json.last_sql`
   - 如果找不到原始 SQL，输出错误信息，说明无法进行拆分
   - 分析原始 SQL 的 WHERE 条件，提取：
     * 时间范围：`hour BETWEEN 'YYYYMMDDHH' AND 'YYYYMMDDHH'`
     * 商户号：`merchant_id = 'xxx'`
     * 游戏代码：`game_code = 'xxx'`
     * 其他条件：`provider IN (...)`、`currency = 'xxx'` 等
   - **完全保留**原始 SQL 的所有部分：
     * SELECT 字段列表（保持不变）
     * ORDER BY 子句（保持不变）
     * 所有其他 WHERE 条件（保持不变）

3. **根据拆分维度生成拆分计划**（参考知识库规则）：

   **时间维度拆分**（date_range / hour_range）：
   - 如果 `splitDimension` 是 "day"，按天拆分，每天一个查询
   - 如果 `splitDimension` 是 "hour"，按小时拆分，每小时一个查询
   - 确保所有拆分查询覆盖完整的时间范围，不遗漏任何数据
   - **只修改** `hour BETWEEN ...` 的时间范围部分

   **商户维度拆分**（merchant_range）：
   - 根据 `splitDetails.merchantList` 中的商户列表，每个商户生成一个查询
   - 每个查询的 WHERE 条件包含 `merchant_id = 'xxx'`
   - **保持**原始 SQL 的其他所有条件

   **游戏维度拆分**（game_range）：
   - 根据 `splitDetails.gameList` 中的游戏列表，每个游戏生成一个查询
   - 每个查询的 WHERE 条件包含 `game_code = 'xxx'`
   - **保持**原始 SQL 的其他所有条件

   **提供商维度拆分**（provider_range）：
   - 根据 `splitDetails.providerList` 或 `queryConditions.provider`，每个提供商生成一个查询
   - 每个查询的 WHERE 条件包含 `provider = 'xxx'`（而不是 `IN`）
   - **保持**原始 SQL 的其他所有条件

   **货币维度拆分**（currency_range）：
   - 根据 `splitDetails.currencyList` 中的货币列表，每种货币生成一个查询
   - 每个查询的 WHERE 条件包含 `currency = 'xxx'`
   - **保持**原始 SQL 的其他所有条件

   **用户维度拆分**（user_range）：
   - 根据 `queryConditions.uid` 和 `splitDetails.userBatchSize`，每批用户生成一个查询
   - 每个查询的 WHERE 条件包含 `uid IN ('user1', 'user2', ...)`（每批 50-100 个用户）
   - **保持**原始 SQL 的其他所有条件

   **组合拆分**（combined）：
   - 如果涉及多个维度（如时间 + 商户），生成所有组合的查询
   - 例如：5个商户 × 31天 = 155个查询
   - **保持**原始 SQL 的其他所有条件

4. **生成 SQL 拆分计划**：
   - **必须基于原始 SQL 进行拆分**，不要重新生成 SQL
   - 如果原始 SQL 的时间范围不完整（如只覆盖1天，但用户查询的是整个月），需要扩展到完整的时间范围
   - 每个拆分查询必须：
     * **完全保留**原始 SQL 的 SELECT 字段列表
     * **完全保留**原始 SQL 的 ORDER BY 子句
     * **完全保留**原始 SQL 的所有其他 WHERE 条件
     * **只修改**需要拆分的部分（时间范围、商户号、游戏代码等）

5. **输出格式**（必须是纯 JSON，不要用 markdown 代码块）：

{
  "canSplit": true,
  "splitStrategy": "{{ $json.splitStrategy }}",
  "splitCount": {{ $json.splitCount }},
  "splitPlan": [
    {
      "part": 1,
      "startDate": "2025-10-01",
      "endDate": "2025-10-01",
      "startTime": "2025-10-01 00:00:00",
      "endTime": "2025-10-01 23:59:59",
      "hourStart": "2025100100",
      "hourEnd": "2025100123",
      "description": "2025年10月1日的数据",
      "sql": "基于原始 SQL，只修改 hour BETWEEN 部分，其他完全保持不变"
    },
    {
      "part": 2,
      "startDate": "2025-10-02",
      "endDate": "2025-10-02",
      "startTime": "2025-10-02 00:00:00",
      "endTime": "2025-10-02 23:59:59",
      "hourStart": "2025100200",
      "hourEnd": "2025100223",
      "description": "2025年10月2日的数据",
      "sql": "基于原始 SQL，只修改 hour BETWEEN 部分，其他完全保持不变"
    }
    // ... 更多拆分计划
  ],
  "originalQuery": {{ JSON.stringify($json.originalQuery) }},
  "reason": "说明拆分策略和拆分计划（参考知识库规则）",
  "chatid": "{{ $json.chatid }}",
  "senderid": "{{ $json.senderid }}",
  "messagid": "{{ $json.messagid }}",
  "type": "{{ $json.type }}"
}

关键要求：
- **必须调用"获取拆分逻辑文档"工具**，获取知识库内容后再生成 SQL
- **必须基于原始 SQL（`contextMessages[0].sql`）进行拆分，不要重新生成 SQL**
- 分析原始 SQL 的 WHERE 条件，提取时间范围、商户号等
- **完全保留**原始 SQL 的 SELECT 字段列表和 ORDER BY 子句
- **完全保留**原始 SQL 的所有其他 WHERE 条件
- **只修改**需要拆分的部分（时间范围、商户号、游戏代码等）
- 如果原始 SQL 的时间范围不完整，需要扩展到完整的时间范围
- 每个 splitPlan 项必须包含完整的 SQL 语句
- SQL 中的 `hour` 分区必须使用 YYYYMMDDHH 格式
- 确保所有拆分查询覆盖完整的数据范围
```

#### System Message

```
你是一个 SQL 拆分生成助手，熟悉 AWS Athena gmp.game_records 表。

你的任务是：
1. 通过调用"获取拆分逻辑文档"工具，获取拆分处理知识库内容
2. 根据知识库中的 SQL 生成规则，基于原始 SQL 生成拆分计划
3. 确保每个拆分查询包含完整的 SQL 语句
4. 确保所有拆分查询覆盖完整的数据范围（时间、商户、游戏、货币、用户等）

**核心原则**：
- **必须调用"获取拆分逻辑文档"工具**，获取知识库内容后再生成 SQL
- **必须找到原始 SQL**：
  * 优先使用：`$json.originalSQL`（这是上游 Code 节点准备好的字段）
  * 如果为空，从 `$json.originalData.contextMessages[0].sql` 查找
  * 如果仍为空，从 `$json.originalData.originalQuery.contextMessages[0].sql` 查找
  * **如果都找不到，必须输出错误信息，说明无法找到原始 SQL**
- **必须基于原始 SQL 进行拆分，不要重新生成 SQL**
- 分析原始 SQL 的 WHERE 条件，提取时间范围、商户号、游戏代码等
- **完全保留**原始 SQL 的 SELECT 字段列表
- **完全保留**原始 SQL 的 ORDER BY 子句
- **完全保留**原始 SQL 的所有其他 WHERE 条件
- **只修改**需要拆分的部分（时间范围、商户号、游戏代码等）
- 如果原始 SQL 的时间范围不完整（如只覆盖1天：`hour BETWEEN '2025100100' AND '2025100123'`），但用户查询的是整个月（10月），需要扩展到完整的时间范围（10月1日到10月31日），然后按天拆分
- **如果找不到原始 SQL，必须输出错误信息，不要尝试重新生成**

支持的拆分维度（参考知识库）：
- date_range（按天拆分）：每天一个查询，覆盖完整时间范围
- hour_range（按小时拆分）：每小时一个查询，覆盖完整时间范围
- merchant_range（按商户拆分）：每个商户一个查询
- game_range（按游戏拆分）：每个游戏一个查询
- provider_range（按提供商拆分）：每个提供商一个查询（使用 `provider = 'xxx'` 而不是 `IN`）
- currency_range（按货币拆分）：每种货币一个查询
- user_range（按用户拆分）：每批用户一个查询（每批 50-100 个用户，使用 `uid IN (...)`）
- combined（组合拆分）：多个维度的组合（如时间 + 商户）

关键要求：
- SQL 中的 `hour` 分区必须使用 YYYYMMDDHH 格式（例如：'2025100100' 到 '2025100123'）
- 必须保留原始 SQL 中的所有条件（除非是按提供商拆分，则修改 `provider` 条件）
- 根据拆分维度，修改或添加对应的过滤条件（时间范围、merchant_id、game_code、currency、uid 等）
- 输出必须是纯 JSON 格式，不要使用 markdown 代码块
- 每个 splitPlan 项必须包含完整的 SQL 语句
```

---

## 🔧 Code 节点：解析拆分维度判断结果

### 功能
- 解析第一个 AI 节点的输出（可能是 JSON 字符串）
- 提取拆分维度信息
- 提取原始 SQL（从 `contextMessages[0].sql`）
- 为第二个 AI 节点准备完整的数据

### 代码文件
`n8n-workflows/parse-split-dimension-result.js`

### 工作流位置
```
[AI 节点 1：分析拆分查数维度]
    ↓
[Code 节点：解析拆分维度判断结果] ← 新增
    ↓
[AI 节点 2：输出拆分SQL]
```

---

## 📝 配置步骤

### 1. 添加 Code 节点：解析拆分维度判断结果

在"分析拆分查数维度"和"输出拆分SQL"之间添加 Code 节点：

1. **节点类型**：Code 节点
2. **节点名称**：`解析拆分维度判断结果`
3. **代码**：复制 `n8n-workflows/parse-split-dimension-result.js` 的内容

### 2. 配置 AI 节点 1：分析拆分查数维度

1. **设置 Prompt Type**：`define`
2. **设置 Has Output Parser**：`true`
3. **设置 Prompt 内容**：复制上面的 Prompt 内容
4. **设置 System Message**：复制上面的 System Message
5. **连接 Tool Workflow**：确保 `Call '获取拆分逻辑文档'` 已连接到该节点的 `ai_tool` 输入

### 2. 配置 AI 节点 2：输出拆分SQL

1. **设置 Prompt Type**：`define`
2. **设置 Has Output Parser**：`true`
3. **设置 Prompt 内容**：复制上面的 Prompt 内容
4. **设置 System Message**：复制上面的 System Message
5. **连接 Tool Workflow**：确保 `Call '获取拆分逻辑文档'1` 已连接到该节点的 `ai_tool` 输入

### 3. 确保 Tool Workflow 正确配置

**Tool Workflow 名称**：`获取拆分逻辑文档`

该工作流应该：
- 读取 `ai-scenarios/SPLIT_QUERY_KNOWLEDGE_BASE.md` 文件
- 返回知识库内容给 AI 节点

---

## 🔍 工作流程

```
输入数据（包含 contextMessages[0].sql）
    ↓
[识别需要拆分的请求] (Code节点)
    ↓
[分析拆分查数维度] (AI节点)
    ├── 调用 Tool: 获取拆分逻辑文档
    ├── 分析查询需求
    ├── 判断是否需要拆分
    ├── 确定拆分策略（参考知识库）
    └── 输出拆分维度信息（JSON字符串）
    ↓
[解析拆分维度判断结果] (Code节点) ← 新增
    ├── 解析第一个 AI 的 JSON 输出
    ├── 提取拆分维度信息
    ├── 提取原始 SQL（contextMessages[0].sql）
    └── 准备第二个 AI 的输入数据
    ↓
[输出拆分SQL] (AI节点)
    ├── 调用 Tool: 获取拆分逻辑文档
    ├── 分析原始 SQL（originalSQL 字段）
    ├── 基于原始 SQL + 拆分维度生成拆分计划
    └── 输出拆分 SQL 列表
```

---

## ⚠️ 关键注意事项

1. **必须调用知识库工具**：
   - 两个 AI 节点都必须先调用"获取拆分逻辑文档"工具
   - 根据知识库内容进行判断和生成

2. **必须基于原始 SQL**：
   - 第二个 AI 节点必须使用 `contextMessages[0].sql` 作为基础
   - 不要重新生成 SQL，只修改需要拆分的部分

3. **完全保留原始 SQL 结构**：
   - SELECT 字段列表
   - ORDER BY 子句
   - 所有其他 WHERE 条件

4. **只修改拆分部分**：
   - 时间维度：只修改 `hour BETWEEN ...`
   - 商户维度：添加或修改 `merchant_id = 'xxx'`
   - 其他维度：相应修改

---

## 📚 相关文档

- `ai-scenarios/SPLIT_QUERY_KNOWLEDGE_BASE.md` - 拆分处理知识库
- `N8N_SPLIT_QUERY_TWO_STAGE_AI.md` - 两阶段 AI 架构配置指南

