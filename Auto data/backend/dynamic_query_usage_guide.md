# 动态用户分析查询使用指南

## 概述

本指南介绍如何使用 `user_analytics_view` 进行动态时间范围的留存数据查询，支持查询上周、本月、最近N天等各种时间维度的数据。

## 文件说明

- `user_analytics_view.sql` - 主视图定义
- `dynamic_user_analytics_queries.sql` - 动态查询示例
- `time_range_calculator.sql` - 时间范围计算器
- `parameterized_user_analytics_queries.sql` - 参数化查询模板

## 查询方式

### 1. 直接指定日期范围

```sql
-- 查询上周留存数据（2025年10月14日-10月20日）
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
WHERE cohort_date BETWEEN '2025-10-14' AND '2025-10-20'
ORDER BY stat_type, merchant, game_id, cohort_date;
```

### 2. 动态计算时间范围

```sql
-- 查询上周留存数据（动态计算上周日期范围）
WITH last_week_range AS (
  SELECT 
    DATE_FORMAT(DATE_ADD('day', -7, CURRENT_DATE), '%Y-%m-%d') AS start_date,
    DATE_FORMAT(DATE_ADD('day', -1, CURRENT_DATE), '%Y-%m-%d') AS end_date
)
SELECT 
  v.stat_type,
  v.merchant,
  v.game_id,
  v.cohort_date,
  v.d0_users,
  v.d1_users,
  v.d1_retention_rate,
  v.d3_users,
  v.d3_retention_rate,
  v.d7_users,
  v.d7_retention_rate,
  v.d14_users,
  v.d14_retention_rate,
  v.d30_users,
  v.d30_retention_rate
FROM user_analytics_view v
CROSS JOIN last_week_range lwr
WHERE v.cohort_date BETWEEN lwr.start_date AND lwr.end_date
ORDER BY v.stat_type, v.merchant, v.game_id, v.cohort_date;
```

### 3. 使用时间范围计算器

```sql
-- 获取各种时间范围
SELECT * FROM (
  WITH time_ranges AS (
    SELECT 
      DATE_FORMAT(DATE_ADD('day', -7, DATE_TRUNC('week', CURRENT_DATE)), '%Y-%m-%d') AS last_week_start,
      DATE_FORMAT(DATE_ADD('day', -1, DATE_TRUNC('week', CURRENT_DATE)), '%Y-%m-%d') AS last_week_end
  )
  SELECT 
    'last_week' AS time_period,
    last_week_start AS start_date,
    last_week_end AS end_date
  FROM time_ranges
) t;
```

## 常用查询模板

### 1. 查询上周留存数据

```sql
-- 替换日期为实际的上周日期范围
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
WHERE cohort_date BETWEEN '2025-10-14' AND '2025-10-20'
ORDER BY stat_type, merchant, game_id, cohort_date;
```

### 2. 查询本月留存数据

```sql
-- 替换日期为本月的日期范围
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
WHERE cohort_date BETWEEN '2025-10-01' AND '2025-10-31'
ORDER BY stat_type, merchant, game_id, cohort_date;
```

### 3. 查询最近7天留存数据

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
WHERE cohort_date >= DATE_FORMAT(DATE_ADD('day', -7, CURRENT_DATE), '%Y-%m-%d')
ORDER BY stat_type, merchant, game_id, cohort_date;
```

### 4. 查询特定商户的留存数据

```sql
-- 替换商户ID和日期范围
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
WHERE merchant = '1698202251'
  AND cohort_date BETWEEN '2025-10-14' AND '2025-10-20'
ORDER BY stat_type, game_id, cohort_date;
```

### 5. 查询特定游戏的留存数据

```sql
-- 替换游戏ID和日期范围
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
WHERE game_id = '1698217736002'
  AND cohort_date BETWEEN '2025-10-14' AND '2025-10-20'
ORDER BY stat_type, merchant, cohort_date;
```

## 汇总查询

### 1. 按统计类型汇总

```sql
SELECT 
  stat_type,
  COUNT(DISTINCT merchant) AS unique_merchants,
  COUNT(DISTINCT game_id) AS unique_games,
  COUNT(DISTINCT cohort_date) AS unique_dates,
  SUM(d0_users) AS total_d0_users,
  SUM(d1_users) AS total_d1_users,
  SUM(d7_users) AS total_d7_users,
  SUM(d30_users) AS total_d30_users,
  ROUND(AVG(d1_retention_rate), 2) AS avg_d1_retention_rate,
  ROUND(AVG(d7_retention_rate), 2) AS avg_d7_retention_rate,
  ROUND(AVG(d30_retention_rate), 2) AS avg_d30_retention_rate
FROM user_analytics_view 
WHERE cohort_date BETWEEN '2025-10-14' AND '2025-10-20'
GROUP BY stat_type
ORDER BY stat_type;
```

### 2. 按商户汇总

```sql
SELECT 
  stat_type,
  merchant,
  COUNT(DISTINCT cohort_date) AS unique_dates,
  SUM(d0_users) AS total_d0_users,
  SUM(d1_users) AS total_d1_users,
  SUM(d7_users) AS total_d7_users,
  SUM(d30_users) AS total_d30_users,
  ROUND(AVG(d1_retention_rate), 2) AS avg_d1_retention_rate,
  ROUND(AVG(d7_retention_rate), 2) AS avg_d7_retention_rate,
  ROUND(AVG(d30_retention_rate), 2) AS avg_d30_retention_rate
FROM user_analytics_view 
WHERE cohort_date BETWEEN '2025-10-14' AND '2025-10-20'
GROUP BY stat_type, merchant
ORDER BY stat_type, total_d0_users DESC;
```

## 时间范围计算

### 常用时间范围计算

```sql
-- 上周（周一到周日）
DATE_FORMAT(DATE_ADD('day', -7, DATE_TRUNC('week', CURRENT_DATE)), '%Y-%m-%d') AS last_week_start
DATE_FORMAT(DATE_ADD('day', -1, DATE_TRUNC('week', CURRENT_DATE)), '%Y-%m-%d') AS last_week_end

-- 本周（周一到周日）
DATE_FORMAT(DATE_TRUNC('week', CURRENT_DATE), '%Y-%m-%d') AS this_week_start
DATE_FORMAT(DATE_ADD('day', 6, DATE_TRUNC('week', CURRENT_DATE)), '%Y-%m-%d') AS this_week_end

-- 上月（1号到最后一天）
DATE_FORMAT(DATE_TRUNC('month', DATE_ADD('month', -1, CURRENT_DATE)), '%Y-%m-%d') AS last_month_start
DATE_FORMAT(DATE_ADD('day', -1, DATE_TRUNC('month', CURRENT_DATE)), '%Y-%m-%d') AS last_month_end

-- 本月（1号到最后一天）
DATE_FORMAT(DATE_TRUNC('month', CURRENT_DATE), '%Y-%m-%d') AS this_month_start
DATE_FORMAT(DATE_ADD('day', -1, DATE_TRUNC('month', DATE_ADD('month', 1, CURRENT_DATE))), '%Y-%m-%d') AS this_month_end

-- 最近7天
DATE_FORMAT(DATE_ADD('day', -7, CURRENT_DATE), '%Y-%m-%d') AS last_7_days_start
DATE_FORMAT(CURRENT_DATE, '%Y-%m-%d') AS last_7_days_end

-- 最近30天
DATE_FORMAT(DATE_ADD('day', -30, CURRENT_DATE), '%Y-%m-%d') AS last_30_days_start
DATE_FORMAT(CURRENT_DATE, '%Y-%m-%d') AS last_30_days_end
```

## 注意事项

1. **日期格式**：所有日期都使用 `YYYY-MM-DD` 格式
2. **时间范围**：确保查询的时间范围在视图数据范围内
3. **性能优化**：对于大量数据查询，建议使用适当的过滤条件
4. **数据更新**：视图数据基于 `game_records` 表，数据更新后需要重新查询

## 示例场景

### 场景1：查询上周留存数据
```sql
-- 查询2025年10月14日-10月20日这一周的留存数据
WHERE cohort_date BETWEEN '2025-10-14' AND '2025-10-20'
```

### 场景2：查询本月留存数据
```sql
-- 查询2025年10月整个月的留存数据
WHERE cohort_date BETWEEN '2025-10-01' AND '2025-10-31'
```

### 场景3：查询最近7天留存数据
```sql
-- 查询最近7天的留存数据
WHERE cohort_date >= DATE_FORMAT(DATE_ADD('day', -7, CURRENT_DATE), '%Y-%m-%d')
```

现在你可以根据需要查询各种时间范围的留存数据了！






