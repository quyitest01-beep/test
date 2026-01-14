// 测试批量查询API

console.log('=== 测试批量查询API ===');

// 模拟批量查询请求
const batchQueryRequest = {
  queries: {
    "merchantDailyLastWeek": `
SELECT 
    date_str,
    merchant,
    unique_users AS daily_unique_users
FROM merchant_game_analytics
WHERE stat_type = 'merchant_daily'
    AND date_str >= '20251013'
    AND date_str <= '20251019'
ORDER BY date_str, merchant;`,

    "merchantDailyThisWeek": `
SELECT 
    date_str,
    merchant,
    unique_users AS daily_unique_users
FROM merchant_game_analytics
WHERE stat_type = 'merchant_daily'
    AND date_str >= '20251020'
    AND date_str <= '20251026'
ORDER BY date_str, merchant;`,

    "merchantMonthlyLastWeek": `
SELECT 
    month_str,
    merchant,
    unique_users AS monthly_unique_users
FROM merchant_game_analytics
WHERE stat_type = 'merchant_monthly'
    AND month_str = '202510'
ORDER BY merchant;`
  },
  database: "gmp",
  maxRetries: 3
};

console.log('批量查询请求:');
console.log(JSON.stringify(batchQueryRequest, null, 2));

// 模拟API调用
async function testBatchQueryAPI() {
  try {
    console.log('\n=== 测试批量查询启动 ===');
    
    // 模拟启动批量查询
    const startResponse = {
      success: true,
      batchId: `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      queryResults: {
        "merchantDailyLastWeek": {
          queryId: "query_1_uuid",
          status: "pending",
          message: "查询已启动"
        },
        "merchantDailyThisWeek": {
          queryId: "query_2_uuid", 
          status: "pending",
          message: "查询已启动"
        },
        "merchantMonthlyLastWeek": {
          queryId: "query_3_uuid",
          status: "pending", 
          message: "查询已启动"
        }
      },
      totalQueries: 3,
      successfulQueries: 3,
      failedQueries: 0,
      message: "批量查询已启动: 3/3 成功"
    };

    console.log('启动响应:');
    console.log(JSON.stringify(startResponse, null, 2));

    console.log('\n=== 测试批量查询状态检查 ===');
    
    // 模拟状态检查
    const statusResponse = {
      success: true,
      batchId: startResponse.batchId,
      status: "running",
      queryStatuses: {
        "merchantDailyLastWeek": {
          queryId: "query_1_uuid",
          status: "completed",
          rowCount: 150,
          executionTime: 2500,
          message: "查询执行成功！"
        },
        "merchantDailyThisWeek": {
          queryId: "query_2_uuid",
          status: "running",
          progress: 60,
          message: "查询正在执行中，请稍候..."
        },
        "merchantMonthlyLastWeek": {
          queryId: "query_3_uuid",
          status: "pending",
          progress: 0,
          message: "查询已启动，正在准备执行..."
        }
      },
      summary: {
        totalQueries: 3,
        completedQueries: 1,
        failedQueries: 0,
        runningQueries: 2,
        progress: 33
      },
      startTime: Date.now() - 30000,
      elapsed: 30000
    };

    console.log('状态响应:');
    console.log(JSON.stringify(statusResponse, null, 2));

    console.log('\n=== 测试完成状态 ===');
    
    // 模拟完成状态
    const completedResponse = {
      success: true,
      batchId: startResponse.batchId,
      status: "completed",
      queryStatuses: {
        "merchantDailyLastWeek": {
          queryId: "query_1_uuid",
          status: "completed",
          rowCount: 150,
          executionTime: 2500,
          message: "查询执行成功！"
        },
        "merchantDailyThisWeek": {
          queryId: "query_2_uuid",
          status: "completed",
          rowCount: 120,
          executionTime: 1800,
          message: "查询执行成功！"
        },
        "merchantMonthlyLastWeek": {
          queryId: "query_3_uuid",
          status: "completed",
          rowCount: 45,
          executionTime: 1200,
          message: "查询执行成功！"
        }
      },
      summary: {
        totalQueries: 3,
        completedQueries: 3,
        failedQueries: 0,
        runningQueries: 0,
        progress: 100
      },
      startTime: Date.now() - 60000,
      elapsed: 60000
    };

    console.log('完成响应:');
    console.log(JSON.stringify(completedResponse, null, 2));

    console.log('\n=== API端点说明 ===');
    console.log('1. 启动批量查询:');
    console.log('   POST /api/batch/start');
    console.log('   Body: { queries: { "queryName": "SQL语句" }, database: "gmp" }');
    console.log('');
    console.log('2. 查询批量状态:');
    console.log('   GET /api/batch/status/{batchId}');
    console.log('');
    console.log('3. 取消批量查询:');
    console.log('   POST /api/batch/cancel/{batchId}');
    console.log('');

    console.log('=== 使用示例 ===');
    console.log('curl -X POST http://localhost:3000/api/batch/start \\');
    console.log('  -H "Content-Type: application/json" \\');
    console.log('  -d \'{"queries":{"test":"SELECT 1"},"database":"gmp"}\'');
    console.log('');

  } catch (error) {
    console.error('测试失败:', error.message);
  }
}

// 运行测试
testBatchQueryAPI();

console.log('\n=== 批量查询API特性 ===');
console.log('✅ 支持多个SQL查询同时执行');
console.log('✅ 每个查询有独立的查询ID');
console.log('✅ 批量查询有统一的batchId');
console.log('✅ 支持查询状态跟踪');
console.log('✅ 支持批量取消');
console.log('✅ 提供进度统计');
console.log('✅ 支持查询结果获取');
console.log('');

console.log('=== 与单个查询API的区别 ===');
console.log('单个查询API:');
console.log('  POST /api/async/start');
console.log('  Body: { sql: "SELECT ...", database: "gmp" }');
console.log('');
console.log('批量查询API:');
console.log('  POST /api/batch/start');
console.log('  Body: { queries: { "name1": "SQL1", "name2": "SQL2" }, database: "gmp" }');
console.log('');

console.log('测试完成！');









