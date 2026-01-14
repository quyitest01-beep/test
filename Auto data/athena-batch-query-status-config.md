# AWS Athena BatchGetQueryExecution API 配置说明

## 问题分析

当前配置存在以下问题：
1. **QueryExecutionIds 格式错误**：应该是数组，但配置成了单个值
2. **Header 名称有空格**：`" Content-Type"` 和 `" X-Amz-Target"` 前面有空格
3. **Body 格式错误**：应该使用 JSON body，而不是 bodyParameters
4. **缺少 AWS 认证**：需要配置 AWS Signature V4 认证

## 修复后的配置

### 方案一：使用 HTTP Request 节点（需要 AWS 认证）

```json
{
  "parameters": {
    "method": "POST",
    "url": "https://athena.us-west-2.amazonaws.com/",
    "sendHeaders": true,
    "headerParameters": {
      "parameters": [
        {
          "name": "Content-Type",
          "value": "application/x-amz-json-1.1"
        },
        {
          "name": "X-Amz-Target",
          "value": "AmazonAthena.BatchGetQueryExecution"
        }
      ]
    },
    "sendBody": true,
    "specifyBody": "json",
    "jsonBody": "={{ JSON.stringify({ QueryExecutionIds: Array.isArray($json.queryId) ? $json.queryId : [$json.queryId] }) }}",
    "options": {
      "authentication": "genericCredentialType",
      "genericAuthType": "httpHeaderAuth",
      "httpHeaderAuth": {
        "name": "Authorization",
        "value": "={{ 'AWS4-HMAC-SHA256 ' + generateAwsSignature(...) }}"
      }
    }
  }
}
```

### 方案二：使用 Code 节点预处理 + HTTP Request（推荐）

**步骤1：Code 节点 - 准备请求数据**

```javascript
// n8n Code节点：准备Athena批量查询请求
const queryId = $json.queryId || $json.query_execution_id || '';

if (!queryId) {
  throw new Error('缺少查询执行ID');
}

// 确保 QueryExecutionIds 是数组格式
const queryIds = Array.isArray(queryId) ? queryId : [queryId];

// 构建请求体
const requestBody = {
  QueryExecutionIds: queryIds
};

// 构建输出
return {
  json: {
    requestBody: requestBody,
    queryIds: queryIds,
    queryIdCount: queryIds.length,
    // 保留原始数据
    ...$json
  }
};
```

**步骤2：HTTP Request 节点配置**

```json
{
  "parameters": {
    "method": "POST",
    "url": "https://athena.us-west-2.amazonaws.com/",
    "sendHeaders": true,
    "headerParameters": {
      "parameters": [
        {
          "name": "Content-Type",
          "value": "application/x-amz-json-1.1"
        },
        {
          "name": "X-Amz-Target",
          "value": "AmazonAthena.BatchGetQueryExecution"
        }
      ]
    },
    "sendBody": true,
    "specifyBody": "json",
    "jsonBody": "={{ $json.requestBody }}",
    "options": {}
  },
  "credentials": {
    "aws": {
      "id": "your-aws-credentials-id",
      "name": "AWS Credentials"
    }
  }
}
```

### 方案三：使用 n8n 的 AWS 节点（最简单）

如果 n8n 支持 AWS Athena 节点，直接使用会更简单。否则使用方案二。

## 完整工作流示例

### 节点1：Code 节点 - 准备请求

```javascript
// 准备批量查询请求
const queryId = $json.queryId || $json.query_execution_id || '';

if (!queryId) {
  throw new Error('缺少查询执行ID');
}

const queryIds = Array.isArray(queryId) ? queryId : [queryId];

return {
  json: {
    requestBody: {
      QueryExecutionIds: queryIds
    },
    queryIds: queryIds
  }
};
```

### 节点2：HTTP Request 节点

- **Method**: `POST`
- **URL**: `https://athena.us-west-2.amazonaws.com/`
- **Headers**:
  - `Content-Type`: `application/x-amz-json-1.1`
  - `X-Amz-Target`: `AmazonAthena.BatchGetQueryExecution`
- **Body**:
  - **Body Content Type**: `JSON`
  - **JSON Body**: `={{ $json.requestBody }}`
- **Authentication**: 
  - 使用 AWS 凭证（需要在 n8n 中配置 AWS 凭证）

### 节点3：Code 节点 - 处理响应

```javascript
// 处理批量查询状态响应
const queryExecutions = $json.QueryExecutions || [];
const unprocessedIds = $json.UnprocessedQueryExecutionIds || [];

const results = queryExecutions.map(execution => {
  const status = execution.Status || {};
  const state = status.State || 'UNKNOWN';
  
  return {
    queryExecutionId: execution.QueryExecutionId || '',
    state: state,
    isRunning: state === 'RUNNING' || state === 'QUEUED',
    isCompleted: state === 'SUCCEEDED' || state === 'FAILED' || state === 'CANCELLED',
    submissionTime: status.SubmissionDateTime || '',
    completionTime: status.CompletionDateTime || null,
    stateChangeReason: status.StateChangeReason || '',
    statistics: execution.Statistics || {},
    query: execution.Query || ''
  };
});

return {
  json: {
    processedResults: results,
    unprocessedIds: unprocessedIds,
    totalCount: queryExecutions.length,
    runningCount: results.filter(r => r.isRunning).length,
    completedCount: results.filter(r => r.isCompleted).length
  }
};
```

## 关键修复点

1. ✅ **移除 Header 名称前的空格**：`"Content-Type"` 而不是 `" Content-Type"`
2. ✅ **QueryExecutionIds 必须是数组**：使用 `Array.isArray()` 检查并转换
3. ✅ **使用 JSON Body**：设置 `specifyBody: "json"` 和 `jsonBody`
4. ✅ **配置 AWS 认证**：在 n8n 中配置 AWS 凭证

## AWS 认证配置

在 n8n 中配置 AWS 凭证：
1. 进入 **Credentials** → **Add Credential**
2. 选择 **AWS**
3. 填写：
   - **Access Key ID**
   - **Secret Access Key**
   - **Region**: `us-west-2`
4. 在 HTTP Request 节点中选择该凭证

## 测试单个查询ID

如果只需要查询单个ID，可以这样配置：

```javascript
// Code节点：确保数组格式
return {
  json: {
    requestBody: {
      QueryExecutionIds: ["{{ $json.queryId }}"]
    }
  }
};
```

然后在 HTTP Request 节点中使用 `={{ $json.requestBody }}` 作为 JSON Body。





