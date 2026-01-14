-- 商户游戏分析视图
-- 用于统计非10001商户的每日和合计唯一投注用户数（商户维度和游戏维度）
CREATE OR REPLACE VIEW merchant_game_analytics AS
WITH daily_merchant_stats AS (
    -- 商户维度每日统计
    SELECT 
        SUBSTR(hour, 1, 8) AS date_str,  -- 日期字符串 (YYYYMMDD)
        SUBSTR(hour, 1, 6) AS month_str, -- 月份字符串 (YYYYMM)
        merchant,
        COUNT(DISTINCT uid) AS daily_unique_users
    FROM game_records
    WHERE provider IN ('gp', 'popular')
        AND merchant != '10001'  -- 排除商户10001
        AND hour >= '2025010100'  -- 可根据需要调整起始时间
        AND hour <= '2025123123'  -- 可根据需要调整结束时间
    GROUP BY 
        SUBSTR(hour, 1, 8),
        SUBSTR(hour, 1, 6),
        merchant
),
daily_game_stats AS (
    -- 游戏维度每日统计
    SELECT 
        SUBSTR(hour, 1, 8) AS date_str,  -- 日期字符串 (YYYYMMDD)
        SUBSTR(hour, 1, 6) AS month_str, -- 月份字符串 (YYYYMM)
        merchant,
        game_id,
        COUNT(DISTINCT uid) AS daily_unique_users
    FROM game_records
    WHERE provider IN ('gp', 'popular')
        AND merchant != '10001'  -- 排除商户10001
        AND hour >= '2025010100'  -- 可根据需要调整起始时间
        AND hour <= '2025123123'  -- 可根据需要调整结束时间
    GROUP BY 
        SUBSTR(hour, 1, 8),
        SUBSTR(hour, 1, 6),
        merchant,
        game_id
),
monthly_merchant_stats AS (
    -- 商户维度月度合计统计
    SELECT 
        month_str,
        merchant,
        SUM(daily_unique_users) AS monthly_unique_users
    FROM daily_merchant_stats
    GROUP BY month_str, merchant
),
monthly_game_stats AS (
    -- 游戏维度月度合计统计
    SELECT 
        month_str,
        merchant,
        game_id,
        SUM(daily_unique_users) AS monthly_unique_users
    FROM daily_game_stats
    GROUP BY month_str, merchant, game_id
)
-- 合并所有统计结果
SELECT 
    'merchant_daily' AS stat_type,
    date_str,
    month_str,
    merchant,
    NULL AS game_id,
    daily_unique_users AS unique_users,
    NULL AS monthly_unique_users
FROM daily_merchant_stats

UNION ALL

SELECT 
    'merchant_monthly' AS stat_type,
    NULL AS date_str,
    month_str,
    merchant,
    NULL AS game_id,
    NULL AS daily_unique_users,
    monthly_unique_users AS unique_users
FROM monthly_merchant_stats

UNION ALL

SELECT 
    'game_daily' AS stat_type,
    date_str,
    month_str,
    merchant,
    game_id,
    daily_unique_users AS unique_users,
    NULL AS monthly_unique_users
FROM daily_game_stats

UNION ALL

SELECT 
    'game_monthly' AS stat_type,
    NULL AS date_str,
    month_str,
    merchant,
    game_id,
    NULL AS daily_unique_users,
    monthly_unique_users AS unique_users
FROM monthly_game_stats

ORDER BY 
    stat_type,
    month_str,
    date_str,
    merchant,
    game_id;
