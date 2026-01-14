# AI SQL生成缺少hour条件问题修复

## 问题描述

用户查询："查一下投注记录：1973176029411737600\n2025/10/1"

上游数据包含：
- `extractedParams.bet_id`: "1973176029411737600"
- `extractedParams.start_date`: "20251001"
- `extractedParams.end_date`: "20251001"
- `extractedParams.timeRange`: null

AI生成的SQL：
```sql
SELECT ...
FROM gmp.game_records
WHERE id IN ('1973176029411737600')
  AND provider IN ('gp', 'popular');
```

**问题**：SQL缺少`hour`条件，即使有`start_date`和`end_date`。

## 问题分析

### 1. S1场景SQL模板
根据`ai-scenarios/S1_single_record_lookup.md`：
- SQL模板中有可选的`{{ AND hour = '{{ hour }}' }}`条件
- **扩展提示**明确说明："如果用户同时给出日期，可将其转换为 `hour BETWEEN '{{ start_date }}00' AND '{{ end_date }}23'` 进一步减少数据量。"

### 2. AI提示词问题
当前AI提示词中的变量替换规则：
- 只基于`timeRange`字段进行时间转换
- 没有识别`start_date`和`end_date`字段
- 没有说明在S1场景中，如果有日期，应该添加hour条件

### 3. 统一约定
根据`AI_SCENARIO_INDEX.md`：
- `start_date` / `end_date`：使用 `YYYYMMDD`格式（例如 `20251012`）
- `hour`：使用 `YYYYMMDDHH` 字符串（例如查询 2025-11-24 全日需 `hour BETWEEN '2025112400' AND '2025112423'`）
- **所有 SQL 必须包含必要的分区条件（如 `hour`、`merchant`、`provider`）以避免全表扫描**

## 解决方案

### 1. 更新AI节点的Text Prompt

在Text Prompt中增加对`start_date`和`end_date`字段的说明：

```markdown
输入数据（必须使用这些值，不得改动）：
- extractedParams.start_date：{{ $json.queryRequirement?.extractedParams?.start_date || '' }}
- extractedParams.end_date：{{ $json.queryRequirement?.extractedParams?.end_date || '' }}
- extractedParams.timeRange：{{ $json.queryRequirement?.extractedParams?.timeRange || '' }}
```

### 2. 更新AI节点的System Message

在System Message的"变量替换规则"部分增加：

```markdown
4. **变量替换规则**（重要更新）：
   - {{merchant_id}} → queryRequirement.extractedParams.merchant_id（如果为null则不添加该条件）
   - {{bet_id}} → queryRequirement.extractedParams.bet_id（如果为null则不添加该条件）
   - {{uid}} → queryRequirement.extractedParams.uid（如果为null则不添加该条件）
   - {{game_code}} → queryRequirement.extractedParams.game_code（如果为null则不添加该条件）
   
   **时间范围处理（关键）**：
   - **优先使用start_date和end_date**：如果`extractedParams.start_date`和`extractedParams.end_date`存在且不为null，必须使用这两个字段生成hour条件
   - **hour条件生成规则**：
     * 如果`start_date`和`end_date`存在（格式：YYYYMMDD，如"20251001"），转换为：`hour BETWEEN '{{ start_date }}00' AND '{{ end_date }}23'`
     * 例如：`start_date = "20251001"`, `end_date = "20251001"` → `hour BETWEEN '2025100100' AND '2025100123'`
     * 例如：`start_date = "20251001"`, `end_date = "20251007"` → `hour BETWEEN '2025100100' AND '2025100723'`
   - **timeRange字段**：如果`start_date`和`end_date`不存在，才使用`timeRange`字段进行时间转换
   - **S1场景特殊处理**：对于S1场景（单/多记录ID查询），如果提供了`start_date`和`end_date`，**必须添加hour条件**来减少扫描范围，即使模板中hour是可选的
   
   - 其他变量根据 extractedParams 中的值进行替换
```

### 3. 在"生成最终SQL"部分增加说明

```markdown
4. **生成最终SQL**：
   - 将SQL模板中的所有变量替换为实际值
   - 如果某个变量对应的值为 null，则移除该变量相关的WHERE条件
   - **重要：如果extractedParams中有start_date和end_date，必须添加hour条件**：
     * 格式：`hour BETWEEN '{{ start_date }}00' AND '{{ end_date }}23'`
     * 即使SQL模板中hour是可选的，也应该添加此条件以减少扫描范围
   - 设置 outputType = "套用模板"
   - 确保SQL语法正确，符合 gmp.game_records 表结构
```

### 4. 在"SQL生成规则"部分增加说明

```markdown
3. **SQL生成规则**：
   - **禁止自主添加 LIMIT**：除非用户明确要求限制结果数量，否则不要在 SQL 中添加 LIMIT 子句。
   - **必须添加hour条件**：如果extractedParams中有start_date和end_date，必须添加hour条件来减少扫描范围
     * 格式：`hour BETWEEN '{{ start_date }}00' AND '{{ end_date }}23'`
     * 这是性能优化的关键，可以避免全表扫描
   - 时间字段转换：使用 FROM_UNIXTIME(created_at / 1000) 或 FROM_UNIXTIME(updated_at / 1000)
   - 金额字段四舍五入：使用 ROUND(CAST(amount AS DOUBLE), 2)
   - 日期格式：DATE_FORMAT(FROM_UNIXTIME(created_at / 1000), '%Y-%m-%d %H:%i:%s')
   - 使用适当的 WHERE 条件：避免全表扫描，确保SQL性能
   - **必须包含**：`provider IN ('gp', 'popular')` 和 `merchant <> '10001'`（如果适用）
```

## 完整的System Message更新

在System Message的"变量替换规则"部分，完整替换为：

```markdown
4. **变量替换规则**（必须严格遵循）：
   - {{merchant_id}} → queryRequirement.extractedParams.merchant_id（如果为null则不添加该条件）
   - {{uid}} → queryRequirement.extractedParams.uid（如果为null则不添加该条件）
   - {{game_code}} → queryRequirement.extractedParams.game_code（如果为null则不添加该条件）
   - {{bet_id}} → queryRequirement.extractedParams.bet_id（如果为null则不添加该条件）
   
   **时间范围处理（关键，必须优先处理）**：
   - **优先级1：start_date和end_date**：
     * 如果`extractedParams.start_date`和`extractedParams.end_date`存在且不为null（格式：YYYYMMDD，如"20251001"），**必须**生成hour条件
     * 转换规则：`hour BETWEEN '{{ start_date }}00' AND '{{ end_date }}23'`
     * 示例：
       - `start_date = "20251001"`, `end_date = "20251001"` → `hour BETWEEN '2025100100' AND '2025100123'`
       - `start_date = "20251001"`, `end_date = "20251007"` → `hour BETWEEN '2025100100' AND '2025100723'`
     * **重要**：即使SQL模板中hour是可选的，如果提供了start_date和end_date，也必须添加hour条件来减少扫描范围
   
   - **优先级2：timeRange字段**：
     * 只有当`start_date`和`end_date`不存在时，才使用`timeRange`字段
     * 时间范围转换规则：
       * 日期字符串（如 "2025-10-09"）→ 该日期的 00:00:00 和 23:59:59 时间戳
       * 时间范围字符串（如 "2025-10-01至2025-10-31"）→ 解析开始和结束日期并转换
       * 自然语言（如 "最近7天"、"上月"）→ 转换为对应的时间戳范围
   
   - 其他变量根据 queryRequirement.extractedParams 中的值进行替换
```

## 验证方法

### 测试用例1：S1场景，有start_date和end_date
**输入**：
```json
{
  "matchedScenarioId": "S1",
  "queryRequirement": {
    "extractedParams": {
      "bet_id": "1973176029411737600",
      "start_date": "20251001",
      "end_date": "20251001",
      "timeRange": null
    }
  }
}
```

**预期输出SQL**：
```sql
SELECT ...
FROM gmp.game_records
WHERE id IN ('1973176029411737600')
  AND provider IN ('gp', 'popular')
  AND hour BETWEEN '2025100100' AND '2025100123';
```

### 测试用例2：S1场景，只有timeRange
**输入**：
```json
{
  "matchedScenarioId": "S1",
  "queryRequirement": {
    "extractedParams": {
      "bet_id": "1973176029411737600",
      "start_date": null,
      "end_date": null,
      "timeRange": "2025-10-01"
    }
  }
}
```

**预期输出SQL**：
```sql
SELECT ...
FROM gmp.game_records
WHERE id IN ('1973176029411737600')
  AND provider IN ('gp', 'popular')
  AND hour BETWEEN '2025100100' AND '2025100123';
```

## 实施步骤

1. **更新AI节点的Text Prompt**：
   - 在输入数据部分增加`start_date`和`end_date`字段的说明

2. **更新AI节点的System Message**：
   - 在"变量替换规则"部分增加对`start_date`和`end_date`的优先处理说明
   - 明确说明必须添加hour条件来减少扫描范围

3. **测试验证**：
   - 使用测试用例1验证S1场景是否能正确添加hour条件
   - 使用测试用例2验证timeRange字段的处理

4. **监控和调整**：
   - 观察AI输出，确保所有有`start_date`和`end_date`的查询都包含hour条件
   - 如果仍有问题，进一步强化提示词中的说明

## 相关文件

- `ai-scenarios/S1_single_record_lookup.md` - S1场景定义文档
- `ai-scenarios/AI_SCENARIO_INDEX.md` - 场景索引，包含统一约定

## 总结

问题的核心在于AI提示词没有识别`start_date`和`end_date`字段，只基于`timeRange`字段进行时间转换。通过更新提示词，明确说明：

1. **优先使用start_date和end_date**：如果这两个字段存在，必须使用它们生成hour条件
2. **必须添加hour条件**：即使SQL模板中hour是可选的，如果提供了日期，也应该添加hour条件来减少扫描范围
3. **格式转换**：`start_date = "20251001"`, `end_date = "20251001"` → `hour BETWEEN '2025100100' AND '2025100123'`

这样可以确保所有有日期的查询都包含hour条件，避免全表扫描，提高查询性能。

