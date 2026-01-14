# 用户分析视图使用说明

## 视图概述

`user_analytics_view` 是一个综合的用户分析视图，支持以下查询：

1. **游戏维度新用户、活跃用户**
2. **商户维度新用户、活跃用户**
3. **自动过滤商户id=10001的数据**

## 视图结构

### 字段说明
| 字段名 | 类型 | 说明 |
|--------|------|------|
| `merchant` | string | 商户ID |
| `game_id` | string | 游戏ID（商户维度为NULL） |
| `cohort_date` | string | 队列日期（YYYY-MM-DD格式） |
| `d0_users` | bigint | D0用户数（当日用户） |
| `d1_users` | bigint | D1用户数（次日留存） |
| `d1_retention_rate` | double | D1留存率（%） |
| `d3_users` | bigint | D3用户数（3日留存） |
| `d3_retention_rate` | double | D3留存率（%） |
| `d7_users` | bigint | D7用户数（7日留存） |
| `d7_retention_rate` | double | D7留存率（%） |
| `d14_users` | bigint | D14用户数（14日留存） |
| `d14_retention_rate` | double | D14留存率（%） |
| `d30_users` | bigint | D30用户数（30日留存） |
| `d30_retention_rate` | double | D30留存率（%） |
| `stat_type` | string | 统计类型 |

### 统计类型
- `merchant_new_user_retention`: 商户维度新用户留存
- `merchant_active_user_retention`: 商户维度活跃用户留存
- `game_new_user_retention`: 游戏维度新用户留存
- `game_active_user_retention`: 游戏维度活跃用户留存

## 查询示例

### 1. 查询商户维度新用户留存（包含留存率）
```sql
SELECT 
  merchant,
  cohort_date,
  d0_users,
  d1_users,
  d1_retention_rate,
  d3_users,
  d3_retention_rate,
  d7_users,
  d7_retention_rate,
  d14_users,
  d14_retention_rate,
  d30_users,
  d30_retention_rate
FROM user_analytics_view 
WHERE stat_type = 'merchant_new_user_retention'
  AND merchant = '1698202251'
ORDER BY cohort_date;
```

### 2. 查询游戏维度活跃用户留存（包含留存率）
```sql
SELECT 
  merchant,
  game_id,
  cohort_date,
  d0_users,
  d1_users,
  d1_retention_rate,
  d3_users,
  d3_retention_rate,
  d7_users,
  d7_retention_rate,
  d14_users,
  d14_retention_rate,
  d30_users,
  d30_retention_rate
FROM user_analytics_view 
WHERE stat_type = 'game_active_user_retention'
  AND merchant = '1698202251'
  AND game_id = '1698217736002'
ORDER BY cohort_date;
```

### 3. 查询留存率分析（直接使用预计算的留存率）
```sql
SELECT 
  stat_type,
  merchant,
  game_id,
  cohort_date,
  d0_users,
  d1_users,
  d1_retention_rate,
  d3_users,
  d3_retention_rate,
  d7_users,
  d7_retention_rate,
  d14_users,
  d14_retention_rate,
  d30_users,
  d30_retention_rate
FROM user_analytics_view 
WHERE d0_users > 0
ORDER BY stat_type, merchant, game_id, cohort_date;
```

### 4. 查询汇总数据
```sql
SELECT 
  stat_type,
  merchant,
  game_id,
  COUNT(DISTINCT cohort_date) AS total_days,
  SUM(d0_users) AS total_users,
  SUM(d1_users) AS total_d1_users,
  SUM(d7_users) AS total_d7_users,
  SUM(d30_users) AS total_d30_users
FROM user_analytics_view 
GROUP BY stat_type, merchant, game_id
ORDER BY total_users DESC;
```

## 数据过滤

### 自动过滤条件
- 过滤掉 `merchant = '10001'` 的数据
- 只包含 `provider IN ('gp', 'popular')` 的数据
- 时间范围：2025-09-01 到 2025-10-30

### 数据质量
- 所有用户数据都是去重的（使用 `COUNT(DISTINCT uid)`）
- 时间格式统一为 YYYY-MM-DD
- 自动处理时区转换

## 性能优化

### 索引建议
```sql
-- 建议在 game_records 表上创建以下索引
CREATE INDEX idx_game_records_merchant_hour ON game_records(merchant, hour);
CREATE INDEX idx_game_records_provider_hour ON game_records(provider, hour);
CREATE INDEX idx_game_records_merchant_game_hour ON game_records(merchant, game_id, hour);
```

### 查询优化
- 使用 `WHERE` 条件限制查询范围
- 避免使用 `SELECT *`
- 合理使用 `ORDER BY` 和 `LIMIT`

## 注意事项

1. **数据更新**：视图数据基于 `game_records` 表，数据更新后需要重新查询
2. **时间范围**：当前硬编码为2025年9-10月，如需其他时间范围需要修改视图
3. **性能考虑**：大量数据查询时建议使用适当的过滤条件
4. **数据一致性**：确保 `game_records` 表的数据质量和完整性

## 扩展功能

### 添加新的统计类型
如需添加新的统计类型，可以在视图中添加新的CTE，并在最后的UNION ALL中合并结果。

### 修改时间范围
修改视图中的日期范围：
```sql
-- 修改这些条件
AND SUBSTR(CAST(gr.hour AS VARCHAR), 1, 8) BETWEEN '20250901' AND '20251030'
WHERE fs.first_event_date BETWEEN DATE '2025-09-01' AND DATE '2025-10-30'
```

### 添加新的留存天数
在SELECT语句中添加新的留存天数：
```sql
COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 60, c.cohort_date) THEN c.uid END) AS d60_users
```

现在你可以使用这个视图来查询各种用户分析数据了！
