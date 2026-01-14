-- 测试用户分析视图的查询示例

-- 1. 查看视图结构
DESCRIBE user_analytics_view;

-- 2. 查看视图中的数据样本
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
LIMIT 10;

-- 3. 查看各统计类型的数据量
SELECT 
  stat_type,
  COUNT(*) AS record_count,
  COUNT(DISTINCT merchant) AS unique_merchants,
  COUNT(DISTINCT game_id) AS unique_games,
  COUNT(DISTINCT cohort_date) AS unique_dates
FROM user_analytics_view 
GROUP BY stat_type
ORDER BY stat_type;

-- 4. 查看留存率分布
SELECT 
  stat_type,
  merchant,
  COUNT(*) AS total_records,
  AVG(d1_retention_rate) AS avg_d1_retention,
  AVG(d7_retention_rate) AS avg_d7_retention,
  AVG(d30_retention_rate) AS avg_d30_retention,
  MIN(d1_retention_rate) AS min_d1_retention,
  MAX(d1_retention_rate) AS max_d1_retention
FROM user_analytics_view 
WHERE d0_users > 0
GROUP BY stat_type, merchant
ORDER BY stat_type, avg_d1_retention DESC;

-- 5. 查看特定日期的数据
SELECT 
  stat_type,
  merchant,
  game_id,
  cohort_date,
  d0_users,
  d1_users,
  d1_retention_rate,
  d7_users,
  d7_retention_rate,
  d30_users,
  d30_retention_rate
FROM user_analytics_view 
WHERE cohort_date = '2025-10-01'
ORDER BY stat_type, merchant, game_id;






