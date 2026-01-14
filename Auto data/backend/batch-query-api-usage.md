# 批量查询API使用指南

## 📋 概述

批量查询API允许你同时执行多个SQL查询，每个查询都有独立的查询ID，但通过统一的批量查询ID进行管理。

## 🎯 功能特点

- **多查询并行执行**: 同时启动多个SQL查询
- **独立查询管理**: 每个查询有独立的查询ID和状态
- **批量状态跟踪**: 通过批量查询ID跟踪所有查询状态
- **进度统计**: 提供整体进度和完成情况统计
- **批量取消**: 支持取消整个批量查询
- **结果获取**: 支持获取每个查询的详细结果

## 🔧 API端点

### 1. 启动批量查询

**端点**: `POST /api/batch/start`

**请求体**:
```json
{
  "queries": {
    "merchantDailyLastWeek": "SELECT date_str, merchant, unique_users FROM merchant_game_analytics WHERE stat_type = 'merchant_daily' AND date_str >= '20251013' AND date_str <= '20251019'",
    "merchantDailyThisWeek": "SELECT date_str, merchant, unique_users FROM merchant_game_analytics WHERE stat_type = 'merchant_daily' AND date_str >= '20251020' AND date_str <= '20251026'",
    "merchantMonthlyLastWeek": "SELECT month_str, merchant, unique_users FROM merchant_game_analytics WHERE stat_type = 'merchant_monthly' AND month_str = '202510'"
  },
  "database": "gmp",
  "maxRetries": 3
}
```

**响应**:
```json
{
  "success": true,
  "batchId": "batch_1761016653263_fuhqfsapn",
  "queryResults": {
    "merchantDailyLastWeek": {
      "queryId": "query_1_uuid",
      "status": "pending",
      "message": "查询已启动"
    },
    "merchantDailyThisWeek": {
      "queryId": "query_2_uuid",
      "status": "pending",
      "message": "查询已启动"
    },
    "merchantMonthlyLastWeek": {
      "queryId": "query_3_uuid",
      "status": "pending",
      "message": "查询已启动"
    }
  },
  "totalQueries": 3,
  "successfulQueries": 3,
  "failedQueries": 0,
  "message": "批量查询已启动: 3/3 成功",
  "timestamp": "2025-01-21T10:30:00.000Z"
}
```

### 2. 查询批量状态

**端点**: `GET /api/batch/status/{batchId}`

**响应**:
```json
{
  "success": true,
  "batchId": "batch_1761016653263_fuhqfsapn",
  "status": "running",
  "queryStatuses": {
    "merchantDailyLastWeek": {
      "queryId": "query_1_uuid",
      "status": "completed",
      "rowCount": 150,
      "executionTime": 2500,
      "message": "查询执行成功！"
    },
    "merchantDailyThisWeek": {
      "queryId": "query_2_uuid",
      "status": "running",
      "progress": 60,
      "message": "查询正在执行中，请稍候..."
    },
    "merchantMonthlyLastWeek": {
      "queryId": "query_3_uuid",
      "status": "pending",
      "progress": 0,
      "message": "查询已启动，正在准备执行..."
    }
  },
  "summary": {
    "totalQueries": 3,
    "completedQueries": 1,
    "failedQueries": 0,
    "runningQueries": 2,
    "progress": 33
  },
  "startTime": 1761016623264,
  "elapsed": 30000,
  "timestamp": "2025-01-21T10:30:30.000Z"
}
```

### 3. 取消批量查询

**端点**: `POST /api/batch/cancel/{batchId}`

**响应**:
```json
{
  "success": true,
  "batchId": "batch_1761016653263_fuhqfsapn",
  "totalQueries": 3,
  "cancelledQueries": 2,
  "alreadyCompletedQueries": 1,
  "message": "批量查询已取消",
  "timestamp": "2025-01-21T10:31:00.000Z"
}
```

## 🚀 在n8n工作流中使用

### 1. 修改你的n8n工作流

将你的HTTP Request节点的URL从：
```
https://life-point-interactions.trycloudflare.com/api/async/start
```

改为：
```
https://life-point-interactions.trycloudflare.com/api/batch/start
```

### 2. 修改请求体格式

将你的请求体从：
```json
{
  "sql": "SELECT ...",
  "database": "gmp"
}
```

改为：
```json
{
  "queries": {
    "merchantDailyLastWeek": "{{ $json.queries.merchantDailyLastWeek }}",
    "merchantDailyThisWeek": "{{ $json.queries.merchantDailyThisWeek }}",
    "merchantMonthlyLastWeek": "{{ $json.queries.merchantMonthlyLastWeek }}"
  },
  "database": "gmp"
}
```

### 3. 处理批量查询响应

批量查询启动后会返回 `batchId`，你可以使用这个ID来查询所有查询的状态：

```javascript
// 在n8n Code节点中处理响应
const response = $input.first().json;
const batchId = response.batchId;

// 获取所有查询ID
const queryIds = {};
Object.entries(response.queryResults).forEach(([queryName, result]) => {
  queryIds[queryName] = result.queryId;
});

return {
  json: {
    batchId: batchId,
    queryIds: queryIds,
    totalQueries: response.totalQueries,
    successfulQueries: response.successfulQueries
  }
};
```

## 📊 状态说明

### 批量查询状态

- `running`: 批量查询正在执行中
- `completed`: 所有查询都已完成
- `partial_failed`: 部分查询失败
- `cancelled`: 批量查询已被取消

### 单个查询状态

- `pending`: 查询已启动，正在准备执行
- `running`: 查询正在执行中
- `retrying`: 查询失败，正在重试
- `completed`: 查询执行成功
- `failed`: 查询执行失败
- `timeout`: 查询超时
- `cancelled`: 查询已被取消

## 🔍 使用示例

### 1. 使用curl测试

```bash
# 启动批量查询
curl -X POST http://localhost:3000/api/batch/start \
  -H "Content-Type: application/json" \
  -d '{
    "queries": {
      "test1": "SELECT 1 as test",
      "test2": "SELECT 2 as test"
    },
    "database": "gmp"
  }'

# 查询批量状态
curl -X GET http://localhost:3000/api/batch/status/batch_1761016653263_fuhqfsapn

# 取消批量查询
curl -X POST http://localhost:3000/api/batch/cancel/batch_1761016653263_fuhqfsapn
```

### 2. 在JavaScript中使用

```javascript
// 启动批量查询
const startResponse = await fetch('http://localhost:3000/api/batch/start', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    queries: {
      merchantDailyLastWeek: "SELECT * FROM merchant_game_analytics WHERE stat_type = 'merchant_daily'",
      merchantMonthlyLastWeek: "SELECT * FROM merchant_game_analytics WHERE stat_type = 'merchant_monthly'"
    },
    database: 'gmp'
  })
});

const startResult = await startResponse.json();
const batchId = startResult.batchId;

// 轮询查询状态
const checkStatus = async () => {
  const statusResponse = await fetch(`http://localhost:3000/api/batch/status/${batchId}`);
  const statusResult = await statusResponse.json();
  
  if (statusResult.status === 'completed') {
    console.log('所有查询已完成');
    return statusResult;
  } else if (statusResult.status === 'partial_failed') {
    console.log('部分查询失败');
    return statusResult;
  } else {
    console.log(`进度: ${statusResult.summary.progress}%`);
    setTimeout(checkStatus, 5000); // 5秒后再次检查
  }
};

checkStatus();
```

## 📝 注意事项

1. **查询数量限制**: 单次批量查询最多支持10个查询
2. **查询长度限制**: 每个SQL查询最大长度为10000字符
3. **超时时间**: 每个查询最大超时时间为5分钟
4. **重试机制**: 每个查询最多重试3次
5. **结果保留**: 查询结果保留30分钟，过期后自动清理

## 🔧 故障排除

### 1. 批量查询启动失败

```json
{
  "success": false,
  "error": "Invalid request",
  "message": "queries must be an object with at least 1 and at most 10 properties"
}
```

**解决方案**: 检查 `queries` 字段格式，确保是对象且包含1-10个查询。

### 2. 批量查询ID不存在

```json
{
  "success": false,
  "error": "Batch not found",
  "message": "批量查询ID不存在或已过期"
}
```

**解决方案**: 检查批量查询ID是否正确，或查询是否已过期（30分钟）。

### 3. 部分查询失败

```json
{
  "status": "partial_failed",
  "summary": {
    "totalQueries": 3,
    "completedQueries": 2,
    "failedQueries": 1
  }
}
```

**解决方案**: 检查失败的查询，查看具体的错误信息。

## 🚀 最佳实践

1. **合理分组**: 将相关的查询放在同一个批量查询中
2. **错误处理**: 实现适当的错误处理和重试机制
3. **状态监控**: 定期检查批量查询状态，避免长时间等待
4. **资源管理**: 及时取消不需要的查询，释放资源
5. **结果处理**: 根据查询状态处理结果，区分成功和失败的查询

## 📚 相关文件

- `backend/routes/batchQuery.js` - 批量查询API路由
- `backend/services/asyncQueryService.js` - 异步查询服务
- `backend/test-batch-query-api.js` - 测试脚本
- `backend/batch-query-api-usage.md` - 使用说明文档
