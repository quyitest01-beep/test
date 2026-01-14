// n8n Code节点：处理多个查询结果并准备插入数据库
// 这个版本会为每个查询结果创建一个独立的记录

const inputData = $input.all();
const outputItems = [];

for (const item of inputData) {
  const queryResults = item.json.queryResults;
  const batchId = item.json.batchId;
  const success = item.json.success;
  
  if (queryResults && typeof queryResults === 'object') {
    // 遍历所有查询结果
    for (const [queryName, queryData] of Object.entries(queryResults)) {
      // 为每个查询结果创建一个输出项
      outputItems.push({
        json: {
          // 数据库字段
          queryid: queryData.queryId,
          result: queryData.message,
          status: queryData.status,
          queryName: queryName,
          batchId: batchId,
          success: success,
          
          // 额外信息
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          
          // 原始数据（可选）
          originalData: {
            queryName: queryName,
            queryId: queryData.queryId,
            status: queryData.status,
            message: queryData.message
          }
        }
      });
    }
  }
}

console.log(`处理了 ${outputItems.length} 个查询结果`);
return outputItems;
