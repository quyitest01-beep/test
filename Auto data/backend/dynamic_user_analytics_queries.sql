-- 动态用户分析查询生成器
-- 支持各种时间维度的留存数据查询

-- 1. 查询上周留存数据（上周一到上周日）
-- 示例：查询2025年10月14日-10月20日这一周的留存数据
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

-- 2. 查询上周留存数据（动态计算上周日期范围）
-- 使用当前日期动态计算上周范围
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

-- 3. 查询本月留存数据
-- 示例：查询2025年10月整个月的留存数据
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

-- 4. 查询本月留存数据（动态计算本月日期范围）
WITH current_month_range AS (
  SELECT 
    DATE_FORMAT(DATE_TRUNC('month', CURRENT_DATE), '%Y-%m-%d') AS start_date,
    DATE_FORMAT(DATE_TRUNC('month', DATE_ADD('month', 1, CURRENT_DATE)) - INTERVAL '1' DAY, '%Y-%m-%d') AS end_date
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
CROSS JOIN current_month_range cmr
WHERE v.cohort_date BETWEEN cmr.start_date AND cmr.end_date
ORDER BY v.stat_type, v.merchant, v.game_id, v.cohort_date;

-- 5. 查询最近7天留存数据
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

-- 6. 查询最近30天留存数据
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
WHERE cohort_date >= DATE_FORMAT(DATE_ADD('day', -30, CURRENT_DATE), '%Y-%m-%d')
ORDER BY stat_type, merchant, game_id, cohort_date;

-- 7. 查询特定商户的上周留存数据
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

-- 8. 查询特定游戏的上周留存数据
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

-- 9. 查询上周留存数据汇总（按统计类型）
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

-- 10. 查询上周留存数据汇总（按商户）
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






