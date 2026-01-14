-- 参数化用户分析查询模板
-- 支持动态时间范围的留存数据查询

-- 使用方法：
-- 1. 替换 {START_DATE} 和 {END_DATE} 为实际的日期范围
-- 2. 可选：替换 {MERCHANT_ID} 和 {GAME_ID} 为具体的商户或游戏ID

-- 模板1：查询指定时间范围的留存数据
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
WHERE cohort_date BETWEEN '{START_DATE}' AND '{END_DATE}'
ORDER BY stat_type, merchant, game_id, cohort_date;

-- 模板2：查询指定商户的指定时间范围留存数据
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
WHERE merchant = '{MERCHANT_ID}'
  AND cohort_date BETWEEN '{START_DATE}' AND '{END_DATE}'
ORDER BY stat_type, game_id, cohort_date;

-- 模板3：查询指定游戏的指定时间范围留存数据
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
WHERE game_id = '{GAME_ID}'
  AND cohort_date BETWEEN '{START_DATE}' AND '{END_DATE}'
ORDER BY stat_type, merchant, cohort_date;

-- 模板4：查询指定时间范围的留存数据汇总（按统计类型）
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
WHERE cohort_date BETWEEN '{START_DATE}' AND '{END_DATE}'
GROUP BY stat_type
ORDER BY stat_type;

-- 模板5：查询指定时间范围的留存数据汇总（按商户）
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
WHERE cohort_date BETWEEN '{START_DATE}' AND '{END_DATE}'
GROUP BY stat_type, merchant
ORDER BY stat_type, total_d0_users DESC;

-- 模板6：查询指定时间范围的留存数据汇总（按游戏）
SELECT 
  stat_type,
  game_id,
  COUNT(DISTINCT merchant) AS unique_merchants,
  COUNT(DISTINCT cohort_date) AS unique_dates,
  SUM(d0_users) AS total_d0_users,
  SUM(d1_users) AS total_d1_users,
  SUM(d7_users) AS total_d7_users,
  SUM(d30_users) AS total_d30_users,
  ROUND(AVG(d1_retention_rate), 2) AS avg_d1_retention_rate,
  ROUND(AVG(d7_retention_rate), 2) AS avg_d7_retention_rate,
  ROUND(AVG(d30_retention_rate), 2) AS avg_d30_retention_rate
FROM user_analytics_view 
WHERE cohort_date BETWEEN '{START_DATE}' AND '{END_DATE}'
GROUP BY stat_type, game_id
ORDER BY stat_type, total_d0_users DESC;

-- 实际使用示例：

-- 示例1：查询上周留存数据（2025年10月14日-10月20日）
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

-- 示例2：查询指定商户的上周留存数据
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

-- 示例3：查询指定游戏的上周留存数据
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

-- 示例4：查询上周留存数据汇总
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






