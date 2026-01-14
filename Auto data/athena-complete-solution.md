# Athena 批量查询 - 完整解决方案

## 问题分析

当前错误："The resource you are requesting could not be found"

**原因：**
1. ❌ `body: "={{ $json.queryId[0] }}"` - 只发送了一个ID字符串，不是完整的JSON对象
2. ❌ `rawContentType: "html"` - 应该是 `json`
3. ❌ 请求体格式错误 - 应该是 `{"QueryExecutionIds": ["id1", "id2", ...]}`

## 完整解决方案

### 方案A：使用 Code 节点预处理（推荐）

#### 步骤1：Code 节点 - 提取查询ID并构建请求体

在 HTTP Request 节点**之前**添加 Code 节点，使用以下代码：

```javascript
// 从上游数据提取查询ID，构建完整的请求体JSON字符串
// n8n Code节点：提取查询ID并构建请求体

const items = $input.all();

if (items.length === 0) {
  throw new Error('上游数据为空');
}

// 提取所有的 queryid
const queryIds = items
  .map(item => {
    const data = item.json;
    return data.queryid || data.queryId || data.query_execution_id || '';
  })
  .filter(id => id && id.trim() !== '');

if (queryIds.length === 0) {
  throw new Error('没有找到有效的查询ID');
}

// 构建请求体对象
const requestBody = {
  QueryExecutionIds: queryIds
};

// 转换为 JSON 字符串
const requestBodyString = JSON.stringify(requestBody);

console.log('📤 构建的请求体:');
console.log(requestBodyString);
console.log('📊 查询ID数量:', queryIds.length);

// 输出
return {
  json: {
    requestBodyString: requestBodyString,
    requestBody: requestBody,
    queryIds: queryIds,
    queryIdCount: queryIds.length
  }
};
```

#### 步骤2：HTTP Request 节点配置

在 n8n 界面中配置：

1. **Method**: `POST`
2. **URL**: `https://athena.us-west-2.amazonaws.com/`
3. **Headers**:
   - `Content-Type`: `application/x-amz-json-1.1`
   - `X-Amz-Target`: `AmazonAthena.BatchGetQueryExecution`
4. **Body**:
   - **Body Content Type**: `Raw`
   - **Raw Content Type**: `JSON` ✅（不是 HTML！）
   - **Body**: `={{ $json.requestBodyString }}`
5. **Authentication**: 
   - 选择你的 AWS 凭证

**JSON 配置：**
```json
{
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
  "contentType": "raw",
  "rawContentType": "json",
  "body": "={{ $json.requestBodyString }}",
  "authentication": "predefinedCredentialType",
  "nodeCredentialType": "aws"
}
```

### 方案B：直接在 HTTP Request 节点中构建（如果上游已有 queryIds）

如果上游 Code 节点已经输出了 `queryIds` 数组，可以直接在 HTTP Request 节点中构建：

**Body 表达式：**
```javascript
={{ JSON.stringify({ QueryExecutionIds: $json.queryIds || ($json.queryId ? (Array.isArray($json.queryId) ? $json.queryId : [$json.queryId]) : []) }) }}
```

**配置：**
- **Body Content Type**: `Raw`
- **Raw Content Type**: `JSON`
- **Body**: 使用上面的表达式

## 关键修复点

### ✅ 正确的配置

```json
{
  "contentType": "raw",
  "rawContentType": "json",  // ✅ 必须是 json，不是 html
  "body": "={{ $json.requestBodyString }}"  // ✅ 完整的 JSON 字符串
}
```

### ❌ 错误的配置

```json
{
  "contentType": "raw",
  "rawContentType": "html",  // ❌ 错误：应该是 json
  "body": "={{ $json.queryId[0] }}"  // ❌ 错误：只发送了ID，不是完整对象
}
```

## 完整工作流

```
上游数据（包含 queryid 的数组）
    ↓
Code 节点：提取查询ID并构建请求体字符串
    - 输入：包含 queryid 的数组
    - 输出：requestBodyString（JSON字符串）
    ↓
HTTP Request 节点：查询ID状态
    - Body: Raw, JSON
    - Body: ={{ $json.requestBodyString }}
    - Headers: Content-Type, X-Amz-Target
    - Auth: AWS
    ↓
响应处理
```

## 验证请求体格式

正确的请求体应该是：

```json
{
  "QueryExecutionIds": [
    "1cc8c38b-1967-4d7d-a6c0-9fee53319d8c",
    "50bbaafc-0a79-4b1e-b7cb-89f789bb6507",
    "aa21bba6-d5f4-44bc-9c8f-4a0389c5bfb8"
  ]
}
```

**不是：**
- ❌ `"1cc8c38b-1967-4d7d-a6c0-9fee53319d8c"`（单个ID字符串）
- ❌ `["1cc8c38b-1967-4d7d-a6c0-9fee53319d8c"]`（只有数组，没有对象）

## 测试步骤

1. **添加 Code 节点**，使用上面的代码
2. **检查输出**：确保 `requestBodyString` 是正确的 JSON 字符串
3. **配置 HTTP Request 节点**：
   - `rawContentType: "json"` ✅
   - `body: "={{ $json.requestBodyString }}"` ✅
4. **运行测试**，查看响应

## 如果仍然报错

1. **检查 Code 节点输出**：确保 `requestBodyString` 格式正确
2. **检查 AWS 凭证**：确保 Region 是 `us-west-2`
3. **检查 Headers**：确保 `Content-Type` 和 `X-Amz-Target` 正确
4. **测试单个ID**：先用一个ID测试，确认格式正确





