// 简化的动态SQL生成器
// 支持上周和上月的查询，灵活处理时间数据

const inputData = $input.all();
const timeData = inputData[0].json;

// 提取时间参数，支持灵活的时间数据
const { 
  lastWeekStart, 
  lastWeekEnd, 
  lastWeekRange,
  lastMonthStart, 
  lastMonthEnd, 
  lastMonthRange,
  lastMonthMonth
} = timeData;

console.log('时间数据检查:');
console.log('上周数据:', { lastWeekStart, lastWeekEnd, lastWeekRange });
console.log('上月数据:', { lastMonthStart, lastMonthEnd, lastMonthRange, lastMonthMonth });

const queries = {};

// 检查是否有上周数据，如果有则生成上周查询
if (lastWeekStart && lastWeekEnd && lastWeekRange) {
  console.log(`生成上周查询，时间范围: ${lastWeekRange}`);
  
  queries.merchantDailyLastWeek = `
SELECT 
    date_str,
    merchant,
    unique_users AS daily_unique_users
FROM merchant_game_analytics
WHERE stat_type = 'merchant_daily'
    AND date_str >= '${lastWeekStart}'
    AND date_str <= '${lastWeekEnd}'
ORDER BY date_str, merchant;`;

  queries.gameDailyLastWeek = `
SELECT 
    date_str,
    merchant,
    game_id,
    unique_users AS daily_unique_users
FROM merchant_game_analytics
WHERE stat_type = 'game_daily'
    AND date_str >= '${lastWeekStart}'
    AND date_str <= '${lastWeekEnd}'
ORDER BY date_str, merchant, game_id;`;

  queries.merchantWeeklyTotal = `
SELECT 
    '${lastWeekRange}' AS period_range,
    merchant,
    SUM(unique_users) AS weekly_unique_users,
    COUNT(DISTINCT date_str) AS active_days
FROM merchant_game_analytics
WHERE stat_type = 'merchant_daily'
    AND date_str >= '${lastWeekStart}'
    AND date_str <= '${lastWeekEnd}'
GROUP BY merchant
ORDER BY weekly_unique_users DESC;`;

  queries.gameWeeklyTotal = `
SELECT 
    '${lastWeekRange}' AS period_range,
    merchant,
    game_id,
    SUM(unique_users) AS weekly_unique_users,
    COUNT(DISTINCT date_str) AS active_days
FROM merchant_game_analytics
WHERE stat_type = 'game_daily'
    AND date_str >= '${lastWeekStart}'
    AND date_str <= '${lastWeekEnd}'
GROUP BY merchant, game_id
ORDER BY weekly_unique_users DESC;`;
}

// 检查是否有上月数据，如果有则生成上月查询
if (lastMonthStart && lastMonthEnd && lastMonthRange) {
  console.log(`生成上月查询，时间范围: ${lastMonthRange}`);
  
  queries.merchantDailyLastMonth = `
SELECT 
    date_str,
    merchant,
    unique_users AS daily_unique_users
FROM merchant_game_analytics
WHERE stat_type = 'merchant_daily'
    AND date_str >= '${lastMonthStart}'
    AND date_str <= '${lastMonthEnd}'
ORDER BY date_str, merchant;`;

  queries.gameDailyLastMonth = `
SELECT 
    date_str,
    merchant,
    game_id,
    unique_users AS daily_unique_users
FROM merchant_game_analytics
WHERE stat_type = 'game_daily'
    AND date_str >= '${lastMonthStart}'
    AND date_str <= '${lastMonthEnd}'
ORDER BY date_str, merchant, game_id;`;

  queries.merchantMonthlyTotal = `
SELECT 
    '${lastMonthRange}' AS period_range,
    merchant,
    SUM(unique_users) AS monthly_unique_users,
    COUNT(DISTINCT date_str) AS active_days
FROM merchant_game_analytics
WHERE stat_type = 'merchant_daily'
    AND date_str >= '${lastMonthStart}'
    AND date_str <= '${lastMonthEnd}'
GROUP BY merchant
ORDER BY monthly_unique_users DESC;`;

  queries.gameMonthlyTotal = `
SELECT 
    '${lastMonthRange}' AS period_range,
    merchant,
    game_id,
    SUM(unique_users) AS monthly_unique_users,
    COUNT(DISTINCT date_str) AS active_days
FROM merchant_game_analytics
WHERE stat_type = 'game_daily'
    AND date_str >= '${lastMonthStart}'
    AND date_str <= '${lastMonthEnd}'
GROUP BY merchant, game_id
ORDER BY monthly_unique_users DESC;`;
}

// 统计生成的查询数量
const queryCount = Object.keys(queries).length;
console.log(`总共生成 ${queryCount} 个查询`);

// 返回结果
return {
  json: {
    success: true,
    timeData: {
      lastWeek: { start: lastWeekStart, end: lastWeekEnd, range: lastWeekRange },
      lastMonth: { start: lastMonthStart, end: lastMonthEnd, range: lastMonthRange }
    },
    queries: queries,
    queryCount: queryCount,
    hasLastWeek: !!(lastWeekStart && lastWeekEnd),
    hasLastMonth: !!(lastMonthStart && lastMonthEnd)
  }
};
