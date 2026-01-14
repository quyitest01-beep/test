// 准备Athena批量查询请求
// n8n Code节点：准备批量查询请求数据

const queryId = $json.queryId || $json.query_execution_id || $json.queryExecutionId || '';

if (!queryId) {
  throw new Error('缺少查询执行ID');
}

// 确保 QueryExecutionIds 是数组格式
// 支持单个ID字符串、ID数组、或逗号分隔的字符串
let queryIds = [];

if (Array.isArray(queryId)) {
  // 如果已经是数组，直接使用
  queryIds = queryId.filter(id => id && id.trim() !== '');
} else if (typeof queryId === 'string') {
  // 如果是字符串，检查是否包含逗号（多个ID）
  if (queryId.includes(',')) {
    queryIds = queryId.split(',').map(id => id.trim()).filter(id => id !== '');
  } else {
    // 单个ID
    queryIds = [queryId.trim()];
  }
} else {
  // 其他类型，尝试转换为字符串
  queryIds = [String(queryId)];
}

if (queryIds.length === 0) {
  throw new Error('没有有效的查询执行ID');
}

// 构建请求体（AWS Athena BatchGetQueryExecution API 格式）
const requestBody = {
  QueryExecutionIds: queryIds
};

console.log('📤 准备批量查询请求:', {
  queryIdCount: queryIds.length,
  queryIds: queryIds
});

// 构建输出
return {
  json: {
    requestBody: requestBody,
    queryIds: queryIds,
    queryIdCount: queryIds.length,
    // 保留原始数据
    ...$json
  }
};

