-- Athena SQL查询：业务数据报告统计查询（基于实际表结构）
-- 数据库：gmp
-- 主表：game_records
-- 支持周度和月度统计
-- 
-- 参数说明：
--   :start_date - 开始日期（格式：YYYY-MM-DD）
--   :end_date - 结束日期（格式：YYYY-MM-DD）
--   :previous_start_date - 上期开始日期（格式：YYYY-MM-DD）
--   :previous_end_date - 上期结束日期（格式：YYYY-MM-DD）
--   :new_game_release_month - 新游戏上线月份（格式：YYYY-MM，用于识别新游戏）

-- ============================================
-- 辅助CTE：日期转换和计算
-- ============================================
WITH date_conversion AS (
  SELECT 
    :start_date AS start_date_str,
    :end_date AS end_date_str,
    :previous_start_date AS prev_start_date_str,
    :previous_end_date AS prev_end_date_str,
    CAST(:start_date AS DATE) AS start_date,
    CAST(:end_date AS DATE) AS end_date,
    CAST(:previous_start_date AS DATE) AS prev_start_date,
    CAST(:previous_end_date AS DATE) AS prev_end_date,
    -- 转换为时间戳（毫秒）
    -- Athena使用FROM_UNIXTIME和TO_UNIXTIME进行转换
    CAST(TO_UNIXTIME(CAST(:start_date AS TIMESTAMP)) * 1000 AS BIGINT) AS start_timestamp,
    CAST((TO_UNIXTIME(CAST(:end_date AS TIMESTAMP)) + INTERVAL '1' DAY) * 1000 - 1 AS BIGINT) AS end_timestamp,  -- 包含当天的23:59:59.999
    CAST(TO_UNIXTIME(CAST(:previous_start_date AS TIMESTAMP)) * 1000 AS BIGINT) AS prev_start_timestamp,
    CAST((TO_UNIXTIME(CAST(:previous_end_date AS TIMESTAMP)) + INTERVAL '1' DAY) * 1000 - 1 AS BIGINT) AS prev_end_timestamp
),

-- ============================================
-- 1. 当前期总体数据统计
-- ============================================
current_period_overall AS (
  SELECT 
    SUM(amount) AS total_bet_usd,
    SUM(pay_out) AS total_payout_usd,
    SUM(amount - pay_out) AS total_ggr_usd,  -- GGR = 投注金额 - 支付金额
    COUNT(*) AS total_rounds,
    COUNT(DISTINCT uid) AS total_active_users
  FROM gmp.game_records
  CROSS JOIN date_conversion
  WHERE created_at >= date_conversion.start_timestamp
    AND created_at <= date_conversion.end_timestamp
    AND amount IS NOT NULL
    AND pay_out IS NOT NULL
),

-- ============================================
-- 2. 当前期商户维度数据（按商户聚合）
-- ============================================
current_period_merchants AS (
  SELECT 
    merchant AS merchant_name,
    SUM(amount) AS total_bet_usd,
    SUM(pay_out) AS total_payout_usd,
    SUM(amount - pay_out) AS total_ggr_usd,
    COUNT(*) AS total_rounds,
    COUNT(DISTINCT uid) AS total_users,
    -- 人均投注 = 总投注 / 用户数
    CASE 
      WHEN COUNT(DISTINCT uid) > 0 THEN SUM(amount) / COUNT(DISTINCT uid)
      ELSE 0
    END AS avg_bet_per_user
  FROM gmp.game_records
  CROSS JOIN date_conversion
  WHERE created_at >= date_conversion.start_timestamp
    AND created_at <= date_conversion.end_timestamp
    AND merchant IS NOT NULL
    AND merchant != ''
    AND amount IS NOT NULL
    AND pay_out IS NOT NULL
    -- 过滤币种代码（3个大写字母）
    AND LENGTH(merchant) > 3
    AND merchant NOT IN ('BRL', 'CLP', 'MXN', 'USD', 'EUR', 'INR', 'PHP', 'THB', 'AUD', 'MYR', 'ARS', 'BDT', 'PEN', 'COP', 'USDT')
  GROUP BY merchant
),

-- ============================================
-- 3. 当前期游戏维度数据（按游戏聚合）
-- ============================================
current_period_games AS (
  SELECT 
    game_code AS game_name,
    SUM(amount) AS total_bet_usd,
    SUM(pay_out) AS total_payout_usd,
    SUM(amount - pay_out) AS total_ggr_usd,
    COUNT(*) AS total_rounds,
    COUNT(DISTINCT uid) AS total_users,
    -- RTP = 支付金额 / 投注金额 * 100%
    CASE 
      WHEN SUM(amount) > 0 THEN (SUM(pay_out) / SUM(amount)) * 100
      ELSE 0
    END AS rtp,
    -- 人均投注 = 总投注 / 用户数
    CASE 
      WHEN COUNT(DISTINCT uid) > 0 THEN SUM(amount) / COUNT(DISTINCT uid)
      ELSE 0
    END AS avg_bet_per_user
  FROM gmp.game_records
  CROSS JOIN date_conversion
  WHERE created_at >= date_conversion.start_timestamp
    AND created_at <= date_conversion.end_timestamp
    AND game_code IS NOT NULL
    AND game_code != ''
    AND amount IS NOT NULL
    AND pay_out IS NOT NULL
  GROUP BY game_code
),

-- ============================================
-- 4. 当前期币种维度数据（按币种聚合）
-- 注意：如果amount和pay_out不是USD，需要根据currency进行汇率转换
-- 这里假设所有金额已经是USD，或需要额外的汇率转换逻辑
-- ============================================
current_period_currencies AS (
  SELECT 
    currency AS currency_code,
    SUM(amount) AS total_bet_usd,
    SUM(pay_out) AS total_payout_usd,
    SUM(amount - pay_out) AS total_ggr_usd,
    COUNT(*) AS total_rounds
  FROM gmp.game_records
  CROSS JOIN date_conversion
  WHERE created_at >= date_conversion.start_timestamp
    AND created_at <= date_conversion.end_timestamp
    AND currency IS NOT NULL
    AND currency != ''
    AND amount IS NOT NULL
    AND pay_out IS NOT NULL
  GROUP BY currency
),

-- ============================================
-- 5. 当前期新游戏数据（需要游戏信息表或配置）
-- 注意：新游戏列表需要从外部配置或通过其他方式识别
-- 这里提供一个基础查询框架，新游戏列表需要在WHERE子句中添加
-- ============================================
-- 方案1：如果有game_info表（包含release_date字段）
-- current_period_new_games_detail AS (
--   SELECT 
--     gr.game_code AS game_name,
--     gr.merchant AS merchant_name,
--     gr.currency AS currency_code,
--     SUM(gr.amount) AS total_bet_usd,
--     SUM(gr.pay_out) AS total_payout_usd,
--     SUM(gr.amount - gr.pay_out) AS total_ggr_usd,
--     COUNT(*) AS total_rounds,
--     COUNT(DISTINCT gr.uid) AS total_users
--   FROM gmp.game_records gr
--   INNER JOIN gmp.game_info gi ON gr.game_code = gi.game_code
--   CROSS JOIN date_conversion
--   WHERE gr.created_at >= date_conversion.start_timestamp
--     AND gr.created_at <= date_conversion.end_timestamp
--     AND gi.release_date >= DATE_PARSE(:new_game_release_month || '-01', '%Y-%m-%d')
--     AND gi.release_date < DATE_ADD('month', 1, DATE_PARSE(:new_game_release_month || '-01', '%Y-%m-%d'))
--     AND (gr.amount - gr.pay_out) > 0  -- 只统计正GGR
--     AND gr.amount IS NOT NULL
--     AND gr.pay_out IS NOT NULL
--   GROUP BY gr.game_code, gr.merchant, gr.currency
-- ),

-- 方案2：如果没有game_info表，需要从外部传入新游戏列表
-- 这里提供一个基础查询，新游戏列表需要在WHERE子句中添加
-- 例如：AND gr.game_code IN ('gp_crash', 'gp_mines', ...)
current_period_new_games_detail AS (
  SELECT 
    gr.game_code AS game_name,
    gr.merchant AS merchant_name,
    gr.currency AS currency_code,
    SUM(gr.amount) AS total_bet_usd,
    SUM(gr.pay_out) AS total_payout_usd,
    SUM(gr.amount - gr.pay_out) AS total_ggr_usd,
    COUNT(*) AS total_rounds,
    COUNT(DISTINCT gr.uid) AS total_users
  FROM gmp.game_records gr
  CROSS JOIN date_conversion
  WHERE gr.created_at >= date_conversion.start_timestamp
    AND gr.created_at <= date_conversion.end_timestamp
    -- 新游戏列表需要从外部配置，这里先查询所有游戏
    -- 实际使用时，需要添加：AND gr.game_code IN (新游戏列表)
    -- 例如：AND gr.game_code IN ('gp_crash', 'gp_mines')
    AND (gr.amount - gr.pay_out) > 0  -- 只统计正GGR
    AND gr.amount IS NOT NULL
    AND gr.pay_out IS NOT NULL
    AND gr.game_code IS NOT NULL
    AND gr.game_code != ''
  GROUP BY gr.game_code, gr.merchant, gr.currency
),

-- ============================================
-- 6. 上期数据（用于环比计算）
-- ============================================
previous_period_overall AS (
  SELECT 
    SUM(amount) AS total_bet_usd,
    SUM(pay_out) AS total_payout_usd,
    SUM(amount - pay_out) AS total_ggr_usd,
    COUNT(*) AS total_rounds,
    COUNT(DISTINCT uid) AS total_active_users
  FROM gmp.game_records
  CROSS JOIN date_conversion
  WHERE created_at >= date_conversion.prev_start_timestamp
    AND created_at <= date_conversion.prev_end_timestamp
    AND amount IS NOT NULL
    AND pay_out IS NOT NULL
),

previous_period_merchants AS (
  SELECT 
    merchant AS merchant_name,
    SUM(amount) AS total_bet_usd,
    SUM(pay_out) AS total_payout_usd,
    SUM(amount - pay_out) AS total_ggr_usd,
    COUNT(*) AS total_rounds,
    COUNT(DISTINCT uid) AS total_users,
    CASE 
      WHEN COUNT(DISTINCT uid) > 0 THEN SUM(amount) / COUNT(DISTINCT uid)
      ELSE 0
    END AS avg_bet_per_user
  FROM gmp.game_records
  CROSS JOIN date_conversion
  WHERE created_at >= date_conversion.prev_start_timestamp
    AND created_at <= date_conversion.prev_end_timestamp
    AND merchant IS NOT NULL
    AND merchant != ''
    AND amount IS NOT NULL
    AND pay_out IS NOT NULL
    AND LENGTH(merchant) > 3
    AND merchant NOT IN ('BRL', 'CLP', 'MXN', 'USD', 'EUR', 'INR', 'PHP', 'THB', 'AUD', 'MYR', 'ARS', 'BDT', 'PEN', 'COP', 'USDT')
  GROUP BY merchant
),

previous_period_games AS (
  SELECT 
    game_code AS game_name,
    SUM(amount) AS total_bet_usd,
    SUM(pay_out) AS total_payout_usd,
    SUM(amount - pay_out) AS total_ggr_usd,
    COUNT(*) AS total_rounds,
    COUNT(DISTINCT uid) AS total_users,
    CASE 
      WHEN SUM(amount) > 0 THEN (SUM(pay_out) / SUM(amount)) * 100
      ELSE 0
    END AS rtp,
    CASE 
      WHEN COUNT(DISTINCT uid) > 0 THEN SUM(amount) / COUNT(DISTINCT uid)
      ELSE 0
    END AS avg_bet_per_user
  FROM gmp.game_records
  CROSS JOIN date_conversion
  WHERE created_at >= date_conversion.prev_start_timestamp
    AND created_at <= date_conversion.prev_end_timestamp
    AND game_code IS NOT NULL
    AND game_code != ''
    AND amount IS NOT NULL
    AND pay_out IS NOT NULL
  GROUP BY game_code
),

previous_period_currencies AS (
  SELECT 
    currency AS currency_code,
    SUM(amount - pay_out) AS total_ggr_usd
  FROM gmp.game_records
  CROSS JOIN date_conversion
  WHERE created_at >= date_conversion.prev_start_timestamp
    AND created_at <= date_conversion.prev_end_timestamp
    AND currency IS NOT NULL
    AND currency != ''
    AND amount IS NOT NULL
    AND pay_out IS NOT NULL
  GROUP BY currency
),

-- ============================================
-- 7. 留存数据（需要从game_records计算或从留存表获取）
-- 注意：留存数据通常需要额外的表或复杂的计算
-- 这里提供一个基础查询框架
-- ============================================
-- 方案1：如果有专门的留存表（推荐）
-- current_period_retention AS (
--   SELECT 
--     merchant_name,
--     game_name,
--     date_col,
--     daily_users,
--     d1_retention,
--     d7_retention,
--     retention_type
--   FROM gmp.user_retention
--   CROSS JOIN date_conversion
--   WHERE date_col >= date_conversion.start_date
--     AND date_col <= date_conversion.end_date
--     AND daily_users >= 50
-- ),

-- 方案2：从game_records计算留存（复杂，需要额外的处理）
-- 留存数据建议使用专门的留存表或预处理数据
-- 如果必须从game_records计算，需要：
-- 1. 识别新用户（首次出现日期）
-- 2. 计算次日留存（D+1是否再次出现）
-- 3. 计算7日留存（D+7是否再次出现）
-- 这需要复杂的窗口函数和自连接，建议使用预处理数据

-- ============================================
-- 最终输出：组合所有数据
-- ============================================
SELECT 
  'current_period_overall' AS data_type,
  CAST(NULL AS VARCHAR) AS category,
  CAST(NULL AS VARCHAR) AS name,
  current_period_overall.total_ggr_usd AS current_value,
  NULL AS previous_value,
  NULL AS change_amount,
  NULL AS change_rate,
  MAP(
    'total_bet_usd', CAST(current_period_overall.total_bet_usd AS VARCHAR),
    'total_payout_usd', CAST(current_period_overall.total_payout_usd AS VARCHAR),
    'total_rounds', CAST(current_period_overall.total_rounds AS VARCHAR),
    'total_active_users', CAST(current_period_overall.total_active_users AS VARCHAR)
  ) AS additional_data
FROM current_period_overall, date_conversion

UNION ALL

-- 商户数据
SELECT 
  'merchants' AS data_type,
  'merchant' AS category,
  current_period_merchants.merchant_name AS name,
  current_period_merchants.total_ggr_usd AS current_value,
  COALESCE(previous_period_merchants.total_ggr_usd, 0) AS previous_value,
  current_period_merchants.total_ggr_usd - COALESCE(previous_period_merchants.total_ggr_usd, 0) AS change_amount,
  CASE 
    WHEN COALESCE(previous_period_merchants.total_ggr_usd, 0) > 0 
    THEN ((current_period_merchants.total_ggr_usd - previous_period_merchants.total_ggr_usd) / previous_period_merchants.total_ggr_usd) * 100
    ELSE NULL
  END AS change_rate,
  MAP(
    'total_bet_usd', CAST(current_period_merchants.total_bet_usd AS VARCHAR),
    'total_payout_usd', CAST(current_period_merchants.total_payout_usd AS VARCHAR),
    'total_rounds', CAST(current_period_merchants.total_rounds AS VARCHAR),
    'total_users', CAST(current_period_merchants.total_users AS VARCHAR),
    'avg_bet_per_user', CAST(current_period_merchants.avg_bet_per_user AS VARCHAR),
    'previous_total_bet_usd', CAST(COALESCE(previous_period_merchants.total_bet_usd, 0) AS VARCHAR),
    'previous_total_users', CAST(COALESCE(previous_period_merchants.total_users, 0) AS VARCHAR),
    'previous_avg_bet_per_user', CAST(COALESCE(previous_period_merchants.avg_bet_per_user, 0) AS VARCHAR)
  ) AS additional_data
FROM current_period_merchants
LEFT JOIN previous_period_merchants 
  ON current_period_merchants.merchant_name = previous_period_merchants.merchant_name
CROSS JOIN date_conversion

UNION ALL

-- 游戏数据
SELECT 
  'games' AS data_type,
  'game' AS category,
  current_period_games.game_name AS name,
  current_period_games.total_ggr_usd AS current_value,
  COALESCE(previous_period_games.total_ggr_usd, 0) AS previous_value,
  current_period_games.total_ggr_usd - COALESCE(previous_period_games.total_ggr_usd, 0) AS change_amount,
  CASE 
    WHEN COALESCE(previous_period_games.total_ggr_usd, 0) > 0 
    THEN ((current_period_games.total_ggr_usd - previous_period_games.total_ggr_usd) / previous_period_games.total_ggr_usd) * 100
    ELSE NULL
  END AS change_rate,
  MAP(
    'total_bet_usd', CAST(current_period_games.total_bet_usd AS VARCHAR),
    'total_payout_usd', CAST(current_period_games.total_payout_usd AS VARCHAR),
    'total_rounds', CAST(current_period_games.total_rounds AS VARCHAR),
    'total_users', CAST(current_period_games.total_users AS VARCHAR),
    'rtp', CAST(current_period_games.rtp AS VARCHAR),
    'avg_bet_per_user', CAST(current_period_games.avg_bet_per_user AS VARCHAR),
    'previous_total_bet_usd', CAST(COALESCE(previous_period_games.total_bet_usd, 0) AS VARCHAR),
    'previous_total_payout_usd', CAST(COALESCE(previous_period_games.total_payout_usd, 0) AS VARCHAR),
    'previous_total_rounds', CAST(COALESCE(previous_period_games.total_rounds, 0) AS VARCHAR),
    'previous_total_users', CAST(COALESCE(previous_period_games.total_users, 0) AS VARCHAR),
    'previous_rtp', CAST(COALESCE(previous_period_games.rtp, 0) AS VARCHAR),
    'previous_avg_bet_per_user', CAST(COALESCE(previous_period_games.avg_bet_per_user, 0) AS VARCHAR)
  ) AS additional_data
FROM current_period_games
LEFT JOIN previous_period_games 
  ON current_period_games.game_name = previous_period_games.game_name
CROSS JOIN date_conversion

UNION ALL

-- 币种数据
SELECT 
  'currencies' AS data_type,
  'currency' AS category,
  current_period_currencies.currency_code AS name,
  current_period_currencies.total_ggr_usd AS current_value,
  COALESCE(previous_period_currencies.total_ggr_usd, 0) AS previous_value,
  current_period_currencies.total_ggr_usd - COALESCE(previous_period_currencies.total_ggr_usd, 0) AS change_amount,
  CASE 
    WHEN COALESCE(previous_period_currencies.total_ggr_usd, 0) > 0 
    THEN ((current_period_currencies.total_ggr_usd - previous_period_currencies.total_ggr_usd) / previous_period_currencies.total_ggr_usd) * 100
    ELSE NULL
  END AS change_rate,
  MAP(
    'total_bet_usd', CAST(current_period_currencies.total_bet_usd AS VARCHAR),
    'total_payout_usd', CAST(current_period_currencies.total_payout_usd AS VARCHAR),
    'total_rounds', CAST(current_period_currencies.total_rounds AS VARCHAR)
  ) AS additional_data
FROM current_period_currencies
LEFT JOIN previous_period_currencies 
  ON current_period_currencies.currency_code = previous_period_currencies.currency_code
CROSS JOIN date_conversion

ORDER BY data_type, category, name;

-- ============================================
-- 使用说明：
-- ============================================
-- 1. 替换参数（在Athena中使用Prepared Statement或直接替换）：
--    :start_date = '2025-10-27'
--    :end_date = '2025-11-02'
--    :previous_start_date = '2025-10-20'
--    :previous_end_date = '2025-10-26'
--    :new_game_release_month = '2025-10'
--
-- 2. 时间戳转换：
--    - created_at是毫秒时间戳（bigint）
--    - 使用TO_UNIXTIME将日期转换为时间戳进行比较
--    - 注意：Athena的TO_UNIXTIME返回秒级时间戳，需要乘以1000转换为毫秒
--
-- 3. GGR计算：
--    - GGR = amount - pay_out（投注金额 - 支付金额）
--    - 如果GGR为负，表示该记录亏损
--
-- 4. RTP计算：
--    - RTP = (pay_out / amount) * 100%
--    - RTP > 100% 表示亏损，RTP < 100% 表示盈利
--
-- 5. 新游戏识别：
--    - 如果有game_info表，取消注释"方案1"的代码并调整JOIN条件
--    - 如果没有，需要在WHERE子句中添加：AND gr.game_code IN (新游戏列表)
--    - 新游戏列表可以从外部配置或通过其他方式获取
--
-- 6. 留存数据：
--    - 如果有专门的留存表，取消注释"方案1"的代码
--    - 如果没有，建议使用预处理数据（从game_records计算留存需要复杂的逻辑）
--
-- 7. 币种转换：
--    - 如果amount和pay_out不是USD，需要根据currency进行汇率转换
--    - 这里假设所有金额已经是USD，或需要额外的汇率转换逻辑
--    - 如果需要转换，需要JOIN汇率表或使用汇率转换函数
--
-- 8. 商户过滤：
--    - 已过滤币种代码（3个大写字母）
--    - 如果还有其他需要过滤的商户，添加到NOT IN列表中
--
-- 9. 数据质量：
--    - 已添加NULL值检查（amount IS NOT NULL AND pay_out IS NOT NULL）
--    - 已添加空字符串检查（merchant != '', game_code != '', currency != ''）
--
-- 10. 性能优化建议：
--     - 在created_at字段上创建分区（如果可能）
--     - 在merchant、game_code、currency字段上创建索引（如果可能）
--     - 考虑使用物化视图预聚合数据

