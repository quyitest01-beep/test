-- 用户分析视图查询示例
-- 支持动态时间范围的留存数据查询

-- 1. 查询商户维度新用户留存数据（包含留存率）
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
  AND merchant = '1698202251'  -- 指定商户
ORDER BY cohort_date;

-- 2. 查询商户维度活跃用户留存数据（包含留存率）
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
WHERE stat_type = 'merchant_active_user_retention'
  AND merchant = '1698202251'  -- 指定商户
ORDER BY cohort_date;

-- 3. 查询游戏维度新用户留存数据（包含留存率）
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
WHERE stat_type = 'game_new_user_retention'
  AND merchant = '1698202251'  -- 指定商户
  AND game_id = '1698217736002'  -- 指定游戏
ORDER BY cohort_date;

-- 4. 查询游戏维度活跃用户留存数据（包含留存率）
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
  AND merchant = '1698202251'  -- 指定商户
  AND game_id = '1698217736002'  -- 指定游戏
ORDER BY cohort_date;

-- 5. 查询所有商户的新用户留存汇总
SELECT 
  merchant,
  COUNT(DISTINCT cohort_date) AS total_days,
  SUM(d0_users) AS total_new_users,
  SUM(d1_users) AS total_d1_users,
  SUM(d7_users) AS total_d7_users,
  SUM(d30_users) AS total_d30_users,
  ROUND(AVG(CASE WHEN d0_users > 0 THEN CAST(d1_users AS DOUBLE) / d0_users END), 4) AS avg_d1_retention,
  ROUND(AVG(CASE WHEN d0_users > 0 THEN CAST(d7_users AS DOUBLE) / d0_users END), 4) AS avg_d7_retention,
  ROUND(AVG(CASE WHEN d0_users > 0 THEN CAST(d30_users AS DOUBLE) / d0_users END), 4) AS avg_d30_retention
FROM user_analytics_view 
WHERE stat_type = 'merchant_new_user_retention'
GROUP BY merchant
ORDER BY total_new_users DESC;

-- 6. 查询所有游戏的活跃用户留存汇总
SELECT 
  merchant,
  game_id,
  COUNT(DISTINCT cohort_date) AS total_days,
  SUM(d0_users) AS total_active_users,
  SUM(d1_users) AS total_d1_users,
  SUM(d7_users) AS total_d7_users,
  SUM(d30_users) AS total_d30_users,
  ROUND(AVG(CASE WHEN d0_users > 0 THEN CAST(d1_users AS DOUBLE) / d0_users END), 4) AS avg_d1_retention,
  ROUND(AVG(CASE WHEN d0_users > 0 THEN CAST(d7_users AS DOUBLE) / d0_users END), 4) AS avg_d7_retention,
  ROUND(AVG(CASE WHEN d0_users > 0 THEN CAST(d30_users AS DOUBLE) / d0_users END), 4) AS avg_d30_retention
FROM user_analytics_view 
WHERE stat_type = 'game_active_user_retention'
GROUP BY merchant, game_id
ORDER BY total_active_users DESC;

-- 7. 查询特定日期的所有数据
SELECT 
  stat_type,
  merchant,
  game_id,
  cohort_date,
  d0_users,
  d1_users,
  d3_users,
  d7_users,
  d14_users,
  d30_users
FROM user_analytics_view 
WHERE cohort_date = '2025-10-01'
ORDER BY stat_type, merchant, game_id;

-- 8. 查询留存率分析
SELECT 
  stat_type,
  merchant,
  game_id,
  cohort_date,
  d0_users,
  d1_users,
  d7_users,
  d30_users,
  CASE WHEN d0_users > 0 THEN ROUND(CAST(d1_users AS DOUBLE) / d0_users * 100, 2) END AS d1_retention_rate,
  CASE WHEN d0_users > 0 THEN ROUND(CAST(d7_users AS DOUBLE) / d0_users * 100, 2) END AS d7_retention_rate,
  CASE WHEN d0_users > 0 THEN ROUND(CAST(d30_users AS DOUBLE) / d0_users * 100, 2) END AS d30_retention_rate
FROM user_analytics_view 
WHERE d0_users > 0
ORDER BY stat_type, merchant, game_id, cohort_date;

-- ==================== 动态时间查询示例 ====================

-- 11. 查询上周留存数据（动态计算上周日期范围）
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

-- 12. 查询本月留存数据（动态计算本月日期范围）
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

-- 13. 查询最近7天留存数据
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

-- 14. 查询最近30天留存数据
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

-- 15. 查询指定时间范围的留存数据（参数化查询）
-- 使用方法：替换 {START_DATE} 和 {END_DATE} 为实际的日期范围
-- 示例：查询2025年10月14日-10月20日的留存数据
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
