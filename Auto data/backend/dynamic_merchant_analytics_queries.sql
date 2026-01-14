-- 基于时间计算器输出的动态查询SQL
-- 根据上游输出的时间范围生成相应的查询

-- ==============================================
-- 1. 商户维度上周每日统计查询
-- ==============================================
-- 查询上周所有非10001商户的每日唯一投注用户数
SELECT 
    date_str,
    merchant,
    unique_users AS daily_unique_users
FROM merchant_game_analytics
WHERE stat_type = 'merchant_daily'
    AND date_str >= '20251013'  -- lastWeekStart
    AND date_str <= '20251019'  -- lastWeekEnd
ORDER BY date_str, merchant;

-- ==============================================
-- 2. 商户维度本周每日统计查询
-- ==============================================
-- 查询本周所有非10001商户的每日唯一投注用户数
SELECT 
    date_str,
    merchant,
    unique_users AS daily_unique_users
FROM merchant_game_analytics
WHERE stat_type = 'merchant_daily'
    AND date_str >= '20251020'  -- thisWeekStart
    AND date_str <= '20251026'  -- thisWeekEnd
ORDER BY date_str, merchant;

-- ==============================================
-- 3. 商户维度上周月度统计查询
-- ==============================================
-- 查询上周所在月份的月度合计唯一投注用户数
SELECT 
    month_str,
    merchant,
    unique_users AS monthly_unique_users
FROM merchant_game_analytics
WHERE stat_type = 'merchant_monthly'
    AND month_str = '202510'  -- lastWeekMonth
ORDER BY merchant;

-- ==============================================
-- 4. 游戏维度上周每日统计查询
-- ==============================================
-- 查询上周所有非10001商户的游戏每日唯一投注用户数
SELECT 
    date_str,
    merchant,
    game_id,
    unique_users AS daily_unique_users
FROM merchant_game_analytics
WHERE stat_type = 'game_daily'
    AND date_str >= '20251013'  -- lastWeekStart
    AND date_str <= '20251019'  -- lastWeekEnd
ORDER BY date_str, merchant, game_id;

-- ==============================================
-- 5. 游戏维度本周每日统计查询
-- ==============================================
-- 查询本周所有非10001商户的游戏每日唯一投注用户数
SELECT 
    date_str,
    merchant,
    game_id,
    unique_users AS daily_unique_users
FROM merchant_game_analytics
WHERE stat_type = 'game_daily'
    AND date_str >= '20251020'  -- thisWeekStart
    AND date_str <= '20251026'  -- thisWeekEnd
ORDER BY date_str, merchant, game_id;

-- ==============================================
-- 6. 游戏维度上周月度统计查询
-- ==============================================
-- 查询上周所在月份的游戏月度合计唯一投注用户数
SELECT 
    month_str,
    merchant,
    game_id,
    unique_users AS monthly_unique_users
FROM merchant_game_analytics
WHERE stat_type = 'game_monthly'
    AND month_str = '202510'  -- lastWeekMonth
ORDER BY merchant, game_id;

-- ==============================================
-- 7. 综合查询：上周和本周对比
-- ==============================================
-- 查询上周和本周的商户维度每日统计对比
SELECT 
    CASE 
        WHEN date_str >= '20251013' AND date_str <= '20251019' THEN 'last_week'
        WHEN date_str >= '20251020' AND date_str <= '20251026' THEN 'this_week'
    END AS week_type,
    date_str,
    merchant,
    unique_users AS daily_unique_users
FROM merchant_game_analytics
WHERE stat_type = 'merchant_daily'
    AND (
        (date_str >= '20251013' AND date_str <= '20251019')  -- lastWeekRange
        OR 
        (date_str >= '20251020' AND date_str <= '20251026')  -- thisWeekRange
    )
ORDER BY week_type, date_str, merchant;

-- ==============================================
-- 8. 汇总查询：上周和本周总体统计
-- ==============================================
-- 查询上周和本周的汇总统计
SELECT 
    'last_week' AS period_type,
    '20251013-20251019' AS period_range,
    SUM(unique_users) AS total_unique_users,
    COUNT(DISTINCT merchant) AS merchant_count
FROM merchant_game_analytics
WHERE stat_type = 'merchant_daily'
    AND date_str >= '20251013'
    AND date_str <= '20251019'

UNION ALL

SELECT 
    'this_week' AS period_type,
    '20251020-20251026' AS period_range,
    SUM(unique_users) AS total_unique_users,
    COUNT(DISTINCT merchant) AS merchant_count
FROM merchant_game_analytics
WHERE stat_type = 'merchant_daily'
    AND date_str >= '20251020'
    AND date_str <= '20251026'

ORDER BY period_type;

-- ==============================================
-- 9. 动态查询模板（用于n8n工作流）
-- ==============================================
-- 这个查询可以根据n8n传入的参数动态调整
-- 参数说明：
-- :lastWeekStart - 上周开始日期 (20251013)
-- :lastWeekEnd - 上周结束日期 (20251019)
-- :thisWeekStart - 本周开始日期 (20251020)
-- :thisWeekEnd - 本周结束日期 (20251026)
-- :lastWeekMonth - 上周月份 (202510)
-- :statType - 统计类型 (merchant_daily, merchant_monthly, game_daily, game_monthly)
-- :merchantId - 商户ID (可选)

SELECT 
    stat_type,
    date_str,
    month_str,
    merchant,
    game_id,
    unique_users
FROM merchant_game_analytics
WHERE 1=1
    AND (
        (stat_type IN ('merchant_daily', 'game_daily') 
         AND (
             (date_str >= :lastWeekStart AND date_str <= :lastWeekEnd)
             OR 
             (date_str >= :thisWeekStart AND date_str <= :thisWeekEnd)
         ))
        OR 
        (stat_type IN ('merchant_monthly', 'game_monthly') 
         AND month_str = :lastWeekMonth)
    )
    AND (:merchantId IS NULL OR merchant = :merchantId)
ORDER BY 
    stat_type,
    date_str,
    month_str,
    merchant,
    game_id;

-- ==============================================
-- 10. 特定商户查询模板
-- ==============================================
-- 查询指定商户的上周和本周统计
-- 参数说明：
-- :merchantId - 商户ID (例如: '10002')

SELECT 
    stat_type,
    date_str,
    month_str,
    merchant,
    game_id,
    unique_users,
    CASE 
        WHEN date_str >= '20251013' AND date_str <= '20251019' THEN 'last_week'
        WHEN date_str >= '20251020' AND date_str <= '20251026' THEN 'this_week'
        WHEN month_str = '202510' THEN 'monthly'
    END AS period_type
FROM merchant_game_analytics
WHERE merchant = :merchantId
    AND (
        (stat_type IN ('merchant_daily', 'game_daily') 
         AND (
             (date_str >= '20251013' AND date_str <= '20251019')
             OR 
             (date_str >= '20251020' AND date_str <= '20251026')
         ))
        OR 
        (stat_type IN ('merchant_monthly', 'game_monthly') 
         AND month_str = '202510')
    )
ORDER BY 
    stat_type,
    period_type,
    date_str,
    month_str,
    game_id;
