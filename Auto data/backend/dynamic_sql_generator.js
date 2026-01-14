// 动态SQL生成器
// 根据时间计算器的输出生成相应的查询SQL
// 用于n8n工作流

const inputData = $input.all();

console.log('=== 动态SQL生成器 ===');
console.log('输入数据:', inputData);

// 获取时间计算器的输出
const timeData = inputData[0].json;
const {
  lastWeekRange,
  lastWeekStart,
  lastWeekEnd,
  thisWeekRange,
  thisWeekStart,
  thisWeekEnd,
  lastWeekMonth,
  thisWeekMonth,
  today,
  todayDayOfWeek,
  todayDayOfWeekName
} = timeData;

console.log('时间数据解析:');
console.log('上周范围:', lastWeekRange);
console.log('本周范围:', thisWeekRange);
console.log('上周月份:', lastWeekMonth);
console.log('今日:', today, todayDayOfWeekName);

// 生成各种查询SQL
const queries = {
  // 1. 商户维度上周每日统计
  merchantDailyLastWeek: `
SELECT 
    date_str,
    merchant,
    unique_users AS daily_unique_users
FROM merchant_game_analytics
WHERE stat_type = 'merchant_daily'
    AND date_str >= '${lastWeekStart}'
    AND date_str <= '${lastWeekEnd}'
ORDER BY date_str, merchant;`,

  // 2. 商户维度本周每日统计
  merchantDailyThisWeek: `
SELECT 
    date_str,
    merchant,
    unique_users AS daily_unique_users
FROM merchant_game_analytics
WHERE stat_type = 'merchant_daily'
    AND date_str >= '${thisWeekStart}'
    AND date_str <= '${thisWeekEnd}'
ORDER BY date_str, merchant;`,

  // 3. 商户维度上周月度统计
  merchantMonthlyLastWeek: `
SELECT 
    month_str,
    merchant,
    unique_users AS monthly_unique_users
FROM merchant_game_analytics
WHERE stat_type = 'merchant_monthly'
    AND month_str = '${lastWeekMonth}'
ORDER BY merchant;`,

  // 4. 游戏维度上周每日统计
  gameDailyLastWeek: `
SELECT 
    date_str,
    merchant,
    game_id,
    unique_users AS daily_unique_users
FROM merchant_game_analytics
WHERE stat_type = 'game_daily'
    AND date_str >= '${lastWeekStart}'
    AND date_str <= '${lastWeekEnd}'
ORDER BY date_str, merchant, game_id;`,

  // 5. 游戏维度本周每日统计
  gameDailyThisWeek: `
SELECT 
    date_str,
    merchant,
    game_id,
    unique_users AS daily_unique_users
FROM merchant_game_analytics
WHERE stat_type = 'game_daily'
    AND date_str >= '${thisWeekStart}'
    AND date_str <= '${thisWeekEnd}'
ORDER BY date_str, merchant, game_id;`,

  // 6. 游戏维度上周月度统计
  gameMonthlyLastWeek: `
SELECT 
    month_str,
    merchant,
    game_id,
    unique_users AS monthly_unique_users
FROM merchant_game_analytics
WHERE stat_type = 'game_monthly'
    AND month_str = '${lastWeekMonth}'
ORDER BY merchant, game_id;`,

  // 7. 综合查询：上周和本周对比
  weeklyComparison: `
SELECT 
    CASE 
        WHEN date_str >= '${lastWeekStart}' AND date_str <= '${lastWeekEnd}' THEN 'last_week'
        WHEN date_str >= '${thisWeekStart}' AND date_str <= '${thisWeekEnd}' THEN 'this_week'
    END AS week_type,
    date_str,
    merchant,
    unique_users AS daily_unique_users
FROM merchant_game_analytics
WHERE stat_type = 'merchant_daily'
    AND (
        (date_str >= '${lastWeekStart}' AND date_str <= '${lastWeekEnd}')
        OR 
        (date_str >= '${thisWeekStart}' AND date_str <= '${thisWeekEnd}')
    )
ORDER BY week_type, date_str, merchant;`,

  // 8. 汇总查询：上周和本周总体统计
  weeklySummary: `
SELECT 
    'last_week' AS period_type,
    '${lastWeekRange}' AS period_range,
    SUM(unique_users) AS total_unique_users,
    COUNT(DISTINCT merchant) AS merchant_count
FROM merchant_game_analytics
WHERE stat_type = 'merchant_daily'
    AND date_str >= '${lastWeekStart}'
    AND date_str <= '${lastWeekEnd}'

UNION ALL

SELECT 
    'this_week' AS period_type,
    '${thisWeekRange}' AS period_range,
    SUM(unique_users) AS total_unique_users,
    COUNT(DISTINCT merchant) AS merchant_count
FROM merchant_game_analytics
WHERE stat_type = 'merchant_daily'
    AND date_str >= '${thisWeekStart}'
    AND date_str <= '${thisWeekEnd}'

ORDER BY period_type;`,

  // 9. 动态查询模板
  dynamicQuery: `
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
             (date_str >= '${lastWeekStart}' AND date_str <= '${lastWeekEnd}')
             OR 
             (date_str >= '${thisWeekStart}' AND date_str <= '${thisWeekEnd}')
         ))
        OR 
        (stat_type IN ('merchant_monthly', 'game_monthly') 
         AND month_str = '${lastWeekMonth}')
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
  lastWeekStart,
  lastWeekEnd,
  thisWeekStart,
  thisWeekEnd,
  lastWeekMonth,
  thisWeekMonth,
  lastWeekRange,
  thisWeekRange,
  today,
  todayDayOfWeek,
  todayDayOfWeekName
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
      merchantDailyLastWeek: queries.merchantDailyLastWeek,
      merchantDailyThisWeek: queries.merchantDailyThisWeek,
      weeklyComparison: queries.weeklyComparison,
      weeklySummary: queries.weeklySummary
    },
    // 提供查询说明
    queryDescriptions: {
      merchantDailyLastWeek: '商户维度上周每日统计',
      merchantDailyThisWeek: '商户维度本周每日统计',
      merchantMonthlyLastWeek: '商户维度上周月度统计',
      gameDailyLastWeek: '游戏维度上周每日统计',
      gameDailyThisWeek: '游戏维度本周每日统计',
      gameMonthlyLastWeek: '游戏维度上周月度统计',
      weeklyComparison: '上周和本周对比统计',
      weeklySummary: '上周和本周汇总统计',
      dynamicQuery: '动态查询模板'
    }
  }
};
