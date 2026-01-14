# 查询结果数量API使用指南

## API端点

### 1. 获取单个查询结果数量
**GET** `/api/query/count/:queryId`

#### 请求示例
```bash
curl -X GET "http://localhost:3000/api/query/count/6295fe10-dabc-4931-8dc6-e8ac4fcda562" \
  -H "X-API-Key: f6cd456a61fa81efce5bbf2f4b6e649ac8430f7e17f2e46a3"
```

#### 响应示例

**查询完成时：**
```json
{
  "success": true,
  "queryId": "6295fe10-dabc-4931-8dc6-e8ac4fcda562",
  "status": "completed",
  "rowCount": 96378,
  "dataScanned": 35.76,
  "executionTime": 124233,
  "cost": 0.0002,
  "message": "查询完成，共返回 96378 条记录",
  "requestId": "req_1760666764123_abc123"
}
```

**查询进行中时：**
```json
{
  "success": true,
  "queryId": "6295fe10-dabc-4931-8dc6-e8ac4fcda562",
  "status": "running",
  "message": "查询仍在执行中，请稍后再试",
  "elapsed": 45,
  "progress": 75,
  "requestId": "req_1760666764123_abc123"
}
```

**查询失败时：**
```json
{
  "success": false,
  "queryId": "6295fe10-dabc-4931-8dc6-e8ac4fcda562",
  "status": "failed",
  "error": "Query execution failed",
  "message": "查询执行失败，已达到最大重试次数",
  "requestId": "req_1760666764123_abc123"
}
```

### 2. 获取查询统计信息
**GET** `/api/query/stats/:queryId`

#### 请求示例
```bash
curl -X GET "http://localhost:3000/api/query/stats/6295fe10-dabc-4931-8dc6-e8ac4fcda562" \
  -H "X-API-Key: f6cd456a61fa81efce5bbf2f4b6e649ac8430f7e17f2e46a3"
```

#### 响应示例
```json
{
  "success": true,
  "queryId": "6295fe10-dabc-4931-8dc6-e8ac4fcda562",
  "status": "completed",
  "stats": {
    "executionTime": 124233,
    "dataScanned": 35.76,
    "cost": 0.0002,
    "rowCount": 96378,
    "elapsed": 125,
    "progress": 100,
    "retryCount": 0
  },
  "message": "查询统计信息获取成功",
  "requestId": "req_1760666764123_abc123"
}
```

### 3. 批量获取查询结果数量
**POST** `/api/query/count/batch`

#### 请求示例
```bash
curl -X POST "http://localhost:3000/api/query/count/batch" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: f6cd456a61fa81efce5bbf2f4b6e649ac8430f7e17f2e46a3" \
  -d '{
    "queryIds": [
      "6295fe10-dabc-4931-8dc6-e8ac4fcda562",
      "another-query-id-here"
    ]
  }'
```

#### 响应示例
```json
{
  "success": true,
  "results": [
    {
      "queryId": "6295fe10-dabc-4931-8dc6-e8ac4fcda562",
      "success": true,
      "status": "completed",
      "rowCount": 96378,
      "elapsed": 125,
      "progress": 100,
      "message": "查询执行成功！"
    },
    {
      "queryId": "another-query-id-here",
      "success": true,
      "status": "running",
      "rowCount": 0,
      "elapsed": 30,
      "progress": 50,
      "message": "查询正在执行中，请稍候..."
    }
  ],
  "totalQueries": 2,
  "completedQueries": 1,
  "message": "批量查询完成，共处理 2 个查询",
  "requestId": "req_1760666764123_abc123"
}
```

## 在n8n工作流中使用

### 1. 在n8n中添加HTTP Request节点

**节点配置：**
- **Method**: GET
- **URL**: `http://localhost:3000/api/query/count/{{ $json.queryId }}`
- **Headers**: 
  - `X-API-Key`: `f6cd456a61fa81efce5bbf2f4b6e649ac8430f7e17f2e46a3`
  - `Content-Type`: `application/json`

### 2. 处理响应数据

在后续的Code节点中处理响应：

```javascript
// 处理查询结果数量
const response = $json;

if (response.success && response.status === 'completed') {
  return {
    queryId: response.queryId,
    rowCount: response.rowCount,
    dataScanned: response.dataScanned,
    executionTime: response.executionTime,
    cost: response.cost,
    message: response.message
  };
} else if (response.status === 'running' || response.status === 'pending') {
  return {
    queryId: response.queryId,
    status: response.status,
    message: response.message,
    elapsed: response.elapsed,
    progress: response.progress
  };
} else {
  return {
    queryId: response.queryId,
    success: false,
    error: response.error,
    message: response.message
  };
}
```

## 状态说明

| 状态 | 说明 |
|------|------|
| `pending` | 查询已启动，正在准备执行 |
| `running` | 查询正在执行中 |
| `retrying` | 查询失败，正在重试 |
| `completed` | 查询执行成功 |
| `failed` | 查询执行失败 |
| `timeout` | 查询超时（5分钟） |

## 错误处理

### 常见错误码

- **404**: 查询ID不存在或已过期
- **400**: 查询执行失败或超时
- **500**: 服务器内部错误

### 错误响应示例
```json
{
  "success": false,
  "error": "Query not found",
  "message": "查询ID不存在或已过期",
  "requestId": "req_1760666764123_abc123"
}
```

## 注意事项

1. **查询ID有效期**: 查询记录会在30分钟后自动清理
2. **批量查询限制**: 一次最多查询50个查询ID
3. **API密钥**: 所有请求都需要提供有效的API密钥
4. **查询超时**: 查询会在5分钟后自动超时
5. **结果缓存**: 查询结果会缓存在内存中，重启服务后会丢失

## 使用场景

1. **监控查询进度**: 定期检查查询状态和进度
2. **获取结果数量**: 在查询完成后获取记录数量
3. **批量处理**: 同时检查多个查询的状态
4. **统计信息**: 获取查询的执行时间和数据扫描量
5. **成本分析**: 获取查询的AWS成本信息









