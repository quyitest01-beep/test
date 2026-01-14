// 从上游数据提取查询ID，准备批量查询
// n8n Code节点：提取查询ID并格式化

const items = $input.all();

if (items.length === 0) {
  throw new Error('上游数据为空');
}

console.log('📥 收到上游数据，共', items.length, '条记录');

// 提取所有的 queryid
const queryIds = [];
const records = [];

items.forEach((item, index) => {
  const data = item.json;
  const queryId = data.queryid || data.queryId || data.query_execution_id || '';
  
  if (queryId) {
    queryIds.push(queryId);
    records.push({
      id: data.id || index,
      queryid: queryId,
      type: data.type || '',
      result: data.result || '',
      createdAt: data.createdAt || '',
      updatedAt: data.updatedAt || '',
      // 保留其他字段
      ...data
    });
  } else {
    console.warn('⚠️ 第', index + 1, '条记录缺少 queryid:', data);
  }
});

if (queryIds.length === 0) {
  throw new Error('没有找到有效的查询ID');
}

console.log('✅ 提取到', queryIds.length, '个查询ID:', queryIds);

// 构建输出格式（符合 prepare-athena-batch-query.js 的输入格式）
const result = {
  // 单个 queryId 字段（会被 prepare-athena-batch-query.js 转换为数组）
  queryId: queryIds,
  
  // 或者直接构建 requestBody（如果直接传给 HTTP Request 节点）
  requestBody: {
    QueryExecutionIds: queryIds
  },
  
  // 统计信息
  queryIdCount: queryIds.length,
  records: records,
  
  // 原始数据摘要
  summary: {
    totalRecords: items.length,
    validQueryIds: queryIds.length,
    invalidRecords: items.length - queryIds.length
  }
};

console.log('📤 输出结果:', {
  queryIdCount: result.queryIdCount,
  requestBody: result.requestBody
});

return {
  json: result
};





