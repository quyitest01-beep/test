// 从上游数据提取查询ID，直接输出 Athena API 格式
// n8n Code节点：提取查询ID并构建请求体

const items = $input.all();

if (items.length === 0) {
  throw new Error('上游数据为空');
}

console.log('📥 收到上游数据，共', items.length, '条记录');

// 提取所有的 queryid
const queryIds = items
  .map((item, index) => {
    const data = item.json;
    const queryId = data.queryid || data.queryId || data.query_execution_id || '';
    
    if (!queryId) {
      console.warn('⚠️ 第', index + 1, '条记录缺少 queryid:', data);
    }
    
    return queryId;
  })
  .filter(id => id && id.trim() !== '');

if (queryIds.length === 0) {
  throw new Error('没有找到有效的查询ID');
}

console.log('✅ 提取到', queryIds.length, '个查询ID');

// 直接构建 Athena BatchGetQueryExecution API 的请求体
const requestBody = {
  QueryExecutionIds: queryIds
};

// 构建输出（可以直接传给 HTTP Request 节点）
const result = {
  requestBody: requestBody,
  queryIds: queryIds,
  queryIdCount: queryIds.length,
  
  // 保留原始记录信息（可选）
  records: items.map((item, index) => ({
    index: index,
    id: item.json.id,
    queryid: item.json.queryid,
    type: item.json.type,
    result: item.json.result,
    createdAt: item.json.createdAt,
    updatedAt: item.json.updatedAt
  }))
};

console.log('📤 输出请求体，包含', result.queryIdCount, '个查询ID');

return {
  json: result
};





