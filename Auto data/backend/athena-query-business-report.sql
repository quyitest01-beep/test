-- Athena SQL查询：业务数据报告统计查询
-- 支持周度和月度统计
-- 参数说明：
--   :start_date - 开始日期（格式：YYYY-MM-DD）
--   :end_date - 结束日期（格式：YYYY-MM-DD）
--   :previous_start_date - 上期开始日期（格式：YYYY-MM-DD）
--   :previous_end_date - 上期结束日期（格式：YYYY-MM-DD）
--   :new_game_release_month - 新游戏上线月份（格式：YYYY-MM，用于识别新游戏）

-- ============================================
-- 1. 总体数据统计（当前期）
-- ============================================
WITH current_period_overall AS (
  SELECT 
    SUM(CAST(ggr_usd AS DOUBLE)) AS total_ggr_usd,
    SUM(CAST(bet_amount_usd AS DOUBLE)) AS total_bet_usd,
    SUM(CAST(payout_amount_usd AS DOUBLE)) AS total_payout_usd,
    SUM(CAST(total_rounds AS BIGINT)) AS total_rounds,
    COUNT(DISTINCT user_id) AS total_active_users
  FROM game_transactions
  WHERE date_col >= :start_date 
    AND date_col <= :end_date
    AND game_name = '合计'  -- 只统计合计数据
),

-- ============================================
-- 2. 商户维度数据（当前期）
-- ============================================
current_period_merchants AS (
  SELECT 
    merchant_name,
    SUM(CAST(ggr_usd AS DOUBLE)) AS total_ggr_usd,
    SUM(CAST(bet_amount_usd AS DOUBLE)) AS total_bet_usd,
    SUM(CAST(payout_amount_usd AS DOUBLE)) AS total_payout_usd,
    SUM(CAST(total_rounds AS BIGINT)) AS total_rounds,
    COUNT(DISTINCT user_id) AS total_users
  FROM game_transactions
  WHERE date_col >= :start_date 
    AND date_col <= :end_date
    AND game_name = '合计'  -- 只统计合计数据
    AND merchant_name IS NOT NULL
    AND LENGTH(merchant_name) > 3  -- 过滤币种代码（3个大写字母）
    AND merchant_name NOT IN ('BRL', 'CLP', 'MXN', 'USD', 'EUR', 'INR', 'PHP', 'THB', 'AUD', 'MYR', 'ARS', 'BDT', 'PEN', 'COP')
  GROUP BY merchant_name
),

-- ============================================
-- 3. 游戏维度数据（当前期）
-- ============================================
current_period_games AS (
  SELECT 
    game_name,
    SUM(CAST(ggr_usd AS DOUBLE)) AS total_ggr_usd,
    SUM(CAST(bet_amount_usd AS DOUBLE)) AS total_bet_usd,
    SUM(CAST(payout_amount_usd AS DOUBLE)) AS total_payout_usd,
    SUM(CAST(total_rounds AS BIGINT)) AS total_rounds,
    COUNT(DISTINCT user_id) AS total_users
  FROM game_transactions
  WHERE date_col >= :start_date 
    AND date_col <= :end_date
    AND game_name != '合计'  -- 排除合计数据
    AND game_name IS NOT NULL
  GROUP BY game_name
),

-- ============================================
-- 4. 币种维度数据（当前期）
-- ============================================
current_period_currencies AS (
  SELECT 
    currency_code,
    SUM(CAST(ggr_usd AS DOUBLE)) AS total_ggr_usd,
    SUM(CAST(bet_amount_usd AS DOUBLE)) AS total_bet_usd,
    SUM(CAST(payout_amount_usd AS DOUBLE)) AS total_payout_usd,
    SUM(CAST(total_rounds AS BIGINT)) AS total_rounds
  FROM game_transactions
  WHERE date_col >= :start_date 
    AND date_col <= :end_date
    AND game_name != '合计'  -- 排除合计数据
    AND currency_code IS NOT NULL
  GROUP BY currency_code
),

-- ============================================
-- 5. 新游戏数据（当前期）
-- ============================================
new_games AS (
  SELECT DISTINCT game_name
  FROM game_releases
  WHERE release_date >= :new_game_release_month || '-01'
    AND release_date < DATE_ADD('month', 1, DATE_PARSE(:new_game_release_month || '-01', '%Y-%m-%d'))
),

current_period_new_games AS (
  SELECT 
    t.game_name,
    SUM(CAST(t.ggr_usd AS DOUBLE)) AS total_ggr_usd,
    SUM(CAST(t.bet_amount_usd AS DOUBLE)) AS total_bet_usd,
    SUM(CAST(t.payout_amount_usd AS DOUBLE)) AS total_payout_usd,
    SUM(CAST(t.total_rounds AS BIGINT)) AS total_rounds,
    COUNT(DISTINCT t.user_id) AS total_users,
    -- 新游戏商户排行
    t.merchant_name,
    SUM(CAST(t.ggr_usd AS DOUBLE)) AS merchant_ggr_usd,
    -- 新游戏币种排行
    t.currency_code,
    SUM(CAST(t.ggr_usd AS DOUBLE)) AS currency_ggr_usd
  FROM game_transactions t
  INNER JOIN new_games ng ON t.game_name = ng.game_name
  WHERE t.date_col >= :start_date 
    AND t.date_col <= :end_date
    AND t.game_name != '合计'
  GROUP BY t.game_name, t.merchant_name, t.currency_code
),

-- ============================================
-- 6. 上期数据（用于环比计算）
-- ============================================
previous_period_overall AS (
  SELECT 
    SUM(CAST(ggr_usd AS DOUBLE)) AS total_ggr_usd,
    SUM(CAST(bet_amount_usd AS DOUBLE)) AS total_bet_usd,
    SUM(CAST(payout_amount_usd AS DOUBLE)) AS total_payout_usd,
    SUM(CAST(total_rounds AS BIGINT)) AS total_rounds
  FROM game_transactions
  WHERE date_col >= :previous_start_date 
    AND date_col <= :previous_end_date
    AND game_name = '合计'
),

previous_period_merchants AS (
  SELECT 
    merchant_name,
    SUM(CAST(ggr_usd AS DOUBLE)) AS total_ggr_usd,
    SUM(CAST(bet_amount_usd AS DOUBLE)) AS total_bet_usd,
    COUNT(DISTINCT user_id) AS total_users
  FROM game_transactions
  WHERE date_col >= :previous_start_date 
    AND date_col <= :previous_end_date
    AND game_name = '合计'
    AND merchant_name IS NOT NULL
    AND LENGTH(merchant_name) > 3
    AND merchant_name NOT IN ('BRL', 'CLP', 'MXN', 'USD', 'EUR', 'INR', 'PHP', 'THB', 'AUD', 'MYR', 'ARS', 'BDT', 'PEN', 'COP')
  GROUP BY merchant_name
),

previous_period_games AS (
  SELECT 
    game_name,
    SUM(CAST(ggr_usd AS DOUBLE)) AS total_ggr_usd,
    SUM(CAST(bet_amount_usd AS DOUBLE)) AS total_bet_usd,
    SUM(CAST(payout_amount_usd AS DOUBLE)) AS total_payout_usd,
    SUM(CAST(total_rounds AS BIGINT)) AS total_rounds,
    COUNT(DISTINCT user_id) AS total_users
  FROM game_transactions
  WHERE date_col >= :previous_start_date 
    AND date_col <= :previous_end_date
    AND game_name != '合计'
  GROUP BY game_name
),

previous_period_currencies AS (
  SELECT 
    currency_code,
    SUM(CAST(ggr_usd AS DOUBLE)) AS total_ggr_usd
  FROM game_transactions
  WHERE date_col >= :previous_start_date 
    AND date_col <= :previous_end_date
    AND game_name != '合计'
  GROUP BY currency_code
),

-- ============================================
-- 7. 留存数据（当前期）
-- ============================================
current_period_retention AS (
  SELECT 
    merchant_name,
    game_name,
    date_col,
    daily_users,
    d1_retention,
    d7_retention,
    retention_type  -- 'new_user' 或 'active_user'
  FROM user_retention_data
  WHERE date_col >= :start_date 
    AND date_col <= :end_date
    AND daily_users >= 50  -- 只统计当日用户数>=50的数据
)

-- ============================================
-- 最终输出：组合所有数据
-- ============================================
SELECT 
  'current_period_overall' AS data_type,
  CAST(NULL AS VARCHAR) AS category,
  CAST(NULL AS VARCHAR) AS name,
  NULL AS current_value,
  NULL AS previous_value,
  NULL AS change_amount,
  NULL AS change_rate,
  NULL AS additional_data
FROM current_period_overall

UNION ALL

SELECT 
  'merchants' AS data_type,
  'merchant' AS category,
  merchant_name AS name,
  total_ggr_usd AS current_value,
  NULL AS previous_value,
  NULL AS change_amount,
  NULL AS change_rate,
  MAP(
    'total_bet_usd', CAST(total_bet_usd AS VARCHAR),
    'total_payout_usd', CAST(total_payout_usd AS VARCHAR),
    'total_rounds', CAST(total_rounds AS VARCHAR),
    'total_users', CAST(total_users AS VARCHAR),
    'avg_bet_per_user', CAST(CASE WHEN total_users > 0 THEN total_bet_usd / total_users ELSE 0 END AS VARCHAR)
  ) AS additional_data
FROM current_period_merchants

UNION ALL

SELECT 
  'games' AS data_type,
  'game' AS category,
  game_name AS name,
  total_ggr_usd AS current_value,
  NULL AS previous_value,
  NULL AS change_amount,
  NULL AS change_rate,
  MAP(
    'total_bet_usd', CAST(total_bet_usd AS VARCHAR),
    'total_payout_usd', CAST(total_payout_usd AS VARCHAR),
    'total_rounds', CAST(total_rounds AS VARCHAR),
    'total_users', CAST(total_users AS VARCHAR),
    'rtp', CAST(CASE WHEN total_bet_usd > 0 THEN (total_payout_usd / total_bet_usd * 100) ELSE 0 END AS VARCHAR),
    'avg_bet_per_user', CAST(CASE WHEN total_users > 0 THEN total_bet_usd / total_users ELSE 0 END AS VARCHAR)
  ) AS additional_data
FROM current_period_games

UNION ALL

SELECT 
  'currencies' AS data_type,
  'currency' AS category,
  currency_code AS name,
  total_ggr_usd AS current_value,
  NULL AS previous_value,
  NULL AS change_amount,
  NULL AS change_rate,
  MAP(
    'total_bet_usd', CAST(total_bet_usd AS VARCHAR),
    'total_payout_usd', CAST(total_payout_usd AS VARCHAR),
    'total_rounds', CAST(total_rounds AS VARCHAR)
  ) AS additional_data
FROM current_period_currencies

UNION ALL

SELECT 
  'retention' AS data_type,
  retention_type AS category,
  merchant_name || '|' || game_name AS name,
  CAST(daily_users AS DOUBLE) AS current_value,
  CAST(d1_retention AS DOUBLE) AS previous_value,  -- 使用previous_value存储d1_retention
  CAST(d7_retention AS DOUBLE) AS change_amount,  -- 使用change_amount存储d7_retention
  NULL AS change_rate,
  MAP('date', CAST(date_col AS VARCHAR)) AS additional_data
FROM current_period_retention

ORDER BY data_type, category, name;

-- 注意：
-- 1. 表名和字段名需要根据实际数据库结构调整
-- 2. 需要根据实际表结构添加JOIN条件
-- 3. 新游戏识别逻辑需要根据实际release_date字段调整
-- 4. 留存数据类型需要根据实际表结构调整

