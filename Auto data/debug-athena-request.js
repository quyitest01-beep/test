// 调试 Athena 请求 - 检查数据格式
// n8n Code节点：调试和验证请求数据

const input = $json;

console.log('🔍 调试信息 - 输入数据:');
console.log(JSON.stringify(input, null, 2));

// 检查是否有 requestBody
if (!input.requestBody) {
  console.error('❌ 缺少 requestBody 字段');
  
  // 尝试从其他字段构建
  if (input.queryIds && Array.isArray(input.queryIds)) {
    console.log('✅ 找到 queryIds 数组，构建 requestBody');
    input.requestBody = {
      QueryExecutionIds: input.queryIds
    };
  } else if (input.queryId) {
    console.log('✅ 找到 queryId，转换为数组');
    const queryIds = Array.isArray(input.queryId) ? input.queryId : [input.queryId];
    input.requestBody = {
      QueryExecutionIds: queryIds
    };
  } else {
    throw new Error('缺少 requestBody 或 queryIds 字段。请确保上游 Code 节点输出了 requestBody。');
  }
}

// 验证 requestBody 格式
const requestBody = input.requestBody;

if (!requestBody.QueryExecutionIds) {
  throw new Error('requestBody 中缺少 QueryExecutionIds 字段');
}

if (!Array.isArray(requestBody.QueryExecutionIds)) {
  throw new Error('QueryExecutionIds 必须是数组格式');
}

if (requestBody.QueryExecutionIds.length === 0) {
  throw new Error('QueryExecutionIds 数组为空');
}

// 验证每个 ID 都是字符串
const invalidIds = requestBody.QueryExecutionIds.filter(id => typeof id !== 'string' || id.trim() === '');
if (invalidIds.length > 0) {
  throw new Error('QueryExecutionIds 中包含无效的ID: ' + JSON.stringify(invalidIds));
}

console.log('✅ requestBody 格式验证通过');
console.log('📤 QueryExecutionIds 数量:', requestBody.QueryExecutionIds.length);
console.log('📤 QueryExecutionIds:', requestBody.QueryExecutionIds);

// 构建最终输出
const result = {
  requestBody: requestBody,
  // 保留其他字段
  ...input
};

// 验证 JSON 序列化
try {
  const jsonString = JSON.stringify(result.requestBody);
  console.log('✅ JSON 序列化成功，长度:', jsonString.length);
  console.log('📄 JSON 内容:', jsonString);
} catch (error) {
  throw new Error('requestBody 无法序列化为 JSON: ' + error.message);
}

return {
  json: result
};





