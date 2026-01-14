# 优化后的SQL拆分提示词

## 关键修改点

1. **在开头强调递归拆分策略**
2. **明确说明"每次最多拆成2个查询"**
3. **提供一个月（31天）的拆分示例**
4. **强调不要一次性生成所有天的查询**

---

请根据拆分维度信息和原始 SQL，生成具体的 SQL 拆分计划。

**⚠️ 重要：递归拆分策略（必须遵守）**

**核心原则**：**每次最多拆成两个查询**，采用递归拆分策略，逐步细化。**不要一次性生成所有天的查询！**

### 递归拆分规则（必须严格遵守）：

1. **超过一个月（> 30天）**：
   - **只拆成2个查询**：前15天 + 后N天
   - **不要**拆成每天一个查询！
   - 示例：31天 → **只拆成2个**：前15天（2025100100-2025101523）+ 后16天（2025101600-2025103123）
   - 后续会递归拆分这两个查询

2. **15天左右（10-20天）**：
   - **只拆成2个查询**：前7天 + 后N天
   - 示例：15天 → **只拆成2个**：前7天 + 后8天

3. **一周左右（5-9天）**：
   - **只拆成2个查询**：前3天 + 后N天
   - 示例：7天 → **只拆成2个**：前3天 + 后4天

4. **3-4天**：
   - 拆成每天一个查询（这是唯一可以拆成多个查询的情况）
   - 示例：3天 → 3个查询（每天一个）

5. **单天（1天）**：
   - **只拆成2个查询**：00-12点 + 13-23点

### 一个月（31天）的拆分示例：

**❌ 错误做法**：直接拆成31个查询（每天一个）
```json
{
  "splitPlan": [
    { "part": 1, "hourStart": "2025100100", "hourEnd": "2025100123", ... },
    { "part": 2, "hourStart": "2025100200", "hourEnd": "2025100223", ... },
    // ... 31个查询（错误！）
  ]
}
```

**✅ 正确做法**：只拆成2个查询（递归拆分）
```json
{
  "splitPlan": [
    {
      "part": 1,
      "startDate": "2025-10-01",
      "endDate": "2025-10-15",
      "hourStart": "2025100100",
      "hourEnd": "2025101523",
      "description": "前15天（会继续递归拆分）",
      "sql": "基于原始SQL，只修改 hour BETWEEN '2025100100' AND '2025101523'"
    },
    {
      "part": 2,
      "startDate": "2025-10-16",
      "endDate": "2025-10-31",
      "hourStart": "2025101600",
      "hourEnd": "2025103123",
      "description": "后16天（会继续递归拆分）",
      "sql": "基于原始SQL，只修改 hour BETWEEN '2025101600' AND '2025103123'"
    }
  ],
  "splitCount": 2,  // 注意：只有2个，不是31个！
  "isRecursive": true,
  "nextSplitLevel": "前15天和后16天会继续递归拆分，直到每个查询覆盖3-4天或更少"
}
```

**重要提示**：
- **必须调用"获取拆分逻辑文档"工具**，获取知识库内容后再生成 SQL
- **必须基于原始 SQL（`contextMessages[0].sql`）进行拆分，不要重新生成 SQL**
- **每次最多拆成2个查询**（除了3-4天的情况）
- **不要一次性生成所有天的查询**（如31天不要拆成31个查询）
- 分析原始 SQL 的 WHERE 条件，提取时间范围、商户号等
- **完全保留**原始 SQL 的 SELECT 字段列表和 ORDER BY 子句
- **完全保留**原始 SQL 的所有其他 WHERE 条件
- **只修改**需要拆分的部分（时间范围、商户号、游戏代码等）

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
- id（唯一id）：{{ $json.id || '' }}

请按照以下要求生成拆分计划：

1. **获取拆分规则**：
   - 调用"获取拆分逻辑文档"工具，获取拆分处理知识库内容
   - 仔细阅读知识库中的 SQL 生成规则和拆分示例
   - **特别注意递归拆分策略**：每次最多拆成2个查询

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

3. **根据拆分维度生成拆分计划**（参考知识库规则，**严格遵守递归拆分策略**）：

   **时间维度拆分**（date_range / hour_range）：
   - **如果时间范围 > 30天**：**只拆成2个查询**（前15天 + 后N天）
   - **如果时间范围 10-20天**：**只拆成2个查询**（前7天 + 后N天）
   - **如果时间范围 5-9天**：**只拆成2个查询**（前3天 + 后N天）
   - **如果时间范围 3-4天**：拆成每天一个查询（这是唯一可以拆成多个查询的情况）
   - **如果时间范围 = 1天**：**只拆成2个查询**（00-12点 + 13-23点）
   - **不要一次性生成所有天的查询**（如31天不要拆成31个查询）

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
  "splitCount": 2,  // 注意：对于一个月（31天），应该是2，不是31！
  "isRecursive": true,  // 标记为递归拆分
  "nextSplitLevel": "前15天和后16天会继续递归拆分，直到每个查询覆盖3-4天或更少",
  "splitPlan": [
    {
      "part": 1,
      "startDate": "2025-10-01",
      "endDate": "2025-10-15",
      "startTime": "2025-10-01 00:00:00",
      "endTime": "2025-10-15 23:59:59",
      "hourStart": "2025100100",
      "hourEnd": "2025101523",
      "description": "前15天（会继续递归拆分）",
      "sql": "基于原始 SQL，只修改 hour BETWEEN '2025100100' AND '2025101523'，其他完全保持不变"
    },
    {
      "part": 2,
      "startDate": "2025-10-16",
      "endDate": "2025-10-31",
      "startTime": "2025-10-16 00:00:00",
      "endTime": "2025-10-31 23:59:59",
      "hourStart": "2025101600",
      "hourEnd": "2025103123",
      "description": "后16天（会继续递归拆分）",
      "sql": "基于原始 SQL，只修改 hour BETWEEN '2025101600' AND '2025103123'，其他完全保持不变"
    }
  ],
  "originalQuery": {{ JSON.stringify($json.originalQuery) }},
  "reason": "时间范围31天 > 30天，按照递归拆分策略，拆分为前15天和后16天两个查询。后续会递归拆分这两个查询，直到每个查询覆盖3-4天或更少。",
  "chatid": "{{ $json.chatid }}",
  "senderid": "{{ $json.senderid }}",
  "messagid": "{{ $json.messagid }}",
  "type": "{{ $json.type }}",
  "id": "{{ $json.id || '' }}"
}

关键要求：
- **必须调用"获取拆分逻辑文档"工具**，获取知识库内容后再生成 SQL
- **必须基于原始 SQL（`contextMessages[0].sql`）进行拆分，不要重新生成 SQL**
- **严格遵守递归拆分策略**：每次最多拆成2个查询（除了3-4天的情况）
- **不要一次性生成所有天的查询**（如31天不要拆成31个查询）
- 分析原始 SQL 的 WHERE 条件，提取时间范围、商户号等
- **完全保留**原始 SQL 的 SELECT 字段列表和 ORDER BY 子句
- **完全保留**原始 SQL 的所有其他 WHERE 条件
- **只修改**需要拆分的部分（时间范围、商户号、游戏代码等）
- 如果原始 SQL 的时间范围不完整，需要扩展到完整的时间范围
- 每个 splitPlan 项必须包含完整的 SQL 语句
- SQL 中的 `hour` 分区必须使用 YYYYMMDDHH 格式
- 确保所有拆分查询覆盖完整的数据范围

