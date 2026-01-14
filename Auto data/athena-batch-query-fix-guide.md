# Athena 批量查询状态 - 完整修复指南

## 问题根源

当前配置使用了 `bodyParameters`，这是用于**表单数据**的格式，但 AWS Athena API 需要 **JSON 格式**的请求体。

## 修复步骤

### 步骤1：添加 Code 节点提取查询ID

在 HTTP Request 节点**之前**添加一个 Code 节点，使用以下代码：

```javascript
// 从上游数据提取查询ID，直接输出 Athena API 格式
// n8n Code节点：提取查询ID并构建请求体

const items = $input.all();

if (items.length === 0) {
  throw new Error('上游数据为空');
}

console.log('📥 收到上游数据，共', items.length, '条记录');

// 提取所有的 queryid
const queryIds = items
  .map((item, index) => {
    const data = item.json;
    const queryId = data.queryid || data.queryId || data.query_execution_id || '';
    
    if (!queryId) {
      console.warn('⚠️ 第', index + 1, '条记录缺少 queryid:', data);
    }
    
    return queryId;
  })
  .filter(id => id && id.trim() !== '');

if (queryIds.length === 0) {
  throw new Error('没有找到有效的查询ID');
}

console.log('✅ 提取到', queryIds.length, '个查询ID');

// 直接构建 Athena BatchGetQueryExecution API 的请求体
const requestBody = {
  QueryExecutionIds: queryIds
};

// 构建输出（可以直接传给 HTTP Request 节点）
const result = {
  requestBody: requestBody,
  queryIds: queryIds,
  queryIdCount: queryIds.length,
  
  // 保留原始记录信息（可选）
  records: items.map((item, index) => ({
    index: index,
    id: item.json.id,
    queryid: item.json.queryid,
    type: item.json.type,
    result: item.json.result,
    createdAt: item.json.createdAt,
    updatedAt: item.json.updatedAt
  }))
};

console.log('📤 输出请求体，包含', result.queryIdCount, '个查询ID');

return {
  json: result
};
```

### 步骤2：修复 HTTP Request 节点配置

**关键修改点：**

1. ❌ **删除** `bodyParameters` 配置
2. ✅ **添加** `specifyBody: "json"`
3. ✅ **添加** `jsonBody: "={{ $json.requestBody }}"`

**完整配置：**

```json
{
  "parameters": {
    "method": "POST",
    "url": "https://athena.us-west-2.amazonaws.com/",
    "authentication": "predefinedCredentialType",
    "nodeCredentialType": "aws",
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
      "id": "zyGk0J5eZJwUactt",
      "name": "AWS account"
    }
  }
}
```

### 步骤3：在 n8n 界面中的操作

1. **在 HTTP Request 节点中：**
   - 找到 **Body** 部分
   - 选择 **Body Content Type** = `JSON`
   - 在 **JSON Body** 字段中输入：`={{ $json.requestBody }}`
   - **删除** `bodyParameters` 中的所有参数

2. **确保 Headers 正确：**
   - `Content-Type`: `application/x-amz-json-1.1`
   - `X-Amz-Target`: `AmazonAthena.BatchGetQueryExecution`
   - 确保 Header 名称**没有空格**

3. **确保 AWS 认证已配置：**
   - 在节点的 **Credentials** 中选择你的 AWS 凭证
   - Region 应该是 `us-west-2`

## 完整工作流结构

```
上游数据（包含 queryid 字段的数组）
    ↓
Code 节点：提取查询ID并构建请求体
    ↓
HTTP Request 节点：查询ID状态
    ↓
Code 节点：解析查询状态（可选）
```

## 验证输出

Code 节点应该输出：

```json
{
  "requestBody": {
    "QueryExecutionIds": [
      "1cc8c38b-1967-4d7d-a6c0-9fee53319d8c",
      "50bbaafc-0a79-4b1e-b7cb-89f789bb6507",
      "..."
    ]
  },
  "queryIds": [...],
  "queryIdCount": 6
}
```

HTTP Request 节点会使用 `requestBody` 作为 JSON Body 发送请求。

## 常见错误

### 错误1：Bad request - please check your parameters
- **原因**：使用了 `bodyParameters` 而不是 `jsonBody`
- **解决**：改为使用 `jsonBody` 并设置 `specifyBody: "json"`

### 错误2：QueryExecutionIds 不是数组
- **原因**：只传了单个 ID 或格式错误
- **解决**：确保 `requestBody.QueryExecutionIds` 是数组格式

### 错误3：AWS 认证失败
- **原因**：凭证配置错误或 Region 不匹配
- **解决**：检查 AWS 凭证和 Region 设置

## 测试建议

1. 先用单个查询ID测试
2. 确认成功后，再测试多个查询ID
3. 检查响应中的 `QueryExecutions` 数组





