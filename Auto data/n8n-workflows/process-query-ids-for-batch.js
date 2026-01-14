// n8n Code 节点：处理上游数据，整合为批量查询格式

// 获取所有输入项
const items = $input.all();

// 提取所有 queryId
const queryIds = items
  .map(item => {
    const data = item.json;
    // 支持多种可能的字段名
    return data.queryId || data.query_id || data.id || null;
  })
  .filter(queryId => queryId && queryId !== 'batch'); // 过滤掉无效值

// 检查是否有有效的 queryId
if (queryIds.length === 0) {
  return {
    json: {
      error: '未找到有效的 queryId',
      inputItems: items.length,
      message: '请确保输入数据包含 queryId 字段'
    }
  };
}

// 构建批量查询请求数据
const batchRequest = {
  queryIds: queryIds,
  // 可选：保留原始数据用于后续处理
  originalData: items.map(item => item.json)
};

// 返回结果
return {
  json: {
    ...batchRequest,
    // 添加统计信息
    stats: {
      totalQueryIds: queryIds.length,
      inputItems: items.length
    }
  }
};

