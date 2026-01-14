// 构建 Athena 批量查询请求体（JSON字符串格式）
// n8n Code节点：构建请求体

const items = $input.all();

if (items.length === 0) {
  throw new Error('上游数据为空');
}

// 提取所有的 queryid
const queryIds = items
  .map(item => {
    const data = item.json;
    return data.queryid || data.queryId || data.query_execution_id || '';
  })
  .filter(id => id && id.trim() !== '');

if (queryIds.length === 0) {
  throw new Error('没有找到有效的查询ID');
}

// 构建请求体对象
const requestBody = {
  QueryExecutionIds: queryIds
};

// 转换为 JSON 字符串（用于 Raw Body）
const requestBodyString = JSON.stringify(requestBody);

console.log('✅ 构建的请求体:');
console.log(requestBodyString);
console.log('📊 查询ID数量:', queryIds.length);

// 输出
return {
  json: {
    requestBodyString: requestBodyString,
    queryIds: queryIds,
    queryIdCount: queryIds.length
  }
};

