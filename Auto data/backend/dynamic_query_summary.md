# 动态用户分析查询功能总结

## 功能概述

现在 `user_analytics_view` 支持动态时间范围的留存数据查询，可以轻松查询上周、本月、最近N天等各种时间维度的数据。

## 新增文件

### 1. 动态查询文件
- `dynamic_user_analytics_queries.sql` - 包含各种动态时间查询示例
- `time_range_calculator.sql` - 时间范围计算器
- `parameterized_user_analytics_queries.sql` - 参数化查询模板
- `dynamic_query_usage_guide.md` - 详细使用指南

### 2. 更新的文件
- `user_analytics_view.sql` - 主视图定义（添加了动态查询支持说明）
- `user_analytics_queries.sql` - 查询示例（新增动态时间查询示例）

## 主要功能

### 1. 支持的时间查询类型

#### 上周查询
```sql
-- 动态计算上周日期范围
WITH last_week_range AS (
  SELECT 
    DATE_FORMAT(DATE_ADD('day', -7, CURRENT_DATE), '%Y-%m-%d') AS start_date,
    DATE_FORMAT(DATE_ADD('day', -1, CURRENT_DATE), '%Y-%m-%d') AS end_date
)
SELECT * FROM user_analytics_view v
CROSS JOIN last_week_range lwr
WHERE v.cohort_date BETWEEN lwr.start_date AND lwr.end_date;
```

#### 本月查询
```sql
-- 动态计算本月日期范围
WITH current_month_range AS (
  SELECT 
    DATE_FORMAT(DATE_TRUNC('month', CURRENT_DATE), '%Y-%m-%d') AS start_date,
    DATE_FORMAT(DATE_TRUNC('month', DATE_ADD('month', 1, CURRENT_DATE)) - INTERVAL '1' DAY, '%Y-%m-%d') AS end_date
)
SELECT * FROM user_analytics_view v
CROSS JOIN current_month_range cmr
WHERE v.cohort_date BETWEEN cmr.start_date AND cmr.end_date;
```

#### 最近N天查询
```sql
-- 查询最近7天
WHERE cohort_date >= DATE_FORMAT(DATE_ADD('day', -7, CURRENT_DATE), '%Y-%m-%d')

-- 查询最近30天
WHERE cohort_date >= DATE_FORMAT(DATE_ADD('day', -30, CURRENT_DATE), '%Y-%m-%d')
```

### 2. 参数化查询模板

支持通过替换参数来快速生成查询：

```sql
-- 模板
WHERE cohort_date BETWEEN '{START_DATE}' AND '{END_DATE}'

-- 实际使用
WHERE cohort_date BETWEEN '2025-10-14' AND '2025-10-20'
```

### 3. 时间范围计算器

提供各种时间范围的计算方法：

```sql
-- 上周（周一到周日）
DATE_FORMAT(DATE_ADD('day', -7, DATE_TRUNC('week', CURRENT_DATE)), '%Y-%m-%d') AS last_week_start
DATE_FORMAT(DATE_ADD('day', -1, DATE_TRUNC('week', CURRENT_DATE)), '%Y-%m-%d') AS last_week_end

-- 上月（1号到最后一天）
DATE_FORMAT(DATE_TRUNC('month', DATE_ADD('month', -1, CURRENT_DATE)), '%Y-%m-%d') AS last_month_start
DATE_FORMAT(DATE_ADD('day', -1, DATE_TRUNC('month', CURRENT_DATE)), '%Y-%m-%d') AS last_month_end
```

## 使用示例

### 1. 查询上周留存数据

```sql
-- 方法1：直接指定日期
SELECT * FROM user_analytics_view 
WHERE cohort_date BETWEEN '2025-10-14' AND '2025-10-20';

-- 方法2：动态计算上周日期
WITH last_week_range AS (
  SELECT 
    DATE_FORMAT(DATE_ADD('day', -7, CURRENT_DATE), '%Y-%m-%d') AS start_date,
    DATE_FORMAT(DATE_ADD('day', -1, CURRENT_DATE), '%Y-%m-%d') AS end_date
)
SELECT v.* FROM user_analytics_view v
CROSS JOIN last_week_range lwr
WHERE v.cohort_date BETWEEN lwr.start_date AND lwr.end_date;
```

### 2. 查询特定商户的上周留存数据

```sql
SELECT * FROM user_analytics_view 
WHERE merchant = '1698202251'
  AND cohort_date BETWEEN '2025-10-14' AND '2025-10-20';
```

### 3. 查询留存数据汇总

```sql
SELECT 
  stat_type,
  COUNT(DISTINCT merchant) AS unique_merchants,
  SUM(d0_users) AS total_d0_users,
  SUM(d1_users) AS total_d1_users,
  ROUND(AVG(d1_retention_rate), 2) AS avg_d1_retention_rate
FROM user_analytics_view 
WHERE cohort_date BETWEEN '2025-10-14' AND '2025-10-20'
GROUP BY stat_type;
```

## 查询字段说明

视图输出包含以下字段：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| `stat_type` | string | 统计类型 |
| `merchant` | string | 商户ID |
| `game_id` | string | 游戏ID（商户维度为NULL） |
| `cohort_date` | string | 队列日期 |
| `d0_users` | bigint | 当日用户数 |
| `d1_users` | bigint | 次日留存用户数 |
| `d1_retention_rate` | double | 次日留存率（%） |
| `d3_users` | bigint | 3日留存用户数 |
| `d3_retention_rate` | double | 3日留存率（%） |
| `d7_users` | bigint | 7日留存用户数 |
| `d7_retention_rate` | double | 7日留存率（%） |
| `d14_users` | bigint | 14日留存用户数 |
| `d14_retention_rate` | double | 14日留存率（%） |
| `d30_users` | bigint | 30日留存用户数 |
| `d30_retention_rate` | double | 30日留存率（%） |

## 统计类型

- `merchant_new_user_retention`: 商户维度新用户留存
- `merchant_active_user_retention`: 商户维度活跃用户留存
- `game_new_user_retention`: 游戏维度新用户留存
- `game_active_user_retention`: 游戏维度活跃用户留存

## 注意事项

1. **日期格式**：所有日期都使用 `YYYY-MM-DD` 格式
2. **时间范围**：确保查询的时间范围在视图数据范围内
3. **性能优化**：对于大量数据查询，建议使用适当的过滤条件
4. **数据更新**：视图数据基于 `game_records` 表，数据更新后需要重新查询

## 快速开始

1. 使用 `time_range_calculator.sql` 计算所需的时间范围
2. 使用 `parameterized_user_analytics_queries.sql` 中的模板生成查询
3. 参考 `dynamic_query_usage_guide.md` 了解详细使用方法

现在你可以轻松查询各种时间范围的留存数据了！






