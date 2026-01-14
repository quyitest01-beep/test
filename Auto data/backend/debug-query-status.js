const asyncQueryService = require('./services/asyncQueryService');

// 调试查询状态
const queryId = 'c1244fc7-407c-45ab-9128-1b014cb1b6b8';

console.log('=== 调试查询状态 ===');
console.log('查询ID:', queryId);

// 获取查询状态
const queryStatus = asyncQueryService.getQueryStatus(queryId);

if (!queryStatus) {
  console.log('❌ 查询不存在或已过期');
} else {
  console.log('✅ 查询状态:', queryStatus.status);
  console.log('⏱️ 运行时间:', queryStatus.elapsed, '秒');
  console.log('📊 进度:', queryStatus.progress, '%');
  console.log('🔄 重试次数:', queryStatus.retryCount);
  console.log('💬 消息:', queryStatus.message);
  
  if (queryStatus.result) {
    console.log('📋 查询结果:');
    console.log('  - 行数:', queryStatus.result.row_count || queryStatus.result.rowCount || 0);
    console.log('  - 数据扫描量:', queryStatus.result.dataScanned || 0);
    console.log('  - 执行时间:', queryStatus.result.executionTime || 0);
    console.log('  - 成本:', queryStatus.result.cost || 0);
  } else {
    console.log('❌ 没有查询结果');
  }
  
  if (queryStatus.error) {
    console.log('❌ 错误信息:', queryStatus.error);
  }
}

// 列出所有查询状态
console.log('\n=== 所有查询状态 ===');
console.log('注意：需要手动检查asyncQueryService中的查询状态Map');
