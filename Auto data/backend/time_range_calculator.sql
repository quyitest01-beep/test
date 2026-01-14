-- 时间范围计算器
-- 用于动态计算各种时间范围的起始和结束日期

-- 1. 上周时间范围计算
WITH last_week_calculation AS (
  SELECT 
    -- 计算上周一的日期
    DATE_FORMAT(DATE_ADD('day', -7, DATE_TRUNC('week', CURRENT_DATE)), '%Y-%m-%d') AS last_week_start,
    -- 计算上周日的日期
    DATE_FORMAT(DATE_ADD('day', -1, DATE_TRUNC('week', CURRENT_DATE)), '%Y-%m-%d') AS last_week_end,
    -- 计算本周一的日期
    DATE_FORMAT(DATE_TRUNC('week', CURRENT_DATE), '%Y-%m-%d') AS this_week_start,
    -- 计算本周日的日期
    DATE_FORMAT(DATE_ADD('day', 6, DATE_TRUNC('week', CURRENT_DATE)), '%Y-%m-%d') AS this_week_end
)
SELECT 
  'last_week' AS time_period,
  last_week_start AS start_date,
  last_week_end AS end_date
FROM last_week_calculation

UNION ALL

SELECT 
  'this_week' AS time_period,
  this_week_start AS start_date,
  this_week_end AS end_date
FROM last_week_calculation;

-- 2. 上月时间范围计算
WITH last_month_calculation AS (
  SELECT 
    -- 计算上月的第一天
    DATE_FORMAT(DATE_TRUNC('month', DATE_ADD('month', -1, CURRENT_DATE)), '%Y-%m-%d') AS last_month_start,
    -- 计算上月的最后一天
    DATE_FORMAT(DATE_ADD('day', -1, DATE_TRUNC('month', CURRENT_DATE)), '%Y-%m-%d') AS last_month_end,
    -- 计算本月的第一天
    DATE_FORMAT(DATE_TRUNC('month', CURRENT_DATE), '%Y-%m-%d') AS this_month_start,
    -- 计算本月的最后一天
    DATE_FORMAT(DATE_ADD('day', -1, DATE_TRUNC('month', DATE_ADD('month', 1, CURRENT_DATE))), '%Y-%m-%d') AS this_month_end
)
SELECT 
  'last_month' AS time_period,
  last_month_start AS start_date,
  last_month_end AS end_date
FROM last_month_calculation

UNION ALL

SELECT 
  'this_month' AS time_period,
  this_month_start AS start_date,
  this_month_end AS end_date
FROM last_month_calculation;

-- 3. 最近N天时间范围计算
WITH recent_days_calculation AS (
  SELECT 
    -- 最近7天
    DATE_FORMAT(DATE_ADD('day', -7, CURRENT_DATE), '%Y-%m-%d') AS last_7_days_start,
    DATE_FORMAT(CURRENT_DATE, '%Y-%m-%d') AS last_7_days_end,
    -- 最近14天
    DATE_FORMAT(DATE_ADD('day', -14, CURRENT_DATE), '%Y-%m-%d') AS last_14_days_start,
    DATE_FORMAT(CURRENT_DATE, '%Y-%m-%d') AS last_14_days_end,
    -- 最近30天
    DATE_FORMAT(DATE_ADD('day', -30, CURRENT_DATE), '%Y-%m-%d') AS last_30_days_start,
    DATE_FORMAT(CURRENT_DATE, '%Y-%m-%d') AS last_30_days_end
)
SELECT 
  'last_7_days' AS time_period,
  last_7_days_start AS start_date,
  last_7_days_end AS end_date
FROM recent_days_calculation

UNION ALL

SELECT 
  'last_14_days' AS time_period,
  last_14_days_start AS start_date,
  last_14_days_end AS end_date
FROM recent_days_calculation

UNION ALL

SELECT 
  'last_30_days' AS time_period,
  last_30_days_start AS start_date,
  last_30_days_end AS end_date
FROM recent_days_calculation;

-- 4. 综合时间范围计算器
WITH time_ranges AS (
  SELECT 
    -- 上周
    DATE_FORMAT(DATE_ADD('day', -7, DATE_TRUNC('week', CURRENT_DATE)), '%Y-%m-%d') AS last_week_start,
    DATE_FORMAT(DATE_ADD('day', -1, DATE_TRUNC('week', CURRENT_DATE)), '%Y-%m-%d') AS last_week_end,
    -- 本周
    DATE_FORMAT(DATE_TRUNC('week', CURRENT_DATE), '%Y-%m-%d') AS this_week_start,
    DATE_FORMAT(DATE_ADD('day', 6, DATE_TRUNC('week', CURRENT_DATE)), '%Y-%m-%d') AS this_week_end,
    -- 上月
    DATE_FORMAT(DATE_TRUNC('month', DATE_ADD('month', -1, CURRENT_DATE)), '%Y-%m-%d') AS last_month_start,
    DATE_FORMAT(DATE_ADD('day', -1, DATE_TRUNC('month', CURRENT_DATE)), '%Y-%m-%d') AS last_month_end,
    -- 本月
    DATE_FORMAT(DATE_TRUNC('month', CURRENT_DATE), '%Y-%m-%d') AS this_month_start,
    DATE_FORMAT(DATE_ADD('day', -1, DATE_TRUNC('month', DATE_ADD('month', 1, CURRENT_DATE))), '%Y-%m-%d') AS this_month_end,
    -- 最近7天
    DATE_FORMAT(DATE_ADD('day', -7, CURRENT_DATE), '%Y-%m-%d') AS last_7_days_start,
    DATE_FORMAT(CURRENT_DATE, '%Y-%m-%d') AS last_7_days_end,
    -- 最近30天
    DATE_FORMAT(DATE_ADD('day', -30, CURRENT_DATE), '%Y-%m-%d') AS last_30_days_start,
    DATE_FORMAT(CURRENT_DATE, '%Y-%m-%d') AS last_30_days_end
)
SELECT 
  'last_week' AS time_period,
  last_week_start AS start_date,
  last_week_end AS end_date,
  '上周（周一到周日）' AS description
FROM time_ranges

UNION ALL

SELECT 
  'this_week' AS time_period,
  this_week_start AS start_date,
  this_week_end AS end_date,
  '本周（周一到周日）' AS description
FROM time_ranges

UNION ALL

SELECT 
  'last_month' AS time_period,
  last_month_start AS start_date,
  last_month_end AS end_date,
  '上月（1号到最后一天）' AS description
FROM time_ranges

UNION ALL

SELECT 
  'this_month' AS time_period,
  this_month_start AS start_date,
  this_month_end AS end_date,
  '本月（1号到最后一天）' AS description
FROM time_ranges

UNION ALL

SELECT 
  'last_7_days' AS time_period,
  last_7_days_start AS start_date,
  last_7_days_end AS end_date,
  '最近7天' AS description
FROM time_ranges

UNION ALL

SELECT 
  'last_30_days' AS time_period,
  last_30_days_start AS start_date,
  last_30_days_end AS end_date,
  '最近30天' AS description
FROM time_ranges

ORDER BY time_period;






