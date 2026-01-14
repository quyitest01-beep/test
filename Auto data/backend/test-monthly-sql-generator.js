// 测试月度SQL生成器

console.log('=== 测试月度SQL生成器 ===');

// 模拟月度时间计算器的输出
const mockTimeData = {
  "lastMonthRange": "20250901-20250930",
  "lastMonthStart": "20250901",
  "lastMonthEnd": "20250930",
  "lastMonthStr": "202509",
  "today": "2025-10-21",
  "currentYear": 2025,
  "currentMonth": 10,
  "lastMonthYear": 2025,
  "lastMonth": 9
};

// 执行月度SQL生成器逻辑
function generateMonthlySQL(timeData) {
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

  const queries = {
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

    merchantMonthlyLastMonth: `
SELECT 
    month_str,
    merchant,
    unique_users AS monthly_unique_users
FROM merchant_game_analytics
WHERE stat_type = 'merchant_monthly'
    AND month_str = '${lastMonthStr}'
ORDER BY merchant;`,

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
ORDER BY week_of_month;`
  };

  return queries;
}

// 生成SQL查询
const generatedQueries = generateMonthlySQL(mockTimeData);

console.log('输入月度时间数据:');
console.log(JSON.stringify(mockTimeData, null, 2));
console.log('');

console.log('生成的月度SQL查询:');
console.log('='.repeat(80));

// 显示生成的查询
Object.entries(generatedQueries).forEach(([queryName, sql], index) => {
  console.log(`${index + 1}. ${queryName}:`);
  console.log(sql);
  console.log('');
});

// 验证查询中的参数替换
console.log('='.repeat(80));
console.log('参数替换验证:');
console.log('');

const testQueries = [
  {
    name: 'merchantDailyLastMonth',
    sql: generatedQueries.merchantDailyLastMonth,
    expectedParams: ['20250901', '20250930']
  },
  {
    name: 'merchantMonthlyLastMonth',
    sql: generatedQueries.merchantMonthlyLastMonth,
    expectedParams: ['202509']
  },
  {
    name: 'gameDailyLastMonth',
    sql: generatedQueries.gameDailyLastMonth,
    expectedParams: ['20250901', '20250930']
  },
  {
    name: 'dailySummaryLastMonth',
    sql: generatedQueries.dailySummaryLastMonth,
    expectedParams: ['20250901', '20250930']
  },
  {
    name: 'topMerchantsLastMonth',
    sql: generatedQueries.topMerchantsLastMonth,
    expectedParams: ['20250901', '20250930']
  },
  {
    name: 'weeklyTrendLastMonth',
    sql: generatedQueries.weeklyTrendLastMonth,
    expectedParams: ['20250901', '20250930']
  }
];

testQueries.forEach((test, index) => {
  console.log(`${index + 1}. ${test.name}:`);
  console.log(`   期望参数: ${test.expectedParams.join(', ')}`);
  
  const allParamsFound = test.expectedParams.every(param => 
    test.sql.includes(param)
  );
  
  console.log(`   参数验证: ${allParamsFound ? '✅ 通过' : '❌ 失败'}`);
  console.log('');
});

// 显示SQL查询的统计信息
console.log('='.repeat(80));
console.log('月度SQL查询统计:');
console.log('');

const totalQueries = Object.keys(generatedQueries).length;
const totalLines = Object.values(generatedQueries).reduce((sum, sql) => 
  sum + sql.split('\n').length, 0
);

console.log(`总查询数量: ${totalQueries}`);
console.log(`总代码行数: ${totalLines}`);
console.log(`平均每查询行数: ${Math.round(totalLines / totalQueries)}`);

// 显示查询类型分布
const queryTypes = {
  'merchant_daily': 0,
  'merchant_monthly': 0,
  'game_daily': 0,
  'game_monthly': 0,
  'summary': 0,
  'top': 0,
  'trend': 0
};

Object.values(generatedQueries).forEach(sql => {
  if (sql.includes('merchant_daily')) queryTypes['merchant_daily']++;
  if (sql.includes('merchant_monthly')) queryTypes['merchant_monthly']++;
  if (sql.includes('game_daily')) queryTypes['game_daily']++;
  if (sql.includes('game_monthly')) queryTypes['game_monthly']++;
  if (sql.includes('SUM(') && sql.includes('GROUP BY')) queryTypes['summary']++;
  if (sql.includes('ORDER BY') && sql.includes('DESC')) queryTypes['top']++;
  if (sql.includes('CASE') && sql.includes('week_')) queryTypes['trend']++;
});

console.log('查询类型分布:');
Object.entries(queryTypes).forEach(([type, count]) => {
  if (count > 0) {
    console.log(`  ${type}: ${count} 个查询`);
  }
});

// 验证月度查询的特殊性
console.log('');
console.log('='.repeat(80));
console.log('月度查询特性验证:');
console.log('');

// 检查是否包含月度相关的查询
const monthlyFeatures = {
  '包含月度统计': generatedQueries.merchantMonthlyLastMonth.includes('merchant_monthly'),
  '包含每日统计': generatedQueries.merchantDailyLastMonth.includes('merchant_daily'),
  '包含汇总统计': generatedQueries.dailySummaryLastMonth.includes('SUM('),
  '包含Top统计': generatedQueries.topMerchantsLastMonth.includes('ORDER BY') && generatedQueries.topMerchantsLastMonth.includes('DESC'),
  '包含趋势分析': generatedQueries.weeklyTrendLastMonth.includes('CASE') && generatedQueries.weeklyTrendLastMonth.includes('week_'),
  '包含游戏维度': generatedQueries.gameDailyLastMonth.includes('game_id')
};

Object.entries(monthlyFeatures).forEach(([feature, hasFeature]) => {
  console.log(`${feature}: ${hasFeature ? '✅ 支持' : '❌ 不支持'}`);
});

console.log('');
console.log('='.repeat(80));
console.log('测试完成！');









