-- 查询上月留存数据（动态计算上月日期范围）
-- 自动计算上月的第一天到最后一天

WITH last_month_range AS (
  SELECT 
    -- 计算上月的第一天
    DATE_FORMAT(DATE_TRUNC('month', DATE_ADD('month', -1, CURRENT_DATE)), '%Y-%m-%d') AS start_date,
    -- 计算上月的最后一天
    DATE_FORMAT(DATE_ADD('day', -1, DATE_TRUNC('month', CURRENT_DATE)), '%Y-%m-%d') AS end_date
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
CROSS JOIN last_month_range lmr
WHERE v.cohort_date BETWEEN lmr.start_date AND lmr.end_date
ORDER BY v.stat_type, v.merchant, v.game_id, v.cohort_date;

-- 查询上月留存数据汇总（按统计类型）
WITH last_month_range AS (
  SELECT 
    DATE_FORMAT(DATE_TRUNC('month', DATE_ADD('month', -1, CURRENT_DATE)), '%Y-%m-%d') AS start_date,
    DATE_FORMAT(DATE_ADD('day', -1, DATE_TRUNC('month', CURRENT_DATE)), '%Y-%m-%d') AS end_date
)
SELECT 
  v.stat_type,
  COUNT(DISTINCT v.merchant) AS unique_merchants,
  COUNT(DISTINCT v.game_id) AS unique_games,
  COUNT(DISTINCT v.cohort_date) AS unique_dates,
  SUM(v.d0_users) AS total_d0_users,
  SUM(v.d1_users) AS total_d1_users,
  SUM(v.d7_users) AS total_d7_users,
  SUM(v.d30_users) AS total_d30_users,
  ROUND(AVG(v.d1_retention_rate), 2) AS avg_d1_retention_rate,
  ROUND(AVG(v.d7_retention_rate), 2) AS avg_d7_retention_rate,
  ROUND(AVG(v.d30_retention_rate), 2) AS avg_d30_retention_rate,
  lmr.start_date,
  lmr.end_date
FROM user_analytics_view v
CROSS JOIN last_month_range lmr
WHERE v.cohort_date BETWEEN lmr.start_date AND lmr.end_date
GROUP BY v.stat_type, lmr.start_date, lmr.end_date
ORDER BY v.stat_type;

-- 查询上月留存数据汇总（按商户）
WITH last_month_range AS (
  SELECT 
    DATE_FORMAT(DATE_TRUNC('month', DATE_ADD('month', -1, CURRENT_DATE)), '%Y-%m-%d') AS start_date,
    DATE_FORMAT(DATE_ADD('day', -1, DATE_TRUNC('month', CURRENT_DATE)), '%Y-%m-%d') AS end_date
)
SELECT 
  v.stat_type,
  v.merchant,
  COUNT(DISTINCT v.cohort_date) AS unique_dates,
  SUM(v.d0_users) AS total_d0_users,
  SUM(v.d1_users) AS total_d1_users,
  SUM(v.d7_users) AS total_d7_users,
  SUM(v.d30_users) AS total_d30_users,
  ROUND(AVG(v.d1_retention_rate), 2) AS avg_d1_retention_rate,
  ROUND(AVG(v.d7_retention_rate), 2) AS avg_d7_retention_rate,
  ROUND(AVG(v.d30_retention_rate), 2) AS avg_d30_retention_rate,
  lmr.start_date,
  lmr.end_date
FROM user_analytics_view v
CROSS JOIN last_month_range lmr
WHERE v.cohort_date BETWEEN lmr.start_date AND lmr.end_date
GROUP BY v.stat_type, v.merchant, lmr.start_date, lmr.end_date
ORDER BY v.stat_type, total_d0_users DESC;

-- 查询特定商户的上月留存数据
WITH last_month_range AS (
  SELECT 
    DATE_FORMAT(DATE_TRUNC('month', DATE_ADD('month', -1, CURRENT_DATE)), '%Y-%m-%d') AS start_date,
    DATE_FORMAT(DATE_ADD('day', -1, DATE_TRUNC('month', CURRENT_DATE)), '%Y-%m-%d') AS end_date
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
CROSS JOIN last_month_range lmr
WHERE v.merchant = '1698202251'  -- 替换为实际的商户ID
  AND v.cohort_date BETWEEN lmr.start_date AND lmr.end_date
ORDER BY v.stat_type, v.game_id, v.cohort_date;

-- 查询特定游戏的上月留存数据
WITH last_month_range AS (
  SELECT 
    DATE_FORMAT(DATE_TRUNC('month', DATE_ADD('month', -1, CURRENT_DATE)), '%Y-%m-%d') AS start_date,
    DATE_FORMAT(DATE_ADD('day', -1, DATE_TRUNC('month', CURRENT_DATE)), '%Y-%m-%d') AS end_date
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
CROSS JOIN last_month_range lmr
WHERE v.game_id = '1698217736002'  -- 替换为实际的游戏ID
  AND v.cohort_date BETWEEN lmr.start_date AND lmr.end_date
ORDER BY v.stat_type, v.merchant, v.cohort_date;






