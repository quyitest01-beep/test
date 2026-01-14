// 准备 Athena 请求 - 使用 Raw Body 格式
// n8n Code节点：构建请求体字符串

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

console.log('📤 构建的请求体:');
console.log(requestBodyString);
console.log('📊 查询ID数量:', queryIds.length);

// 输出两种格式，方便不同场景使用
return {
  json: {
    // 用于 Raw Body
    requestBodyString: requestBodyString,
    
    // 用于 JSON Body（如果支持）
    requestBody: requestBody,
    
    // 原始数据
    queryIds: queryIds,
    queryIdCount: queryIds.length
  }
};





