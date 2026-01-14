// n8n Code节点：将多个查询结果转换为数组
// 用于"Insert row"节点处理多个查询结果

// 获取输入数据
const inputData = $input.all();

// 处理每个输入项
const outputItems = [];

for (const item of inputData) {
  const queryResults = item.json.queryResults;
  
  if (queryResults && typeof queryResults === 'object') {
    // 遍历所有查询结果
    for (const [queryName, queryData] of Object.entries(queryResults)) {
      outputItems.push({
        json: {
          queryName: queryName,           // 查询名称
          queryId: queryData.queryId,     // 查询ID
          status: queryData.status,       // 状态
          message: queryData.message,     // 消息
          batchId: item.json.batchId,     // 批量查询ID
          timestamp: new Date().toISOString() // 时间戳
        }
      });
    }
  }
}

// 返回所有查询结果
return outputItems;
