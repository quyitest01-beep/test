# AWS Panorama Console API 分析

## API 用途

这个 API (`https://us-west-2.prod.pl.panorama.console.api.aws/panoramaroute`) 是 **AWS Console 的内部遥测/分析 API**，用于：

1. **用户行为跟踪**：记录用户在 Console 中的操作（点击、搜索、导航等）
2. **性能监控**：收集页面加载时间、交互延迟等
3. **错误追踪**：记录错误和异常
4. **用户体验分析**：分析用户如何使用 Console

## 关键信息

从 curl 命令中可以看到：
- **事件类型**：`eventType: "click"` - 用户点击事件
- **事件详情**：`eventDetail: "history-filter"` - 查询历史过滤
- **事件上下文**：`eventContext: "history-table"` - 历史表格
- **内容ID**：包含复杂的 DOM 选择器路径
- **用户信息**：包含 AWS 用户 ARN、用户名等

## ⚠️ 重要说明

**这个 API 不适合查询 Athena 查询状态！**

原因：
1. ❌ 这是**发送数据**的 API，不是**查询数据**的 API
2. ❌ 它发送的是用户行为数据，不是查询执行状态
3. ❌ 这是 AWS Console 内部使用的，不是公开的查询 API
4. ❌ 需要复杂的认证和用户会话信息

## 正确的 API

要查询 Athena 查询执行状态，应该使用：

### ✅ BatchGetQueryExecution API

```
POST https://athena.us-west-2.amazonaws.com/
Headers:
  Content-Type: application/x-amz-json-1.1
  X-Amz-Target: AmazonAthena.BatchGetQueryExecution
Body:
{
  "QueryExecutionIds": ["id1", "id2", ...]
}
```

这是 AWS Athena 的官方 API，专门用于查询查询执行状态。

## 如果确实需要配置 Panorama API

如果你确实需要发送遥测数据（通常不需要），配置如下：

### n8n HTTP Request 节点配置

```json
{
  "method": "POST",
  "url": "https://us-west-2.prod.pl.panorama.console.api.aws/panoramaroute",
  "sendHeaders": true,
  "headerParameters": {
    "parameters": [
      {
        "name": "Content-Type",
        "value": "application/json; charset=UTF-8"
      },
      {
        "name": "panorama-appentity",
        "value": "aws-console"
      }
    ]
  },
  "sendBody": true,
  "specifyBody": "json",
  "jsonBody": "={{ $json.panoramaData }}"
}
```

**但这不是你需要的！** 这个 API 不会返回查询状态。

## 推荐方案

继续使用 **BatchGetQueryExecution API**，这是查询 Athena 查询状态的正确方法。

### 完整工作流

```
上游数据（包含 queryid）
    ↓
Code 节点：提取查询ID并构建请求体
    （使用 build-athena-request-body.js）
    ↓
HTTP Request 节点：BatchGetQueryExecution
    - URL: https://athena.us-west-2.amazonaws.com/
    - Headers: Content-Type, X-Amz-Target
    - Body: Raw JSON
    - Auth: AWS
    ↓
Code 节点：解析查询状态
    （使用 parse-athena-batch-query-response.js）
```

## 总结

- ❌ **不要使用** Panorama API 查询查询状态
- ✅ **使用** BatchGetQueryExecution API
- 📝 Panorama API 只用于发送用户行为数据，不返回查询结果





