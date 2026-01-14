# 查询拆分处理知识库

## 📋 概述

本知识库用于指导 AI 如何分析和拆分大型查询请求。当查询结果文件过大（超过 100MB）或查询范围过广时，需要将查询拆分为多个小查询，以提高查询效率和结果处理能力。

## 🎯 拆分目标

1. **减少单个查询的数据量**：将大查询拆分为多个小查询
2. **提高查询效率**：利用分区和索引，减少扫描数据量
3. **便于结果处理**：小文件更容易下载、压缩和传输
4. **避免超时**：防止单个查询执行时间过长

## 📊 支持的拆分维度

### 1. 时间维度拆分（递归拆分策略）

**核心原则**：**每次最多拆成两个查询**，采用递归拆分策略，逐步细化。

#### 1.1 递归拆分规则

**拆分策略**（按时间范围从大到小）：

1. **超过一个月（> 30天）**：
   - 拆分为两个查询
   - 第一个查询：前15天
   - 第二个查询：后N天（剩余天数）
   - 示例：45天 → 前15天 + 后30天（后30天会继续递归拆分）

2. **15天左右（10-20天）**：
   - 拆分为两个查询
   - 第一个查询：前7天（一周）
   - 第二个查询：后N天（剩余天数，会继续递归拆分）
   - 示例：15天 → 前7天 + 后8天（后8天会继续递归拆分）

3. **一周左右（5-9天）**：
   - 拆分为两个查询
   - 第一个查询：前3天
   - 第二个查询：后N天（剩余天数，会继续递归拆分）
   - 示例：7天 → 前3天 + 后4天（后4天会继续递归拆分）

4. **3-4天**：
   - 拆分为每天一个查询
   - 每个查询覆盖一天：`hour BETWEEN 'YYYYMMDD00' AND 'YYYYMMDD23'`
   - 示例：3天 → 3个查询（每天一个）

5. **单天（1天）**：
   - 拆分为两个查询
   - 第一个查询：00:00-12:59（`hour BETWEEN 'YYYYMMDD00' AND 'YYYYMMDD12'`）
   - 第二个查询：13:00-23:59（`hour BETWEEN 'YYYYMMDD13' AND 'YYYYMMDD23'`）
   - 示例：2025-10-01 → 00-12点 + 13-23点

**递归拆分流程示例**：
```
45天查询
  ├─ 前15天（继续拆分）
  │   ├─ 前7天（继续拆分）
  │   │   ├─ 前3天（拆成3个单天查询）
  │   │   └─ 后4天（拆成4个单天查询）
  │   └─ 后8天（继续拆分）
  │       ├─ 前3天（拆成3个单天查询）
  │       └─ 后5天（继续拆分）
  │           ├─ 前3天（拆成3个单天查询）
  │           └─ 后2天（拆成2个单天查询）
  └─ 后30天（继续拆分，同上逻辑）
```

#### 1.2 时间拆分 SQL 格式

| 时间范围 | SQL 条件格式 | 示例 |
|---------|------------|------|
| 多天（3-4天） | `hour BETWEEN 'YYYYMMDD00' AND 'YYYYMMDD23'` | `hour BETWEEN '2025100100' AND '2025100123'` |
| 单天前半段 | `hour BETWEEN 'YYYYMMDD00' AND 'YYYYMMDD12'` | `hour BETWEEN '2025100100' AND '2025100112'` |
| 单天后半段 | `hour BETWEEN 'YYYYMMDD13' AND 'YYYYMMDD23'` | `hour BETWEEN '2025100113' AND '2025100123'` |
| 多天范围（递归） | `hour BETWEEN 'YYYYMMDD00' AND 'YYYYMMDD23'` | `hour BETWEEN '2025100100' AND '2025100723'`（前7天） |

**适用场景**：
- 时间范围超过 1 天
- 文件大小超过 100MB
- 查询执行时间过长

### 2. 商户维度拆分（merchant_range）

**适用场景**：
- 查询涉及多个商户（商户数量 > 5）
- 需要对比多个商户的数据
- 商户列表明确

**拆分规则**：
- 每个商户生成一个查询
- WHERE 条件：`merchant_id = 'xxx'`
- 拆分数量 = 商户数量

**示例**：
- 输入：5 个商户（1716179958, 1716179959, 1716179960, 1716179961, 1716179962）
- 输出：5 个查询，每个查询覆盖一个商户

### 3. 游戏维度拆分（game_range）

**适用场景**：
- 查询涉及多个游戏（游戏数量 > 5）
- 需要对比多个游戏的数据
- 游戏列表明确

**拆分规则**：
- 每个游戏生成一个查询
- WHERE 条件：`game_code = 'xxx'`
- 拆分数量 = 游戏数量

**示例**：
- 输入：10 个游戏（gp_superace, gp_crash_73, popular_slots_1, ...）
- 输出：10 个查询，每个查询覆盖一个游戏

### 4. 提供商维度拆分（provider_range）

**适用场景**：
- 查询涉及多个提供商（如 'gp', 'popular', 'other'）
- 需要对比不同提供商的数据
- 提供商列表明确

**拆分规则**：
- 每个提供商生成一个查询
- WHERE 条件：`provider = 'xxx'`（注意：不是 `IN`，而是单个值）
- 拆分数量 = 提供商数量

**示例**：
- 输入：2 个提供商（'gp', 'popular'）
- 输出：2 个查询，每个查询覆盖一个提供商

### 5. 货币维度拆分（currency_range）

**适用场景**：
- 查询涉及多种货币（货币数量 > 3）
- 需要按币种分别统计
- 货币列表明确

**拆分规则**：
- 每种货币生成一个查询
- WHERE 条件：`currency = 'xxx'`
- 拆分数量 = 货币数量

**示例**：
- 输入：3 种货币（USD, PHP, THB）
- 输出：3 个查询，每个查询覆盖一种货币

### 6. 用户维度拆分（user_range）

**适用场景**：
- 查询涉及大量用户（用户数量 > 50）
- 需要查询多个用户的记录
- 用户列表明确

**拆分规则**：
- 每批用户生成一个查询
- WHERE 条件：`uid IN ('user1', 'user2', ...)`（每批 50-100 个用户）
- 拆分数量 = 用户数量 / 每批数量（向上取整）

**示例**：
- 输入：100 个用户，每批 50 个
- 输出：2 个查询，每个查询覆盖 50 个用户

### 7. 组合拆分（combined）

**适用场景**：
- 同时涉及多个维度（如时间 + 商户、时间 + 游戏）
- 数据量非常大，需要多维度拆分
- 需要生成所有组合的查询

**拆分规则**：
- 生成所有维度的组合查询
- 拆分数量 = 维度1数量 × 维度2数量 × ...

**示例**：
- 输入：5 个商户 × 31 天
- 输出：155 个查询（5 × 31），每个查询覆盖一个商户的一天

## 🔍 拆分判断逻辑

### 判断是否需要拆分

1. **文件大小判断**：
   - 如果文件大小超过 100MB，建议拆分
   - 如果文件大小超过 50MB，可以考虑拆分

2. **时间范围判断**：
   - 如果时间范围超过 7 天，建议拆分
   - 如果时间范围超过 31 天，必须拆分

3. **数据量判断**：
   - 如果查询条件复杂且数据量大，建议拆分
   - 如果涉及多个维度，建议拆分

4. **信息完整性判断**：
   - 如果缺少时间范围，无法拆分
   - 如果缺少必要字段（商户号、游戏代码等），无法拆分

### 选择拆分策略

**优先级顺序**（递归拆分策略）：

1. **时间维度优先（递归拆分）**：
   - **第一步**：判断时间范围，按递归规则拆分（每次最多2个）
   - 如果时间范围 > 30天：拆分为前15天 + 后N天
   - 如果时间范围 10-20天：拆分为前7天 + 后N天
   - 如果时间范围 5-9天：拆分为前3天 + 后N天
   - 如果时间范围 3-4天：拆分为每天一个查询
   - 如果时间范围 = 1天：拆分为00-12点 + 13-23点
   - **递归继续**：对拆分后的每个查询，如果仍然需要拆分，继续递归应用上述规则

2. **业务维度次之**（仅在时间维度已最小化后）：
   - 如果时间范围已是最小（单天两段），且涉及多个商户（> 5），按商户拆分
   - 如果时间范围已是最小，且涉及多个游戏（> 5），按游戏拆分
   - 如果时间范围已是最小，且涉及多种货币（> 3），按货币拆分

3. **组合拆分**（仅在时间维度已最小化后）：
   - 如果时间范围已是最小，且同时涉及多个维度，使用组合拆分
   - 优先选择数据量最大的维度

4. **用户维度最后**（仅在时间维度已最小化后）：
   - 如果时间范围已是最小，且涉及大量用户（> 50），按用户拆分
   - 每批 50-100 个用户

### 拆分数量限制

- **每次拆分数量**：**最多 2 个**（递归拆分策略）
- **最终拆分数量**：根据时间范围递归计算，无固定上限
- **推荐策略**：优先时间维度递归拆分，如果时间范围已最小（单天拆成两段），再考虑其他维度

## 📝 SQL 生成规则

### 核心原则

**拆分 SQL 必须基于原始 SQL**：
- 输入数据中会包含 `contextMessages[0].sql`，这是之前执行的主 SQL
- **必须基于这个原始 SQL 进行拆分**，而不是重新生成
- 分析原始 SQL 的 WHERE 条件，特别是时间范围（`hour BETWEEN ...`）
- 保持原始 SQL 的所有其他部分不变（SELECT 字段、ORDER BY、其他 WHERE 条件等）
- 只修改需要拆分的部分（时间范围、商户号、游戏代码等）

### 基本要求

1. **基于原始 SQL**：
   - 从 `contextMessages[0].sql` 获取原始 SQL
   - 分析原始 SQL 的 WHERE 条件，提取：
     * 时间范围：`hour BETWEEN 'YYYYMMDDHH' AND 'YYYYMMDDHH'`
     * 商户号：`merchant_id = 'xxx'`
     * 游戏代码：`game_code = 'xxx'`
     * 其他条件：`provider IN (...)`、`currency = 'xxx'` 等
   - 保持原始 SQL 的 SELECT 字段列表
   - 保持原始 SQL 的 ORDER BY 子句
   - 保持原始 SQL 的其他 WHERE 条件

2. **分区条件**：
   - 必须包含 `hour` 分区条件
   - 格式：`hour BETWEEN 'YYYYMMDDHH' AND 'YYYYMMDDHH'`
   - 例如：`hour BETWEEN '2025100100' AND '2025100123'`
   - **基于原始 SQL 的时间范围进行拆分**

3. **Provider 条件**：
   - 保留原始 SQL 中的 `provider` 条件
   - 如果原始 SQL 是 `provider IN ('gp', 'popular')`，保持不变
   - 如果按提供商拆分，修改为：`provider = 'xxx'`（单个值）

4. **其他条件**：
   - **完全保留**原始 SQL 的所有其他 WHERE 条件
   - 根据拆分维度添加或修改对应的过滤条件

### 拆分维度对应的 SQL 条件

| 拆分维度 | SQL 条件格式 | 示例 | 说明 |
|---------|------------|------|------|
| 多天范围（递归） | `hour BETWEEN 'YYYYMMDD00' AND 'YYYYMMDD23'` | `hour BETWEEN '2025100100' AND '2025100723'` | 前7天、前15天等 |
| 单天 | `hour BETWEEN 'YYYYMMDD00' AND 'YYYYMMDD23'` | `hour BETWEEN '2025100100' AND '2025100123'` | 3-4天时拆成每天 |
| 单天前半段 | `hour BETWEEN 'YYYYMMDD00' AND 'YYYYMMDD12'` | `hour BETWEEN '2025100100' AND '2025100112'` | 00-12点 |
| 单天后半段 | `hour BETWEEN 'YYYYMMDD13' AND 'YYYYMMDD23'` | `hour BETWEEN '2025100113' AND '2025100123'` | 13-23点 |
| merchant_range | `merchant_id = 'xxx'` | `merchant_id = '1716179958'` | 仅在时间维度已最小化后 |
| game_range | `game_code = 'xxx'` | `game_code = 'gp_superace'` | 仅在时间维度已最小化后 |
| provider_range | `provider = 'xxx'` | `provider = 'gp'` | 仅在时间维度已最小化后 |
| currency_range | `currency = 'xxx'` | `currency = 'USD'` | 仅在时间维度已最小化后 |
| user_range | `uid IN ('user1', 'user2', ...)` | `uid IN ('user1', 'user2', ..., 'user50')` | 仅在时间维度已最小化后 |

## 🎯 拆分计划输出格式

### 成功拆分输出

```json
{
  "canSplit": true,
  "splitStrategy": "date_range_recursive" | "hour_range" | "merchant_range" | "game_range" | "provider_range" | "currency_range" | "user_range" | "combined",
  "splitDimension": "day" | "half_day" | "merchant" | "game" | "provider" | "currency" | "user" | "combined",
  "splitCount": 2,
  "isRecursive": true,
  "nextSplitLevel": "如果还需要继续拆分，说明下一层的拆分策略",
  "timeRange": {
    "startDate": "2025-10-01",
    "endDate": "2025-10-31",
    "startTime": "2025-10-01 00:00:00",
    "endTime": "2025-10-31 23:59:59"
  },
  "queryConditions": {
    "merchant_id": "1716179958" | ["1716179958", "1716179959"] | null,
    "game_code": null | "gp_superace" | ["gp_superace", "gp_crash_73"],
    "provider": "gp,popular" | ["gp", "popular"] | null,
    "currency": null | "USD" | ["USD", "PHP", "THB"],
    "uid": null | "user1" | ["user1", "user2", ...]
  },
  "splitDetails": {
    "merchantList": ["1716179958", "1716179959"] | null,
    "gameList": ["gp_superace", "gp_crash_73"] | null,
    "providerList": ["gp", "popular"] | null,
    "currencyList": ["USD", "PHP"] | null,
    "userBatchSize": 50 | null
  },
  "reason": "说明拆分策略和拆分原因"
}
```

### 无法拆分输出

```json
{
  "canSplit": false,
  "reason": "说明无法拆分的原因（缺少时间范围、商户号等）",
  "requiredFields": ["缺失的字段列表"],
  "suggestedQuestion": "建议用户补充的信息"
}
```

## 📚 拆分示例

### 示例 1：递归拆分（10月数据，31天）- 基于原始 SQL

**输入数据**：
```json
{
  "contextMessages": [
    {
      "sql": "SELECT id, uid, merchant_id, game_id, game_code, provider, result, currency, ROUND(CAST(amount AS DOUBLE), 2) AS amount, ROUND(CAST(pay_out AS DOUBLE), 2) AS pay_out, multiplier, balance, detail, DATE_FORMAT(FROM_UNIXTIME(created_at / 1000), '%Y-%m-%d %H:%i:%s') AS created_at, DATE_FORMAT(FROM_UNIXTIME(updated_at / 1000), '%Y-%m-%d %H:%i:%s') AS updated_at FROM gmp.game_records WHERE hour BETWEEN '2025100100' AND '2025100123' AND provider IN ('gp', 'popular') AND merchant_id = '1716179958' ORDER BY created_at;"
    }
  ],
  "originalQuery": {
    "text": "商户号: 1716179958\n查一下10月的游戏记录",
    "timeRange": "10月"
  },
  "fileSizeMB": 553.44
}
```

**分析**：
- 原始 SQL 的时间范围：`hour BETWEEN '2025100100' AND '2025100123'`（只覆盖 10月1日）
- 用户查询的是"10月"（整个月，31天），需要递归拆分
- 原始 SQL 的其他条件：`merchant_id = '1716179958'`、`provider IN ('gp', 'popular')`

**递归拆分策略**：
- **第一层**：31天 > 30天，拆分为前15天 + 后16天
- **第二层**：
  - 前15天：拆分为前7天 + 后8天
  - 后16天：拆分为前7天 + 后9天
- **第三层**：继续递归拆分，直到每个查询覆盖3-4天或更少
- **最终**：每个3-4天的查询拆分为每天一个查询

**输出 SQL 示例**（第一层拆分 - 前15天）：
```sql
SELECT 
  id, uid, merchant_id, game_id, game_code, provider, result, currency, 
  ROUND(CAST(amount AS DOUBLE), 2) AS amount, 
  ROUND(CAST(pay_out AS DOUBLE), 2) AS pay_out, 
  multiplier, balance, detail, 
  DATE_FORMAT(FROM_UNIXTIME(created_at / 1000), '%Y-%m-%d %H:%i:%s') AS created_at, 
  DATE_FORMAT(FROM_UNIXTIME(updated_at / 1000), '%Y-%m-%d %H:%i:%s') AS updated_at 
FROM gmp.game_records 
WHERE hour BETWEEN '2025100100' AND '2025101523'  -- 前15天
  AND provider IN ('gp', 'popular')  -- 保持不变
  AND merchant_id = '1716179958'  -- 保持不变
ORDER BY created_at;  -- 保持不变
```

**输出 SQL 示例**（第一层拆分 - 后16天）：
```sql
SELECT 
  id, uid, merchant_id, game_id, game_code, provider, result, currency, 
  ROUND(CAST(amount AS DOUBLE), 2) AS amount, 
  ROUND(CAST(pay_out AS DOUBLE), 2) AS pay_out, 
  multiplier, balance, detail, 
  DATE_FORMAT(FROM_UNIXTIME(created_at / 1000), '%Y-%m-%d %H:%i:%s') AS created_at, 
  DATE_FORMAT(FROM_UNIXTIME(updated_at / 1000), '%Y-%m-%d %H:%i:%s') AS updated_at 
FROM gmp.game_records 
WHERE hour BETWEEN '2025101600' AND '2025103123'  -- 后16天
  AND provider IN ('gp', 'popular')  -- 保持不变
  AND merchant_id = '1716179958'  -- 保持不变
ORDER BY created_at;  -- 保持不变
```

**关键点**：
- ✅ 完全保留原始 SQL 的 SELECT 字段列表
- ✅ 完全保留原始 SQL 的 ORDER BY 子句
- ✅ 完全保留原始 SQL 的其他 WHERE 条件
- ✅ 只修改 `hour BETWEEN ...` 的时间范围部分
- ✅ **递归拆分**：每个拆分后的查询如果仍然需要拆分，继续递归应用拆分规则

### 示例 2：按商户拆分（5个商户）

**输入**：
- 商户列表：["1716179958", "1716179959", "1716179960", "1716179961", "1716179962"]
- 时间范围：2025-10-01 到 2025-10-07

**拆分策略**：
- `splitStrategy`: `merchant_range`
- `splitDimension`: `merchant`
- `splitCount`: 5

**输出**：5 个查询，每个查询覆盖一个商户

### 示例 3：组合拆分（时间 + 商户）

**输入**：
- 商户列表：["1716179958", "1716179959", "1716179960", "1716179961", "1716179962"]
- 时间范围：10月（2025-10-01 到 2025-10-31）

**拆分策略**：
- `splitStrategy`: `combined`
- `splitDimension`: `combined`
- `splitCount`: 155（5 商户 × 31 天）

**输出**：155 个查询，每个查询覆盖一个商户的一天

### 示例 4：单天拆分（递归到最小粒度）

**输入**：
- 时间范围：2025-10-01（单天）
- 文件大小：80MB（需要拆分）

**拆分策略**：
- `splitStrategy`: `hour_range`
- `splitDimension`: `half_day`
- `splitCount`: 2

**输出 SQL 示例**（00-12点）：
```sql
SELECT ... 
FROM gmp.game_records 
WHERE hour BETWEEN '2025100100' AND '2025100112'  -- 00-12点
  AND provider IN ('gp', 'popular')
  AND merchant_id = '1716179958'
ORDER BY created_at;
```

**输出 SQL 示例**（13-23点）：
```sql
SELECT ... 
FROM gmp.game_records 
WHERE hour BETWEEN '2025100113' AND '2025100123'  -- 13-23点
  AND provider IN ('gp', 'popular')
  AND merchant_id = '1716179958'
ORDER BY created_at;
```

### 示例 5：按用户拆分（100个用户，仅在时间维度已最小化后）

**输入**：
- 用户列表：100 个用户
- 时间范围：2025-10-01（单天，已拆分为00-12和13-23两段）
- 每批：50 个用户

**拆分策略**：
- `splitStrategy`: `user_range`
- `splitDimension`: `user`
- `splitCount`: 2（100 / 50）

**输出**：2 个查询，每个查询覆盖 50 个用户（在时间维度已最小化的基础上）

## ⚠️ 注意事项

1. **必须基于原始 SQL**：
   - **关键**：拆分 SQL 必须基于 `contextMessages[0].sql` 中的原始 SQL
   - 不要重新生成 SQL，而是修改原始 SQL 的特定部分
   - 分析原始 SQL 的 WHERE 条件，提取时间范围、商户号等
   - 如果原始 SQL 的时间范围只覆盖部分时间（如只有1天），需要扩展到完整的时间范围（如整个月）

2. **保持原始 SQL 结构**：
   - ✅ 完全保留 SELECT 字段列表
   - ✅ 完全保留 ORDER BY 子句
   - ✅ 完全保留所有其他 WHERE 条件
   - ✅ 只修改需要拆分的部分（时间范围、商户号、游戏代码等）

3. **数据完整性**：
   - 确保所有拆分查询覆盖完整的数据范围
   - 不能遗漏任何数据
   - 不能重复查询数据
   - 如果原始 SQL 的时间范围不完整，需要扩展到完整范围

4. **SQL 格式**：
   - 必须使用正确的分区格式（YYYYMMDDHH）
   - 必须保留原始 SQL 中的 `provider` 条件（除非按提供商拆分）
   - 必须保留原始 SQL 的所有其他条件

5. **递归拆分规则**：
   - **每次最多拆成 2 个查询**
   - 超过一个月：前15天 + 后N天
   - 15天左右：前7天 + 后N天
   - 一周左右：前3天 + 后N天
   - 3-4天：拆成每天一个查询
   - 单天：00-12点 + 13-23点
   - **递归继续**：对拆分后的每个查询，如果仍然需要拆分，继续递归应用上述规则

6. **性能考虑**：
   - 优先选择数据量最大的维度进行拆分
   - 考虑查询执行时间和资源消耗
   - 平衡拆分数量和单个查询大小

## 🔗 相关文档

- `AI_SCENARIO_INDEX.md` - AI 场景分类索引
- `N8N_SPLIT_QUERY_TWO_STAGE_AI.md` - 两阶段 AI 架构配置指南

