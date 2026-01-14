// 优化的动态SQL生成器
// 根据时间计算器的输出生成4个核心查询SQL

const inputData = $input.all();

console.log('=== 优化的动态SQL生成器 ===');
console.log('输入数据数量:', inputData.length);

// 获取时间计算器的输出
const timeData = inputData[0].json;
const {
  lastWeekRange,
  lastWeekStart,
  lastWeekEnd,
  lastWeekMonth
} = timeData;

console.log('时间数据解析:');
console.log('上周范围:', lastWeekRange);
console.log('上周开始:', lastWeekStart);
console.log('上周结束:', lastWeekEnd);
console.log('上周月份:', lastWeekMonth);

// 生成4个核心查询SQL
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

  // 2. 游戏维度上周每日统计
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

  // 3. 商户维度上周合计
  merchantWeeklyTotal: `
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
ORDER BY weekly_unique_users DESC;`,

  // 4. 游戏维度上周合计
  gameWeeklyTotal: `
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
ORDER BY weekly_unique_users DESC;`
};

// 生成查询参数
const queryParams = {
  lastWeekStart,
  lastWeekEnd,
  lastWeekRange,
  lastWeekMonth
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
    // 查询说明
    queryDescriptions: {
      merchantDailyLastWeek: '商户维度上周每日统计',
      gameDailyLastWeek: '游戏维度上周每日统计',
      merchantWeeklyTotal: '商户维度上周合计',
      gameWeeklyTotal: '游戏维度上周合计'
    },
    // 统计信息
    summary: {
      totalQueries: 4,
      period: lastWeekRange,
      generatedAt: new Date().toISOString()
    }
  }
};
