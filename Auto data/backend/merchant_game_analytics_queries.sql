-- 商户游戏分析视图查询示例
-- 用于n8n工作流的各种查询场景

-- ==============================================
-- 1. 商户维度每日统计查询
-- ==============================================
-- 查询指定时间范围内所有非10001商户的每日唯一投注用户数
SELECT 
    date_str,
    merchant,
    unique_users AS daily_unique_users
FROM merchant_game_analytics
WHERE stat_type = 'merchant_daily'
    AND date_str >= '20250901'  -- 开始日期
    AND date_str <= '20250930'  -- 结束日期
ORDER BY date_str, merchant;

-- ==============================================
-- 2. 商户维度月度合计统计查询
-- ==============================================
-- 查询指定月份所有非10001商户的月度合计唯一投注用户数
SELECT 
    month_str,
    merchant,
    unique_users AS monthly_unique_users
FROM merchant_game_analytics
WHERE stat_type = 'merchant_monthly'
    AND month_str >= '202509'  -- 开始月份
    AND month_str <= '202510'  -- 结束月份
ORDER BY month_str, merchant;

-- ==============================================
-- 3. 游戏维度每日统计查询
-- ==============================================
-- 查询指定时间范围内所有非10001商户的游戏每日唯一投注用户数
SELECT 
    date_str,
    merchant,
    game_id,
    unique_users AS daily_unique_users
FROM merchant_game_analytics
WHERE stat_type = 'game_daily'
    AND date_str >= '20250901'  -- 开始日期
    AND date_str <= '20250930'  -- 结束日期
ORDER BY date_str, merchant, game_id;

-- ==============================================
-- 4. 游戏维度月度合计统计查询
-- ==============================================
-- 查询指定月份所有非10001商户的游戏月度合计唯一投注用户数
SELECT 
    month_str,
    merchant,
    game_id,
    unique_users AS monthly_unique_users
FROM merchant_game_analytics
WHERE stat_type = 'game_monthly'
    AND month_str >= '202509'  -- 开始月份
    AND month_str <= '202510'  -- 结束月份
ORDER BY month_str, merchant, game_id;

-- ==============================================
-- 5. 综合查询：商户维度每日+月度合计
-- ==============================================
-- 查询指定商户的每日和月度合计统计
SELECT 
    stat_type,
    date_str,
    month_str,
    merchant,
    unique_users
FROM merchant_game_analytics
WHERE merchant = '10002'  -- 指定商户ID
    AND (
        (stat_type = 'merchant_daily' AND date_str >= '20250901' AND date_str <= '20250930')
        OR 
        (stat_type = 'merchant_monthly' AND month_str >= '202509' AND month_str <= '202510')
    )
ORDER BY stat_type, date_str, month_str;

-- ==============================================
-- 6. 综合查询：游戏维度每日+月度合计
-- ==============================================
-- 查询指定商户和游戏的每日和月度合计统计
SELECT 
    stat_type,
    date_str,
    month_str,
    merchant,
    game_id,
    unique_users
FROM merchant_game_analytics
WHERE merchant = '10002'  -- 指定商户ID
    AND game_id = 'game001'  -- 指定游戏ID
    AND (
        (stat_type = 'game_daily' AND date_str >= '20250901' AND date_str <= '20250930')
        OR 
        (stat_type = 'game_monthly' AND month_str >= '202509' AND month_str <= '202510')
    )
ORDER BY stat_type, date_str, month_str;

-- ==============================================
-- 7. 汇总查询：所有非10001商户的总体统计
-- ==============================================
-- 查询指定时间范围内所有非10001商户的汇总统计
SELECT 
    'total_daily' AS summary_type,
    date_str,
    SUM(unique_users) AS total_unique_users
FROM merchant_game_analytics
WHERE stat_type = 'merchant_daily'
    AND date_str >= '20250901'
    AND date_str <= '20250930'
GROUP BY date_str

UNION ALL

SELECT 
    'total_monthly' AS summary_type,
    month_str AS date_str,
    SUM(unique_users) AS total_unique_users
FROM merchant_game_analytics
WHERE stat_type = 'merchant_monthly'
    AND month_str >= '202509'
    AND month_str <= '202510'
GROUP BY month_str

ORDER BY summary_type, date_str;

-- ==============================================
-- 8. 动态查询模板（用于n8n工作流）
-- ==============================================
-- 这个查询可以根据n8n传入的参数动态调整
-- 参数说明：
-- :start_date - 开始日期 (格式: YYYYMMDD)
-- :end_date - 结束日期 (格式: YYYYMMDD)
-- :start_month - 开始月份 (格式: YYYYMM)
-- :end_month - 结束月份 (格式: YYYYMM)
-- :merchant_id - 商户ID (可选，不指定则查询所有非10001商户)
-- :game_id - 游戏ID (可选，不指定则查询所有游戏)

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
         AND date_str >= :start_date 
         AND date_str <= :end_date)
        OR 
        (stat_type IN ('merchant_monthly', 'game_monthly') 
         AND month_str >= :start_month 
         AND month_str <= :end_month)
    )
    AND (:merchant_id IS NULL OR merchant = :merchant_id)
    AND (:game_id IS NULL OR game_id = :game_id)
ORDER BY 
    stat_type,
    month_str,
    date_str,
    merchant,
    game_id;
