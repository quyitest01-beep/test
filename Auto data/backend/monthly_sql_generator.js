// 月度SQL生成器
// 根据月度时间计算器的输出生成相应的查询SQL
// 用于n8n工作流

const inputData = $input.all();

console.log('=== 月度SQL生成器 ===');
console.log('输入数据:', inputData);

// 获取月度时间计算器的输出
const timeData = inputData[0].json;
const {
  lastMonthRange,
  lastMonthStart,
  lastMonthEnd,
  lastMonthStr,
  today,
  currentYear,
  currentMonth,
  lastMonthYear,
  lastMonth
} = timeData;

console.log('月度时间数据解析:');
console.log('上月范围:', lastMonthRange);
console.log('上月开始:', lastMonthStart);
console.log('上月结束:', lastMonthEnd);
console.log('上月月份字符串:', lastMonthStr);
console.log('今日:', today);
console.log('当前年月:', currentYear, currentMonth);
console.log('上月年月:', lastMonthYear, lastMonth);

// 生成各种月度查询SQL
const queries = {
  // 1. 商户维度上月每日统计
  merchantDailyLastMonth: `
SELECT 
    date_str,
    merchant,
    unique_users AS daily_unique_users
FROM merchant_game_analytics
WHERE stat_type = 'merchant_daily'
    AND date_str >= '${lastMonthStart}'
    AND date_str <= '${lastMonthEnd}'
ORDER BY date_str, merchant;`,

  // 2. 商户维度上月月度统计
  merchantMonthlyLastMonth: `
SELECT 
    month_str,
    merchant,
    unique_users AS monthly_unique_users
FROM merchant_game_analytics
WHERE stat_type = 'merchant_monthly'
    AND month_str = '${lastMonthStr}'
ORDER BY merchant;`,

  // 3. 游戏维度上月每日统计
  gameDailyLastMonth: `
SELECT 
    date_str,
    merchant,
    game_id,
    unique_users AS daily_unique_users
FROM merchant_game_analytics
WHERE stat_type = 'game_daily'
    AND date_str >= '${lastMonthStart}'
    AND date_str <= '${lastMonthEnd}'
ORDER BY date_str, merchant, game_id;`,

  // 4. 游戏维度上月月度统计
  gameMonthlyLastMonth: `
SELECT 
    month_str,
    merchant,
    game_id,
    unique_users AS monthly_unique_users
FROM merchant_game_analytics
WHERE stat_type = 'game_monthly'
    AND month_str = '${lastMonthStr}'
ORDER BY merchant, game_id;`,

  // 5. 上月每日汇总统计
  dailySummaryLastMonth: `
SELECT 
    date_str,
    SUM(unique_users) AS total_unique_users,
    COUNT(DISTINCT merchant) AS merchant_count,
    COUNT(DISTINCT game_id) AS game_count
FROM merchant_game_analytics
WHERE stat_type = 'merchant_daily'
    AND date_str >= '${lastMonthStart}'
    AND date_str <= '${lastMonthEnd}'
GROUP BY date_str
ORDER BY date_str;`,

  // 6. 上月游戏每日汇总统计
  gameDailySummaryLastMonth: `
SELECT 
    date_str,
    SUM(unique_users) AS total_unique_users,
    COUNT(DISTINCT merchant) AS merchant_count,
    COUNT(DISTINCT game_id) AS game_count
FROM merchant_game_analytics
WHERE stat_type = 'game_daily'
    AND date_str >= '${lastMonthStart}'
    AND date_str <= '${lastMonthEnd}'
GROUP BY date_str
ORDER BY date_str;`,

  // 7. 上月商户月度汇总统计
  merchantMonthlySummary: `
SELECT 
    month_str,
    SUM(unique_users) AS total_unique_users,
    COUNT(DISTINCT merchant) AS merchant_count
FROM merchant_game_analytics
WHERE stat_type = 'merchant_monthly'
    AND month_str = '${lastMonthStr}'
GROUP BY month_str;`,

  // 8. 上月游戏月度汇总统计
  gameMonthlySummary: `
SELECT 
    month_str,
    SUM(unique_users) AS total_unique_users,
    COUNT(DISTINCT merchant) AS merchant_count,
    COUNT(DISTINCT game_id) AS game_count
FROM merchant_game_analytics
WHERE stat_type = 'game_monthly'
    AND month_str = '${lastMonthStr}'
GROUP BY month_str;`,

  // 9. 上月Top商户统计
  topMerchantsLastMonth: `
SELECT 
    merchant,
    SUM(unique_users) AS total_unique_users,
    COUNT(DISTINCT date_str) AS active_days,
    AVG(unique_users) AS avg_daily_users
FROM merchant_game_analytics
WHERE stat_type = 'merchant_daily'
    AND date_str >= '${lastMonthStart}'
    AND date_str <= '${lastMonthEnd}'
GROUP BY merchant
ORDER BY total_unique_users DESC
LIMIT 20;`,

  // 10. 上月Top游戏统计
  topGamesLastMonth: `
SELECT 
    game_id,
    SUM(unique_users) AS total_unique_users,
    COUNT(DISTINCT merchant) AS merchant_count,
    COUNT(DISTINCT date_str) AS active_days,
    AVG(unique_users) AS avg_daily_users
FROM merchant_game_analytics
WHERE stat_type = 'game_daily'
    AND date_str >= '${lastMonthStart}'
    AND date_str <= '${lastMonthEnd}'
GROUP BY game_id
ORDER BY total_unique_users DESC
LIMIT 20;`,

  // 11. 上月商户游戏组合统计
  merchantGameCombination: `
SELECT 
    merchant,
    game_id,
    SUM(unique_users) AS total_unique_users,
    COUNT(DISTINCT date_str) AS active_days,
    AVG(unique_users) AS avg_daily_users
FROM merchant_game_analytics
WHERE stat_type = 'game_daily'
    AND date_str >= '${lastMonthStart}'
    AND date_str <= '${lastMonthEnd}'
GROUP BY merchant, game_id
ORDER BY total_unique_users DESC
LIMIT 50;`,

  // 12. 上月趋势分析（按周统计）
  weeklyTrendLastMonth: `
SELECT 
    CASE 
        WHEN date_str >= '${lastMonthStart}' AND date_str < '${lastMonthStart + 7}' THEN 'week_1'
        WHEN date_str >= '${lastMonthStart + 7}' AND date_str < '${lastMonthStart + 14}' THEN 'week_2'
        WHEN date_str >= '${lastMonthStart + 14}' AND date_str < '${lastMonthStart + 21}' THEN 'week_3'
        WHEN date_str >= '${lastMonthStart + 21}' AND date_str <= '${lastMonthEnd}' THEN 'week_4'
    END AS week_of_month,
    SUM(unique_users) AS total_unique_users,
    COUNT(DISTINCT merchant) AS merchant_count,
    COUNT(DISTINCT date_str) AS active_days
FROM merchant_game_analytics
WHERE stat_type = 'merchant_daily'
    AND date_str >= '${lastMonthStart}'
    AND date_str <= '${lastMonthEnd}'
GROUP BY 
    CASE 
        WHEN date_str >= '${lastMonthStart}' AND date_str < '${lastMonthStart + 7}' THEN 'week_1'
        WHEN date_str >= '${lastMonthStart + 7}' AND date_str < '${lastMonthStart + 14}' THEN 'week_2'
        WHEN date_str >= '${lastMonthStart + 14}' AND date_str < '${lastMonthStart + 21}' THEN 'week_3'
        WHEN date_str >= '${lastMonthStart + 21}' AND date_str <= '${lastMonthEnd}' THEN 'week_4'
    END
ORDER BY week_of_month;`,

  // 13. 动态查询模板
  dynamicMonthlyQuery: `
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
         AND date_str >= '${lastMonthStart}' 
         AND date_str <= '${lastMonthEnd}')
        OR 
        (stat_type IN ('merchant_monthly', 'game_monthly') 
         AND month_str = '${lastMonthStr}')
    )
ORDER BY 
    stat_type,
    date_str,
    month_str,
    merchant,
    game_id;`
};

// 生成查询参数
const queryParams = {
  lastMonthStart,
  lastMonthEnd,
  lastMonthRange,
  lastMonthStr,
  lastMonthYear,
  lastMonth,
  currentYear,
  currentMonth,
  today
};

console.log('生成的查询数量:', Object.keys(queries).length);
console.log('查询参数:', queryParams);

// 返回结果
return {
  json: {
    success: true,
    timeData: timeData,
    queryParams: queryParams,
    queries: queries,
    // 为n8n工作流提供常用的查询
    recommendedQueries: {
      merchantDailyLastMonth: queries.merchantDailyLastMonth,
      merchantMonthlyLastMonth: queries.merchantMonthlyLastMonth,
      dailySummaryLastMonth: queries.dailySummaryLastMonth,
      topMerchantsLastMonth: queries.topMerchantsLastMonth,
      weeklyTrendLastMonth: queries.weeklyTrendLastMonth
    },
    // 提供查询说明
    queryDescriptions: {
      merchantDailyLastMonth: '商户维度上月每日统计',
      merchantMonthlyLastMonth: '商户维度上月月度统计',
      gameDailyLastMonth: '游戏维度上月每日统计',
      gameMonthlyLastMonth: '游戏维度上月月度统计',
      dailySummaryLastMonth: '上月每日汇总统计',
      gameDailySummaryLastMonth: '上月游戏每日汇总统计',
      merchantMonthlySummary: '上月商户月度汇总统计',
      gameMonthlySummary: '上月游戏月度汇总统计',
      topMerchantsLastMonth: '上月Top商户统计',
      topGamesLastMonth: '上月Top游戏统计',
      merchantGameCombination: '上月商户游戏组合统计',
      weeklyTrendLastMonth: '上月趋势分析（按周统计）',
      dynamicMonthlyQuery: '动态月度查询模板'
    }
  }
};
