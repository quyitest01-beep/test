// 从上游数据提取查询ID（简化版）
// n8n Code节点：提取查询ID数组

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

// 直接输出符合 prepare-athena-batch-query.js 的格式
return {
  json: {
    queryId: queryIds,  // 数组格式，会被 prepare-athena-batch-query.js 处理
    queryIdCount: queryIds.length
  }
};

