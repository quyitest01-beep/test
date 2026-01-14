// n8n Code 节点：取消 Athena 查询（不使用 AWS SDK）
// 使用后端 API 而不是直接调用 AWS SDK

// 从输入中获取数据
const input = $input.first().json;

// 提取必要信息
const queryExecutionId = input.QueryExecutionId || input.queryId || input.queryExecutionId;
const apiBaseUrl = input.API_BASE_URL || 'http://localhost:8000'; // 后端服务地址
const apiKey = input.API_KEY || input.X_API_KEY || ''; // API 密钥

// 验证必要参数
if (!queryExecutionId) {
  return {
    json: {
      success: false,
      error: 'QueryExecutionId is required',
      message: '缺少查询ID'
    }
  };
}

// 调用后端 API 取消查询
try {
  const cancelUrl = `${apiBaseUrl}/api/query/cancel/${queryExecutionId}`;
  
  console.log(`正在取消查询: ${queryExecutionId}`);
  console.log(`API URL: ${cancelUrl}`);
  
  // 构建请求头
  const headers = {
    'Content-Type': 'application/json'
  };
  
  // 如果提供了 API Key，添加到请求头
  if (apiKey) {
    headers['X-API-Key'] = apiKey;
  }
  
  // 发送 POST 请求
  const response = await fetch(cancelUrl, {
    method: 'POST',
    headers: headers
  });
  
  const result = await response.json();
  
  if (response.ok && result.success) {
    console.log('查询取消成功');
    return {
      json: {
        success: true,
        queryId: queryExecutionId,
        message: result.message || '查询已成功取消',
        ...result
      }
    };
  } else {
    console.error('取消查询失败:', result);
    return {
      json: {
        success: false,
        queryId: queryExecutionId,
        error: result.error || result.message || '取消查询失败',
        statusCode: response.status,
        ...result
      }
    };
  }
  
} catch (error) {
  console.error('调用 API 时出错:', error);
  return {
    json: {
      success: false,
      queryId: queryExecutionId,
      error: error.message || '调用后端 API 时出错',
      message: '请确保后端服务正在运行'
    }
  };
}




