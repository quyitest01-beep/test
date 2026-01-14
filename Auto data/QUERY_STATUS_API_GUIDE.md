# 查询状态 API 使用指南

## 📋 API 说明

通过查询 ID 获取 Athena 查询的状态和结果文件大小信息。

## 🔗 API 端点

```
GET /api/query/status/:queryId
```

## 📥 请求示例

### 使用 curl

```bash
curl -X GET "http://localhost:8000/api/query/status/e6cc8574-bd83-403c-8234-be64a3e5b19f" \
  -H "X-API-Key: your-api-key-here"
```

### 使用 n8n HTTP Request 节点

**配置**:
- **Method**: `GET`
- **URL**: `http://localhost:8000/api/query/status/{{ $json.queryId }}`
- **Authentication**: Header Auth
  - **Header Name**: `X-API-Key`
  - **Header Value**: 你的 API Key

## 📤 响应格式

### 查询进行中

```json
{
  "success": true,
  "data": {
    "queryId": "e6cc8574-bd83-403c-8234-be64a3e5b19f",
    "status": "RUNNING",
    "statusText": "正在查询",
    "submissionDateTime": "2024-01-15T10:30:00.000Z",
    "completionDateTime": null,
    "stateChangeReason": null,
    "statistics": {
      "executionTime": 5000,
      "dataScanned": 100,
      "cost": 0.0005
    },
    "resultLocation": "s3://athena-query-results-us-west-2/e6cc8574-bd83-403c-8234-be64a3e5b19f/",
    "resultFileSize": null
  },
  "requestId": "req_xxx"
}
```

### 查询已完成

```json
{
  "success": true,
  "data": {
    "queryId": "e6cc8574-bd83-403c-8234-be64a3e5b19f",
    "status": "SUCCEEDED",
    "statusText": "已完成",
    "submissionDateTime": "2024-01-15T10:30:00.000Z",
    "completionDateTime": "2024-01-15T10:30:15.000Z",
    "stateChangeReason": null,
    "statistics": {
      "executionTime": 15000,
      "dataScanned": 500,
      "cost": 0.0025
    },
    "resultLocation": "s3://athena-query-results-us-west-2/e6cc8574-bd83-403c-8234-be64a3e5b19f/",
    "resultFileSize": {
      "totalSizeBytes": 10485760,
      "totalSizeMB": 10.0,
      "totalSizeGB": 0.01,
      "fileCount": 1,
      "formattedSize": "10 MB"
    }
  },
  "requestId": "req_xxx"
}
```

### 查询失败

```json
{
  "success": true,
  "data": {
    "queryId": "e6cc8574-bd83-403c-8234-be64a3e5b19f",
    "status": "FAILED",
    "statusText": "失败",
    "submissionDateTime": "2024-01-15T10:30:00.000Z",
    "completionDateTime": "2024-01-15T10:30:05.000Z",
    "stateChangeReason": "SYNTAX_ERROR: line 1:1: Column 'invalid_column' cannot be resolved",
    "statistics": {
      "executionTime": 5000,
      "dataScanned": 0,
      "cost": 0
    },
    "resultLocation": null,
    "resultFileSize": null
  },
  "requestId": "req_xxx"
}
```

## 📊 字段说明

### 状态字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `status` | string | 查询状态（QUEUED/RUNNING/SUCCEEDED/FAILED/CANCELLED） |
| `statusText` | string | 状态中文文本 |
| `submissionDateTime` | string | 查询提交时间（ISO 8601） |
| `completionDateTime` | string | 查询完成时间（ISO 8601，未完成时为 null） |
| `stateChangeReason` | string | 状态变更原因（失败或取消时会有说明） |

### 统计信息

| 字段 | 类型 | 说明 |
|------|------|------|
| `executionTime` | number | 执行时间（毫秒） |
| `dataScanned` | number | 扫描的数据量（MB） |
| `cost` | number | 查询成本（美元） |

### 结果文件大小（仅查询完成时）

| 字段 | 类型 | 说明 |
|------|------|------|
| `totalSizeBytes` | number | 总大小（字节） |
| `totalSizeMB` | number | 总大小（MB，保留2位小数） |
| `totalSizeGB` | number | 总大小（GB，保留2位小数） |
| `fileCount` | number | 文件数量 |
| `formattedSize` | string | 格式化的大小（如 "10 MB" 或 "1.5 GB"） |

## 🎯 使用场景

### 场景 1: 检查查询是否完成

```javascript
// n8n Code 节点
const response = await fetch(`http://localhost:8000/api/query/status/${queryId}`, {
  headers: { 'X-API-Key': apiKey }
});
const data = await response.json();

if (data.data.status === 'SUCCEEDED') {
  console.log('查询已完成！');
  console.log('文件大小:', data.data.resultFileSize.formattedSize);
} else if (data.data.status === 'RUNNING') {
  console.log('查询进行中...');
} else {
  console.log('查询失败或取消');
}
```

### 场景 2: 判断文件大小决定处理方式

```javascript
const status = await getQueryStatus(queryId);

if (status.status === 'SUCCEEDED' && status.resultFileSize) {
  const sizeMB = status.resultFileSize.totalSizeMB;
  
  if (sizeMB < 10) {
    // 小文件：直接下载处理
    console.log('文件较小，直接处理');
  } else if (sizeMB < 100) {
    // 中等文件：分批处理
    console.log('文件中等，分批处理');
  } else {
    // 大文件：使用流式处理
    console.log('文件较大，使用流式处理');
  }
}
```

### 场景 3: 监控查询进度

```javascript
// 轮询查询状态
async function monitorQuery(queryId) {
  const maxAttempts = 60; // 最多检查 60 次
  const interval = 5000; // 每 5 秒检查一次
  
  for (let i = 0; i < maxAttempts; i++) {
    const status = await getQueryStatus(queryId);
    
    console.log(`[${i + 1}] 状态: ${status.statusText}`);
    console.log(`     已扫描: ${status.statistics.dataScanned} MB`);
    console.log(`     成本: $${status.statistics.cost}`);
    
    if (status.status === 'SUCCEEDED') {
      console.log(`✅ 查询完成！`);
      console.log(`   文件大小: ${status.resultFileSize.formattedSize}`);
      return status;
    } else if (status.status === 'FAILED' || status.status === 'CANCELLED') {
      console.log(`❌ 查询失败或取消: ${status.stateChangeReason}`);
      return status;
    }
    
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  
  console.log('⏱️ 查询超时');
}
```

## 📋 状态值说明

| 状态 | 说明 | 是否有结果文件 |
|------|------|----------------|
| `QUEUED` | 查询在队列中等待执行 | ❌ |
| `RUNNING` | 查询正在执行 | ❌ |
| `SUCCEEDED` | 查询成功完成 | ✅ |
| `FAILED` | 查询执行失败 | ❌ |
| `CANCELLED` | 查询被取消 | ❌ |

## 🔍 文件大小示例

### 小文件（< 10 MB）

```json
{
  "totalSizeBytes": 5242880,
  "totalSizeMB": 5.0,
  "totalSizeGB": 0.0,
  "fileCount": 1,
  "formattedSize": "5 MB"
}
```

### 中等文件（10 MB - 100 MB）

```json
{
  "totalSizeBytes": 52428800,
  "totalSizeMB": 50.0,
  "totalSizeGB": 0.05,
  "fileCount": 1,
  "formattedSize": "50 MB"
}
```

### 大文件（> 100 MB）

```json
{
  "totalSizeBytes": 1073741824,
  "totalSizeMB": 1024.0,
  "totalSizeGB": 1.0,
  "fileCount": 3,
  "formattedSize": "1 GB"
}
```

## ⚠️ 注意事项

1. **文件大小仅在查询完成时可用**
   - 查询进行中时，`resultFileSize` 为 `null`
   - 只有 `SUCCEEDED` 状态才会返回文件大小

2. **多文件情况**
   - Athena 可能将结果分成多个文件
   - `fileCount` 显示文件数量
   - `totalSizeBytes` 是所有文件的总大小

3. **S3 权限**
   - 确保 AWS 凭证有 S3 的 `ListObjects` 权限
   - 否则无法获取文件大小信息

4. **性能考虑**
   - 获取文件大小需要查询 S3，会有轻微延迟
   - 建议不要过于频繁调用

## 🚀 在 n8n 中使用

### 方法 1: HTTP Request 节点

1. 添加 **HTTP Request** 节点
2. 配置：
   - **Method**: `GET`
   - **URL**: `http://localhost:8000/api/query/status/{{ $json.queryId }}`
   - **Authentication**: Header Auth (X-API-Key)

### 方法 2: Code 节点（不使用 AWS SDK）

```javascript
// n8n Code 节点
const queryId = $input.first().json.queryId;
const apiKey = 'your-api-key';
const apiBaseUrl = 'http://localhost:8000';

const response = await fetch(`${apiBaseUrl}/api/query/status/${queryId}`, {
  headers: { 'X-API-Key': apiKey }
});

const result = await response.json();

return {
  json: {
    queryId: queryId,
    status: result.data.status,
    statusText: result.data.statusText,
    fileSize: result.data.resultFileSize?.formattedSize || 'N/A',
    ...result.data
  }
};
```

## 📚 相关文档

- [API 密钥配置指南](./API_KEY_GUIDE.md)
- [取消查询 API](./API_CANCEL_QUERY_EXPLANATION.md)
- [n8n 集成指南](./N8N_INTEGRATION_GUIDE.md)

