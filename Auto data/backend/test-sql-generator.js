// 测试动态SQL生成器

console.log('=== 测试动态SQL生成器 ===');

// 模拟时间计算器的输出
const mockTimeData = {
  "lastWeekRange": "20251013-20251019",
  "lastWeekStart": "20251013",
  "lastWeekEnd": "20251019",
  "thisWeekRange": "20251020-20251026",
  "thisWeekStart": "20251020",
  "thisWeekEnd": "20251026",
  "lastWeekMonth": 202510,
  "thisWeekMonth": 202510,
  "today": "2025-10-21",
  "todayDayOfWeek": 2,
  "todayDayOfWeekName": "周二",
  "calculation": {
    "daysToLastMonday": 8,
    "lastMondayDate": "2025-10-13",
    "lastSundayDate": "2025-10-19"
  }
};

// 模拟n8n输入格式
const mockInput = [{ json: mockTimeData }];

// 模拟n8n的$input.all()函数
global.$input = {
  all: () => mockInput
};

// 执行SQL生成器逻辑
function generateSQL(timeData) {
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

  const queries = {
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

ORDER BY period_type;`
  };

  return queries;
}

// 生成SQL查询
const generatedQueries = generateSQL(mockTimeData);

console.log('输入时间数据:');
console.log(JSON.stringify(mockTimeData, null, 2));
console.log('');

console.log('生成的SQL查询:');
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
    name: 'merchantDailyLastWeek',
    sql: generatedQueries.merchantDailyLastWeek,
    expectedParams: ['20251013', '20251019']
  },
  {
    name: 'merchantDailyThisWeek',
    sql: generatedQueries.merchantDailyThisWeek,
    expectedParams: ['20251020', '20251026']
  },
  {
    name: 'weeklyComparison',
    sql: generatedQueries.weeklyComparison,
    expectedParams: ['20251013', '20251019', '20251020', '20251026']
  },
  {
    name: 'weeklySummary',
    sql: generatedQueries.weeklySummary,
    expectedParams: ['20251013-20251019', '20251020-20251026']
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
console.log('SQL查询统计:');
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
  'comparison': 0,
  'summary': 0
};

Object.values(generatedQueries).forEach(sql => {
  if (sql.includes('merchant_daily')) queryTypes['merchant_daily']++;
  if (sql.includes('merchant_monthly')) queryTypes['merchant_monthly']++;
  if (sql.includes('game_daily')) queryTypes['game_daily']++;
  if (sql.includes('game_monthly')) queryTypes['game_monthly']++;
  if (sql.includes('CASE')) queryTypes['comparison']++;
  if (sql.includes('UNION ALL')) queryTypes['summary']++;
});

console.log('查询类型分布:');
Object.entries(queryTypes).forEach(([type, count]) => {
  if (count > 0) {
    console.log(`  ${type}: ${count} 个查询`);
  }
});

console.log('');
console.log('='.repeat(80));
console.log('测试完成！');









