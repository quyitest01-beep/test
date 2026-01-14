-- Athena视图：用户分析综合视图
-- 支持游戏维度和商户维度的新用户、活跃用户查询
-- 过滤掉商户id=10001的数据
-- 支持动态时间查询

-- 创建参数化视图（需要传入查询参数）
-- 使用方法：SELECT * FROM user_analytics_view WHERE cohort_date BETWEEN '2025-10-01' AND '2025-10-07'

CREATE OR REPLACE VIEW user_analytics_view AS

-- 商户维度新用户留存分析
WITH merchant_new_user_retention AS (
  WITH
  first_seen AS (
    SELECT
      gr.merchant,
      gr.uid,
      MIN(DATE_PARSE(SUBSTR(CAST(gr.hour AS VARCHAR), 1, 8), '%Y%m%d')) AS first_event_date
    FROM game_records gr
    WHERE gr.provider IN ('gp', 'popular')
      AND gr.merchant != '10001'  -- 过滤掉商户id=10001
      AND CAST(gr.hour AS VARCHAR) <= '2025103023'
    GROUP BY gr.merchant, gr.uid
  ),
  cohort_new AS (                                                
    SELECT
      fs.merchant,
      fs.uid,
      fs.first_event_date AS cohort_date
    FROM first_seen fs
    WHERE fs.first_event_date BETWEEN DATE '2025-09-01' AND DATE '2025-10-30'
  ),
  events_window AS (                                            
    SELECT
      gr.merchant,
      gr.uid,
      DATE_PARSE(SUBSTR(CAST(gr.hour AS VARCHAR), 1, 8), '%Y%m%d') AS event_date
    FROM game_records gr
    WHERE gr.provider IN ('gp', 'popular')
      AND gr.merchant != '10001'  -- 过滤掉商户id=10001
      AND SUBSTR(CAST(gr.hour AS VARCHAR), 1, 8) BETWEEN '20250901' AND '20251030'
  )
  SELECT
    c.merchant,
    DATE_FORMAT(c.cohort_date, '%Y-%m-%d') AS cohort_date,
    COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date                          THEN c.uid END) AS d0_users,
    COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 1,  c.cohort_date)     THEN c.uid END) AS d1_users,
    CASE WHEN COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END) > 0 
         THEN ROUND(CAST(COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 1, c.cohort_date) THEN c.uid END) AS DOUBLE) / COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END) * 100, 2)
         ELSE 0 END AS d1_retention_rate,
    COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 3,  c.cohort_date)     THEN c.uid END) AS d3_users,
    CASE WHEN COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END) > 0 
         THEN ROUND(CAST(COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 3, c.cohort_date) THEN c.uid END) AS DOUBLE) / COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END) * 100, 2)
         ELSE 0 END AS d3_retention_rate,
    COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 7,  c.cohort_date)     THEN c.uid END) AS d7_users,
    CASE WHEN COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END) > 0 
         THEN ROUND(CAST(COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 7, c.cohort_date) THEN c.uid END) AS DOUBLE) / COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END) * 100, 2)
         ELSE 0 END AS d7_retention_rate,
    COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 14, c.cohort_date)     THEN c.uid END) AS d14_users,
    CASE WHEN COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END) > 0 
         THEN ROUND(CAST(COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 14, c.cohort_date) THEN c.uid END) AS DOUBLE) / COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END) * 100, 2)
         ELSE 0 END AS d14_retention_rate,
    COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 30, c.cohort_date)     THEN c.uid END) AS d30_users,
    CASE WHEN COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END) > 0 
         THEN ROUND(CAST(COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 30, c.cohort_date) THEN c.uid END) AS DOUBLE) / COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END) * 100, 2)
         ELSE 0 END AS d30_retention_rate,
    'merchant_new_user_retention' AS stat_type
  FROM cohort_new c
  LEFT JOIN events_window e
    ON e.merchant  = c.merchant
   AND e.uid       = c.uid
   AND e.event_date IN (
         c.cohort_date,
         DATE_ADD('day', 1,  c.cohort_date),
         DATE_ADD('day', 3,  c.cohort_date),
         DATE_ADD('day', 7,  c.cohort_date),
         DATE_ADD('day', 14, c.cohort_date),
         DATE_ADD('day', 30, c.cohort_date)
       )
  GROUP BY c.merchant, c.cohort_date
),

-- 商户维度活跃用户留存分析
merchant_active_user_retention AS (
  WITH
  cohort AS (
    SELECT
      gr.merchant,
      DATE_PARSE(SUBSTR(CAST(gr.hour AS VARCHAR), 1, 8), '%Y%m%d') AS cohort_date,
      gr.uid
    FROM game_records gr
    WHERE gr.provider IN ('gp', 'popular')
      AND gr.merchant != '10001'  -- 过滤掉商户id=10001
      AND SUBSTR(CAST(gr.hour AS VARCHAR), 1, 8) BETWEEN '20250929' AND '20251005'
    GROUP BY gr.merchant,
             DATE_PARSE(SUBSTR(CAST(gr.hour AS VARCHAR), 1, 8), '%Y%m%d'),
             gr.uid
  ),
  events_window AS (
    SELECT
      gr.merchant,
      gr.uid,
      DATE_PARSE(SUBSTR(CAST(gr.hour AS VARCHAR), 1, 8), '%Y%m%d') AS event_date
    FROM game_records gr
    WHERE gr.provider IN ('gp', 'popular')
      AND gr.merchant != '10001'  -- 过滤掉商户id=10001
      AND SUBSTR(CAST(gr.hour AS VARCHAR), 1, 8) BETWEEN '20250929' AND '20251005'
  )
  SELECT
    c.merchant,
    DATE_FORMAT(c.cohort_date, '%Y-%m-%d') AS cohort_date,
    COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date                          THEN c.uid END) AS d0_users,
    COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 1,  c.cohort_date)     THEN c.uid END) AS d1_users,
    CASE WHEN COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END) > 0 
         THEN ROUND(CAST(COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 1, c.cohort_date) THEN c.uid END) AS DOUBLE) / COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END) * 100, 2)
         ELSE 0 END AS d1_retention_rate,
    COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 3,  c.cohort_date)     THEN c.uid END) AS d3_users,
    CASE WHEN COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END) > 0 
         THEN ROUND(CAST(COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 3, c.cohort_date) THEN c.uid END) AS DOUBLE) / COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END) * 100, 2)
         ELSE 0 END AS d3_retention_rate,
    COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 7,  c.cohort_date)     THEN c.uid END) AS d7_users,
    CASE WHEN COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END) > 0 
         THEN ROUND(CAST(COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 7, c.cohort_date) THEN c.uid END) AS DOUBLE) / COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END) * 100, 2)
         ELSE 0 END AS d7_retention_rate,
    COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 14, c.cohort_date)     THEN c.uid END) AS d14_users,
    CASE WHEN COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END) > 0 
         THEN ROUND(CAST(COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 14, c.cohort_date) THEN c.uid END) AS DOUBLE) / COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END) * 100, 2)
         ELSE 0 END AS d14_retention_rate,
    COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 30, c.cohort_date)     THEN c.uid END) AS d30_users,
    CASE WHEN COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END) > 0 
         THEN ROUND(CAST(COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 30, c.cohort_date) THEN c.uid END) AS DOUBLE) / COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END) * 100, 2)
         ELSE 0 END AS d30_retention_rate,
    'merchant_active_user_retention' AS stat_type
  FROM cohort c
  LEFT JOIN events_window e
    ON e.merchant = c.merchant
   AND e.uid      = c.uid
   AND e.event_date IN (
         c.cohort_date,
         DATE_ADD('day', 1,  c.cohort_date),
         DATE_ADD('day', 3,  c.cohort_date),
         DATE_ADD('day', 7,  c.cohort_date),
         DATE_ADD('day', 14, c.cohort_date),
         DATE_ADD('day', 30, c.cohort_date)
       )
  GROUP BY c.merchant, c.cohort_date
),

-- 游戏维度新用户留存分析
game_new_user_retention AS (
  WITH
  first_seen AS (
    SELECT
      gr.merchant,
      gr.game_id,
      gr.uid,
      MIN(DATE_PARSE(SUBSTR(CAST(gr.hour AS VARCHAR), 1, 8), '%Y%m%d')) AS first_event_date
    FROM game_records gr
    WHERE gr.provider IN ('gp', 'popular')
      AND gr.merchant != '10001'  -- 过滤掉商户id=10001
      AND CAST(gr.hour AS VARCHAR) <= '2025103023'
    GROUP BY gr.merchant, gr.game_id, gr.uid
  ),
  cohort_new AS (                                                
    SELECT
      fs.merchant,
      fs.game_id,
      fs.uid,
      fs.first_event_date AS cohort_date
    FROM first_seen fs
    WHERE fs.first_event_date BETWEEN DATE '2025-09-01' AND DATE '2025-10-30'
  ),
  events_window AS (                                            
    SELECT
      gr.merchant,
      gr.game_id,
      gr.uid,
      DATE_PARSE(SUBSTR(CAST(gr.hour AS VARCHAR), 1, 8), '%Y%m%d') AS event_date
    FROM game_records gr
    WHERE gr.provider IN ('gp', 'popular')
      AND gr.merchant != '10001'  -- 过滤掉商户id=10001
      AND SUBSTR(CAST(gr.hour AS VARCHAR), 1, 8) BETWEEN '20250901' AND '20251030'
  )
  SELECT
    c.merchant,
    c.game_id,
    DATE_FORMAT(c.cohort_date, '%Y-%m-%d') AS cohort_date,
    COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date                          THEN c.uid END) AS d0_users,
    COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 1,  c.cohort_date)     THEN c.uid END) AS d1_users,
    CASE WHEN COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END) > 0 
         THEN ROUND(CAST(COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 1, c.cohort_date) THEN c.uid END) AS DOUBLE) / COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END) * 100, 2)
         ELSE 0 END AS d1_retention_rate,
    COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 3,  c.cohort_date)     THEN c.uid END) AS d3_users,
    CASE WHEN COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END) > 0 
         THEN ROUND(CAST(COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 3, c.cohort_date) THEN c.uid END) AS DOUBLE) / COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END) * 100, 2)
         ELSE 0 END AS d3_retention_rate,
    COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 7,  c.cohort_date)     THEN c.uid END) AS d7_users,
    CASE WHEN COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END) > 0 
         THEN ROUND(CAST(COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 7, c.cohort_date) THEN c.uid END) AS DOUBLE) / COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END) * 100, 2)
         ELSE 0 END AS d7_retention_rate,
    COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 14, c.cohort_date)     THEN c.uid END) AS d14_users,
    CASE WHEN COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END) > 0 
         THEN ROUND(CAST(COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 14, c.cohort_date) THEN c.uid END) AS DOUBLE) / COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END) * 100, 2)
         ELSE 0 END AS d14_retention_rate,
    COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 30, c.cohort_date)     THEN c.uid END) AS d30_users,
    CASE WHEN COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END) > 0 
         THEN ROUND(CAST(COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 30, c.cohort_date) THEN c.uid END) AS DOUBLE) / COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END) * 100, 2)
         ELSE 0 END AS d30_retention_rate,
    'game_new_user_retention' AS stat_type
  FROM cohort_new c
  LEFT JOIN events_window e
    ON e.merchant  = c.merchant
   AND e.game_id = c.game_id
   AND e.uid       = c.uid
   AND e.event_date IN (
         c.cohort_date,
         DATE_ADD('day', 1,  c.cohort_date),
         DATE_ADD('day', 3,  c.cohort_date),
         DATE_ADD('day', 7,  c.cohort_date),
         DATE_ADD('day', 14, c.cohort_date),
         DATE_ADD('day', 30, c.cohort_date)
       )
  GROUP BY c.merchant, c.game_id, c.cohort_date
),

-- 游戏维度活跃用户留存分析
game_active_user_retention AS (
  WITH
  cohort AS (
    SELECT
      gr.merchant,
      gr.game_id,
      DATE_PARSE(SUBSTR(CAST(gr.hour AS VARCHAR), 1, 8), '%Y%m%d') AS cohort_date,
      gr.uid
    FROM game_records gr
    WHERE gr.provider IN ('gp', 'popular')
      AND gr.merchant != '10001'  -- 过滤掉商户id=10001
      AND SUBSTR(CAST(gr.hour AS VARCHAR), 1, 8) BETWEEN '20250901' AND '20251030'
    GROUP BY
      gr.merchant,
      gr.game_id,
      DATE_PARSE(SUBSTR(CAST(gr.hour AS VARCHAR), 1, 8), '%Y%m%d'),
      gr.uid
  ),
  events_window AS (
    SELECT
      gr.merchant,
      gr.game_id,
      gr.uid,
      DATE_PARSE(SUBSTR(CAST(gr.hour AS VARCHAR), 1, 8), '%Y%m%d') AS event_date
    FROM game_records gr
    WHERE gr.provider IN ('gp', 'popular')
      AND gr.merchant != '10001'  -- 过滤掉商户id=10001
      AND SUBSTR(CAST(gr.hour AS VARCHAR), 1, 8) BETWEEN '20250901' AND '20251030'
  )
  SELECT
    c.merchant,
    c.game_id,
    DATE_FORMAT(c.cohort_date, '%Y-%m-%d') AS cohort_date,
    COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date                          THEN c.uid END) AS d0_users,
    COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 1,  c.cohort_date)     THEN c.uid END) AS d1_users,
    CASE WHEN COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END) > 0 
         THEN ROUND(CAST(COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 1, c.cohort_date) THEN c.uid END) AS DOUBLE) / COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END) * 100, 2)
         ELSE 0 END AS d1_retention_rate,
    COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 3,  c.cohort_date)     THEN c.uid END) AS d3_users,
    CASE WHEN COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END) > 0 
         THEN ROUND(CAST(COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 3, c.cohort_date) THEN c.uid END) AS DOUBLE) / COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END) * 100, 2)
         ELSE 0 END AS d3_retention_rate,
    COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 7,  c.cohort_date)     THEN c.uid END) AS d7_users,
    CASE WHEN COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END) > 0 
         THEN ROUND(CAST(COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 7, c.cohort_date) THEN c.uid END) AS DOUBLE) / COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END) * 100, 2)
         ELSE 0 END AS d7_retention_rate,
    COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 14, c.cohort_date)     THEN c.uid END) AS d14_users,
    CASE WHEN COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END) > 0 
         THEN ROUND(CAST(COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 14, c.cohort_date) THEN c.uid END) AS DOUBLE) / COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END) * 100, 2)
         ELSE 0 END AS d14_retention_rate,
    COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 30, c.cohort_date)     THEN c.uid END) AS d30_users,
    CASE WHEN COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END) > 0 
         THEN ROUND(CAST(COUNT(DISTINCT CASE WHEN e.event_date = DATE_ADD('day', 30, c.cohort_date) THEN c.uid END) AS DOUBLE) / COUNT(DISTINCT CASE WHEN e.event_date = c.cohort_date THEN c.uid END) * 100, 2)
         ELSE 0 END AS d30_retention_rate,
    'game_active_user_retention' AS stat_type
  FROM cohort c
  LEFT JOIN events_window e
    ON e.merchant  = c.merchant
   AND e.game_id = c.game_id
   AND e.uid       = c.uid
   AND e.event_date IN (
         c.cohort_date,
         DATE_ADD('day', 1,  c.cohort_date),
         DATE_ADD('day', 3,  c.cohort_date),
         DATE_ADD('day', 7,  c.cohort_date),
         DATE_ADD('day', 14, c.cohort_date),
         DATE_ADD('day', 30, c.cohort_date)
       )
  GROUP BY c.merchant, c.game_id, c.cohort_date
)

-- 合并所有结果
SELECT 
  merchant,
  NULL AS game_id,
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
  d30_retention_rate,
  stat_type
FROM merchant_new_user_retention

UNION ALL

SELECT 
  merchant,
  NULL AS game_id,
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
  d30_retention_rate,
  stat_type
FROM merchant_active_user_retention

UNION ALL

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
  d30_retention_rate,
  stat_type
FROM game_new_user_retention

UNION ALL

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
  d30_retention_rate,
  stat_type
FROM game_active_user_retention;
